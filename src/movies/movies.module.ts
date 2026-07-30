import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { ScraperService } from './scraper.service';

@Module({
  controllers: [MoviesController],
  providers: [MoviesService, ScraperService],
  exports: [MoviesService, ScraperService],
})
export class MoviesModule {}
