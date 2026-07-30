import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MoviesModule } from './movies/movies.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true, ttl: 14400000 }), // 4 hours in ms
    MoviesModule, 
    UsersModule
  ],
})
export class AppModule {}
