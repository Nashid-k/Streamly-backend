import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MOVIES, META } from '@consumet/extensions';

export interface ScrapeResult {
  streamUrl: string;       // Proxied URL safe for hls.js
  rawStreamUrl: string;    // Original CDN URL for reference/debugging
  referer?: string;
  origin?: string;
  subtitles: { lang: string; url: string }[];
}

const PROXY_BASE = process.env.BACKEND_URL || 'http://localhost:4000';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async scrape(
    tmdbId: string,
    season?: number,
    episode?: number,
    customUrl?: string,
  ): Promise<ScrapeResult> {
    const cacheKey = `scrape_${tmdbId}_${season || ''}_${episode || ''}_${customUrl || ''}`;
    const cached = await this.cacheManager.get<ScrapeResult>(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached stream for ${cacheKey}`);
      return cached;
    }

    const isTv = season !== undefined && episode !== undefined;
    let targetUrl = customUrl;
    if (!targetUrl) {
      targetUrl = isTv
        ? `https://2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://2embed.cc/embed/${tmdbId}`;
    }

    this.logger.log(`Scraping via Consumet: ${targetUrl}`);

    try {
      const tmdb = new META.TMDB();
      const flixhq = new MOVIES.FlixHQ();
      
      const type = isTv ? 'tv' : 'movie';
      const info = await tmdb.fetchMediaInfo(tmdbId, type as any);
      
      if (info && info.title) {
        const titleStr = typeof info.title === 'string' 
          ? info.title 
          : (info.title as any).english || (info.title as any).romaji || (info.title as any).native;
        this.logger.log(`Consumet fast-path: Found TMDB title "${titleStr}"`);
        const searchRes = await flixhq.search(titleStr as string);
        
        if (searchRes.results && searchRes.results.length > 0) {
          const firstResult = searchRes.results[0];
          const mediaInfo = await flixhq.fetchMediaInfo(firstResult.id);
          
          let episodeId = mediaInfo.episodes?.[0]?.id;
          if (isTv && mediaInfo.episodes) {
             const matched = mediaInfo.episodes.find((e: any) => e.season === season && e.number === episode);
             if (matched) episodeId = matched.id;
          }

          if (episodeId) {
            const sources = await flixhq.fetchEpisodeSources(episodeId, mediaInfo.id);
            const bestSource = sources.sources?.find((s: any) => s.quality === 'auto') || sources.sources?.[0];
            
            if (bestSource && bestSource.url) {
              const rawStreamUrl = bestSource.url;
              let proxiedUrl = `${PROXY_BASE}/api/movies/proxy/manifest?url=${encodeURIComponent(rawStreamUrl)}`;
              if (sources.headers?.Referer) proxiedUrl += `&ref=${encodeURIComponent(sources.headers.Referer)}`;
              
              const result: ScrapeResult = {
                streamUrl: proxiedUrl,
                rawStreamUrl,
                referer: sources.headers?.Referer || '',
                origin: sources.headers?.Origin || '',
                subtitles: (sources.subtitles || []).map((s: any) => ({ lang: s.lang || 'Unknown', url: s.url })),
              };
              
              await this.cacheManager.set(cacheKey, result);
              this.logger.log(`Consumet SUCCESS: ${rawStreamUrl}`);
              return result;
            }
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Consumet scraping failed: ${e.message}`);
    }

    throw new Error('Failed to scrape stream URL without Puppeteer fallback.');
  }
}
