import {
  Controller, Get, Post, Delete, Body, Param, Headers,
  UnauthorizedException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ContinueWatchingItem } from './auth.types';

/** Extracts Bearer token from Authorization header */
function extractToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('name') name: string,
  ) {
    return this.authService.register(email, password, name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.login(email, password);
  }

  @Get('me')
  async getMe(@Headers('authorization') authorization?: string) {
    const token = extractToken(authorization);
    if (!token) throw new UnauthorizedException('No token provided.');
    const payload = await this.authService.validateToken(token);
    const profile = await this.authService.getProfile(payload.sub);
    if (!profile) throw new UnauthorizedException('User not found.');
    return profile;
  }

  // ─── Continue Watching (auth-gated) ────────────────────────────────────────

  @Get('continue-watching')
  async getContinueWatching(@Headers('authorization') authorization?: string) {
    const token = extractToken(authorization);
    if (!token) return [];
    try {
      const payload = await this.authService.validateToken(token);
      return this.authService.getContinueWatching(payload.sub);
    } catch {
      return [];
    }
  }

  @Post('continue-watching')
  @HttpCode(HttpStatus.OK)
  async updateContinueWatching(
    @Headers('authorization') authorization: string,
    @Body() item: ContinueWatchingItem,
  ) {
    const token = extractToken(authorization);
    if (!token) throw new UnauthorizedException('Authentication required.');
    const payload = await this.authService.validateToken(token);
    return this.authService.updateContinueWatching(payload.sub, item);
  }

  @Delete('continue-watching/:movieId')
  async removeContinueWatching(
    @Headers('authorization') authorization: string,
    @Param('movieId') movieId: string,
  ) {
    const token = extractToken(authorization);
    if (!token) throw new UnauthorizedException('Authentication required.');
    const payload = await this.authService.validateToken(token);
    return this.authService.removeContinueWatching(payload.sub, movieId);
  }
}
