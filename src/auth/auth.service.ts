import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthUser, ContinueWatchingItem, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly salt = process.env.STREAMLY_SALT || 'streamly_secret_2024';
  private readonly usersPath =
    process.env.USERS_STATE_FILE || join(process.cwd(), 'data', 'users.json');
  private users: AuthUser[] = [];

  constructor(private readonly jwtService: JwtService) {}

  async onModuleInit() {
    await this.loadUsers();
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private async loadUsers() {
    try {
      const raw = await readFile(this.usersPath, 'utf8');
      this.users = JSON.parse(raw) as AuthUser[];
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`Could not load users: ${err?.message}`);
      }
      this.users = [];
    }
  }

  private async persistUsers() {
    const dir = join(this.usersPath, '..');
    try {
      await mkdir(dir, { recursive: true });
      const tmp = `${this.usersPath}.tmp`;
      await writeFile(tmp, JSON.stringify(this.users, null, 2), 'utf8');
      await rename(tmp, this.usersPath);
    } catch (err: any) {
      this.logger.error(`Could not persist users: ${err?.message}`);
    }
  }

  // ─── Password Hashing ───────────────────────────────────────────────────────

  private hashPassword(password: string): string {
    return createHash('sha256')
      .update(password + this.salt)
      .digest('hex');
  }

  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async register(email: string, password: string, name: string): Promise<{ token: string; user: Omit<AuthUser, 'passwordHash'> }> {
    await this.loadUsers(); // reload for freshness
    const existing = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }
    if (!email || !password || password.length < 8) {
      throw new UnauthorizedException('Email and password (min 8 chars) are required.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new UnauthorizedException('Invalid email format.');
    }
    const cleanName = name?.trim().replace(/[<>]/g, '') || 'Streamer';

    const newUser: AuthUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: email.toLowerCase().trim(),
      name: cleanName,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
      profiles: [
        { id: 'prof-1', name: name?.trim() || 'Main', isKids: false },
        { id: 'prof-kids', name: 'Kids', isKids: true },
      ],
      currentProfileId: 'prof-1',
      myList: [],
      continueWatching: [],
    };

    this.users.push(newUser);
    await this.persistUsers();

    const token = this.signToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;
    return { token, user: safeUser };
  }

  async login(email: string, password: string): Promise<{ token: string; user: Omit<AuthUser, 'passwordHash'> }> {
    await this.loadUsers();
    const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.signToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async validateToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  async getProfile(userId: string): Promise<Omit<AuthUser, 'passwordHash'> | null> {
    await this.loadUsers();
    const user = this.users.find((u) => u.id === userId);
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  // ─── Continue Watching ───────────────────────────────────────────────────────

  async updateContinueWatching(userId: string, item: ContinueWatchingItem): Promise<ContinueWatchingItem[]> {
    await this.loadUsers();
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new UnauthorizedException('User not found.');

    user.continueWatching = user.continueWatching || [];
    const idx = user.continueWatching.findIndex((c) => c.movieId === item.movieId);
    if (idx >= 0) {
      user.continueWatching[idx] = item;
    } else {
      user.continueWatching.unshift(item);
    }
    // Sort by most recently updated, keep 20
    user.continueWatching = user.continueWatching
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);

    await this.persistUsers();
    return user.continueWatching;
  }

  async getContinueWatching(userId: string): Promise<ContinueWatchingItem[]> {
    await this.loadUsers();
    const user = this.users.find((u) => u.id === userId);
    return (user?.continueWatching || []).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async removeContinueWatching(userId: string, movieId: string): Promise<ContinueWatchingItem[]> {
    await this.loadUsers();
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new UnauthorizedException('User not found.');
    user.continueWatching = (user.continueWatching || []).filter((c) => c.movieId !== movieId);
    await this.persistUsers();
    return user.continueWatching;
  }

  // ─── JWT ─────────────────────────────────────────────────────────────────────

  private signToken(user: AuthUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
