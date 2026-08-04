export interface AuthUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // sha256(password + salt)
  createdAt: number;
  profiles: AuthProfile[];
  currentProfileId: string;
  myList: string[];
  continueWatching: ContinueWatchingItem[];
  preferencesByProfile?: Record<string, any>;
}

export interface AuthProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  isKids: boolean;
}

export interface ContinueWatchingItem {
  movieId: string;
  title: string;
  posterUrl: string;
  progressSeconds: number;
  durationSeconds: number;
  platform: string;
  updatedAt: number;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}
