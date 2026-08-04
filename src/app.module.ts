import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MoviesModule } from './movies/movies.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

/**
 * Cache configuration:
 * - In-memory (default): 4-hour TTL for TMDB catalog responses
 * - Redis (production): Set REDIS_URL env var and install @keyv/redis:
 *   npm install @keyv/redis && npm install cacheable
 *   Then update this module to use KeyvRedis store.
 */
const cacheConfig = CacheModule.register({
  isGlobal: true,
  ttl: 4 * 60 * 60 * 1000, // 4 hours in ms
});

@Module({
  imports: [
    cacheConfig,
    MoviesModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
