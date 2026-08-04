import { Controller, Get, Param, Query, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import { MoviesService } from './movies.service';
import { ScraperService } from './scraper.service';
import { Movie, Category } from './movies.types';
import { isSafeUrl } from '../utils/security';
import * as http from 'http';
import * as https from 'https';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });
/** Set Cache-Control header. staleWhileRevalidate is in seconds. */
function setCache(res: Response, maxAgeSeconds: number, staleWhileRevalidateSeconds = 60) {
  res.setHeader(
    'Cache-Control',
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  );
}

@Controller('api/movies')
export class MoviesController {
  constructor(
    private readonly moviesService: MoviesService,
    private readonly scraperService: ScraperService,
  ) {}

  @Get('scrape/:id')
  async scrapeMovie(
    @Param('id') id: string,
    @Query('url') url?: string,
    @Query('season') season?: string,
    @Query('episode') episode?: string,
  ) {
    if (url && !isSafeUrl(url)) {
      throw new HttpException('Invalid URL provided', HttpStatus.BAD_REQUEST);
    }
    const s = season ? parseInt(season, 10) : undefined;
    const e = episode ? parseInt(episode, 10) : undefined;
    return this.scraperService.scrape(id, s, e, url);
  }

  /**
   * HLS Proxy — fetches a .m3u8 manifest from an external CDN (no CORS issues
   * server-side), rewrites segment/key URLs so they also go through this proxy,
   * then returns the modified manifest to the browser with permissive CORS headers.
   */
  @Get('proxy/manifest')
  async proxyManifest(
    @Query('url') targetUrl: string,
    @Query('ref') referer: string,
    @Query('orig') origin: string,
    @Res() res: Response,
  ) {
    if (!targetUrl || !isSafeUrl(targetUrl)) {
      return res.status(400).send('Invalid or missing url');
    }
    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      };
      if (referer) headers['Referer'] = referer;
      if (origin) headers['Origin'] = origin;

      const upstream = await axios.get(targetUrl, {
        responseType: 'text',
        headers,
        timeout: 15000,
        httpAgent,
        httpsAgent,
      });

      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const absolutify = (seg: string) => {
        if (seg.startsWith('http')) return seg;
        if (seg.startsWith('/')) {
          try {
            return new URL(targetUrl).origin + seg;
          } catch {
            return baseUrl + seg;
          }
        }
        return baseUrl + seg;
      };

      // Pass referer/origin down to next requests
      let extraParams = '';
      if (referer) extraParams += `&ref=${encodeURIComponent(referer)}`;
      if (origin) extraParams += `&orig=${encodeURIComponent(origin)}`;

      // Rewrite every URI line so segments/keys also flow through proxy
      const modified = upstream.data.replace(
        /^(?!#)(.+)$/gm,
        (_: string, uri: string) => {
          const absUri = absolutify(uri.trim());
          if (absUri.includes('.m3u8')) {
            return `/api/movies/proxy/manifest?url=${encodeURIComponent(absUri)}${extraParams}`;
          }
          return `/api/movies/proxy/segment?url=${encodeURIComponent(absUri)}${extraParams}`;
        },
      ).replace(
        /URI="([^"]+)"/g,
        (_: string, uri: string) => {
          const absUri = absolutify(uri);
          // Audio tracks and subtitles use URI= pointing to another .m3u8 manifest
          if (absUri.includes('.m3u8')) {
            return `URI="/api/movies/proxy/manifest?url=${encodeURIComponent(absUri)}${extraParams}"`;
          }
          // Keys and other binary blobs go to segment proxy
          return `URI="/api/movies/proxy/segment?url=${encodeURIComponent(absUri)}${extraParams}"`;
        },
      );

      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.send(modified);
    } catch (err) {
      return res.status(502).send('Proxy error: ' + err.message);
    }
  }

  /**
   * HLS Segment / Key Proxy — pipes raw .ts / .aac / .key bytes back to the browser
   * with CORS headers so hls.js can load them.
   */
  @Get('proxy/segment')
  async proxySegment(
    @Query('url') targetUrl: string,
    @Query('ref') referer: string,
    @Query('orig') origin: string,
    @Res() res: Response,
  ) {
    if (!targetUrl || !isSafeUrl(targetUrl)) {
      return res.status(400).send('Invalid or missing url');
    }
    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      };
      if (referer) headers['Referer'] = referer;
      if (origin) headers['Origin'] = origin;

      const upstream = await axios.get(targetUrl, {
        responseType: 'stream',
        headers,
        timeout: 20000,
        httpAgent,
        httpsAgent,
      });

      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'video/mp2t'));
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      upstream.data.pipe(res);
    } catch (err) {
      return res.status(502).send('Segment proxy error: ' + err.message);
    }
  }

  @Get()
  async getAllMovies(
    @Res({ passthrough: true }) res: Response,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Movie[]> {
    setCache(res, 120);
    return this.moviesService.getAllMovies(platform);
  }

  @Get('featured')
  async getFeatured(
    @Res({ passthrough: true }) res: Response,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Movie | null> {
    setCache(res, 120);
    return this.moviesService.getFeaturedMovie(platform);
  }

  @Get('categories')
  async getCategories(
    @Res({ passthrough: true }) res: Response,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Category[]> {
    setCache(res, 120);
    return this.moviesService.getCategories(platform);
  }

  @Get('top10')
  async getTop10(
    @Res({ passthrough: true }) res: Response,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Movie[]> {
    setCache(res, 120);
    return this.moviesService.getTop10Movies(platform);
  }

  @Get('search')
  async searchMovies(
    @Res({ passthrough: true }) res: Response,
    @Query('q') query?: string,
    @Query('genre') genre?: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<{ movies: Movie[]; actor?: any }> {
    res.setHeader('Cache-Control', 'private, max-age=30');
    const safeQuery = (query || '').slice(0, 200);
    const result = await this.moviesService.searchMovies(safeQuery, genre, platform);
    return result;
  }

  @Get(':id')
  async getMovieById(
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Movie> {
    setCache(res, 60);
    return this.moviesService.getMovieById(id, platform);
  }

  @Get(':id/similar')
  async getSimilar(
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ): Promise<Movie[]> {
    setCache(res, 60);
    return this.moviesService.getSimilarMovies(id, platform);
  }

  @Get(':id/season/:seasonNumber')
  async getSeasonEpisodes(
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Param('seasonNumber') seasonNumber: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix'
  ) {
    setCache(res, 60);
    // Clamp season number to a sane range to prevent abuse
    const season = Math.min(Math.max(Number.parseInt(seasonNumber, 10) || 1, 1), 50);
    return this.moviesService.getSeasonEpisodes(id, season, platform);
  }

  @Get(':id/recommendations')
  async getRecommendations(
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix',
  ): Promise<Movie[]> {
    setCache(res, 300);
    return this.moviesService.getRecommendations(id, platform);
  }

  @Get(':id/intro')
  async getIntroTimings(
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Query('season') season?: string,
    @Query('episode') episode?: string,
    @Query('platform') platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix',
  ) {
    setCache(res, 86400); // 24-hour cache for intro timings
    const s = season ? parseInt(season, 10) : undefined;
    const e = episode ? parseInt(episode, 10) : undefined;
    return this.moviesService.getIntroTimings(id, s, e, platform);
  }
}
