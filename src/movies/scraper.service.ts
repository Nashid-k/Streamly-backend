import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

puppeteer.use(StealthPlugin());
// Block all ads & trackers — interceptResolutionPriority ensures our handler
// wins over the stealth plugin's request handler
puppeteer.use(AdblockerPlugin({ blockTrackers: true, interceptResolutionPriority: 0 }));

export interface ScrapeResult {
  streamUrl: string;       // Proxied URL safe for hls.js
  rawStreamUrl: string;    // Original CDN URL for reference/debugging
  referer?: string;
  origin?: string;
  subtitles: { lang: string; url: string }[];
}

// Known ad/tracking domains to hard-block in Puppeteer (belt-and-suspenders)
const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
  'googletagmanager.com', 'facebook.net', 'adnxs.com', 'adsrvr.org',
  'pubmatic.com', 'rubiconproject.com', 'openx.net', 'criteo.com',
  'outbrain.com', 'taboola.com', 'propellerads.com', 'trafficjunky.net',
  'exoclick.com', 'ero-advertising.com', 'juicyads.com', 'plugrush.com',
  'hilltopads.net', 'popads.net', 'popcash.net', 'clickadu.com',
  'adsterra.com', 'hilltopads.com', 'trafficstars.com', 'cdn77.org',
];

const PROXY_BASE = process.env.BACKEND_URL || 'http://localhost:4000';

// How long to wait for a stream URL (ms)
const SCRAPE_TIMEOUT_MS = 15_000;

@Injectable()
export class ScraperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private browser: any;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async onModuleInit() {
    this.logger.log('Initializing Puppeteer browser instance...');
    try {
      this.browser = await puppeteer.launch({
        headless: 'new' as any,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--allow-running-insecure-content',
          '--disable-popup-blocking',
        ],
      });
      this.logger.log('Puppeteer browser launched successfully.');
    } catch (e) {
      this.logger.warn(`Puppeteer browser failed to launch (falling back to direct stream players): ${e.message || e}`);
      this.browser = null;
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

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

    this.logger.log(`Scraping: ${targetUrl}`);

    let page: any;
    try {
      page = await this.browser.newPage();

      // Realistic desktop user-agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      );

      // Override window.open and window.location to block redirects
      await page.evaluateOnNewDocument(() => {
        window.open = () => null;
        Object.defineProperty(window, 'onbeforeunload', { set: () => {} });
      });

      let rawStreamUrl = '';
      let streamReferer = '';
      let streamOrigin = '';
      const subtitles: { lang: string; url: string }[] = [];

      // ─────────────────────────────────────────────────────────────────────
      // CDP Network interception — fires for ALL frames (including nested
      // iframes), unlike page.setRequestInterception which only sees the top-
      // level frame. This is the key fix for 2embed / multi-iframe players.
      // ─────────────────────────────────────────────────────────────────────
      const client = await page.createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.setRequestInterception', {
        patterns: [{ urlPattern: '*' }],
      });

      client.on('Network.requestIntercepted', async ({ interceptionId, request }: any) => {
        const url: string = request.url;

        // ── Hard-block ad domains ─────────────────────────────────────────
        const isAd = AD_DOMAINS.some(d => url.includes(d));
        // Also block popup triggers (new-tab navigations to suspicious paths)
        const isPopup = /\/(ads?|pop|click|redirect|track|offer)\//i.test(url) &&
          !url.includes('vidlink') && !url.includes('vidsrc') &&
          !url.includes('2embed') && !url.includes('tmdb');

        if (isAd || isPopup) {
          await client
            .send('Network.continueInterceptedRequest', {
              interceptionId,
              errorReason: 'BlockedByClient',
            })
            .catch(() => {});
          return;
        }

        // ── Capture first real m3u8 ───────────────────────────────────────
        if (url.includes('.m3u8') && !rawStreamUrl) {
          // Ignore blank/ad manifests
          if (!url.includes('blank') && !/\/ad(s)?\//i.test(url)) {
            rawStreamUrl = url;
            streamReferer = request.headers['Referer'] || request.headers['referer'] || '';
            streamOrigin = request.headers['Origin'] || request.headers['origin'] || '';
            this.logger.log(`m3u8 captured: ${rawStreamUrl} (Referer: ${streamReferer})`);
          }
        }

        // ── Collect subtitle tracks ───────────────────────────────────────
        if (url.includes('.vtt')) {
          const langMatch =
            url.match(/\/([a-z]{2})\.vtt/i) || url.match(/lang=([a-z]{2})/i);
          const lang = langMatch ? langMatch[1] : 'Unknown';
          if (!subtitles.find(s => s.url === url)) subtitles.push({ lang, url });
        }

        // Allow everything else
        await client
          .send('Network.continueInterceptedRequest', { interceptionId })
          .catch(() => {});
      });

      // Load page; domcontentloaded is faster than networkidle* and enough to
      // get the iframes bootstrapping their players
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // ── 2embed: force specific server from hash or fallback to defaults ──
      if (targetUrl.includes('2embed')) {
        const forceServer = targetUrl.includes('#') ? targetUrl.split('#')[1].toLowerCase() : '';
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate((fs) => {
          const all = Array.from(document.querySelectorAll('a, button, li, div, span'));
          let preferred;
          if (fs) {
            preferred = all.find(el => (el.textContent?.trim().toLowerCase() || '').includes(fs));
          }
          if (!preferred) {
            // Prioritize UpCloud, Vidcloud, MegaCloud, Cnby, 4khd, or Mapple
            preferred = all.find(el => {
              const txt = el.textContent?.trim().toLowerCase() || '';
              return txt === 'upcloud' || txt === 'vidcloud' || txt === 'megacloud' || txt === 'cnby' || txt.includes('4khd') || txt.includes('mapple');
            });
          }
          
          if (preferred) {
            (preferred as HTMLElement).click();
            return true;
          }
          return false;
        }, forceServer).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
      }

      // ── UNIVERSAL PLAYER BOOTSTRAPPER (Cracks 99% of 3rd party players) ──
      // Many players obscure their play buttons or use click-shield overlays.
      // We simulate real native mouse clicks on the center of the viewport to
      // brute-force start the video and trigger the m3u8 network request.
      
      const attemptPlay = async (f: any) => {
        try {
          const PLAY_SELECTORS = [
            '.jw-display-icon-display', '.vjs-big-play-button',
            '[class*="play-btn"]', '[class*="playBtn"]', '[class*="play-button"]',
            '[class*="bigPlay"]', '[id*="play-btn"]', 'button[aria-label*="play" i]',
            '.plyr__control--overlaid', '.play-overlay', '.btn-play',
          ];
          await f.evaluate((sels: string[]) => {
            for (const sel of sels) {
              const el = document.querySelector(sel) as HTMLElement;
              if (el && el.getBoundingClientRect().width > 0) el.click();
            }
          }, PLAY_SELECTORS).catch(() => {});
        } catch (e) {}
      };

      // 1. DOM-level clicks across the entire frame tree
      for (const frame of page.frames()) {
        await attemptPlay(frame);
      }

      // 2. Native Mouse Clicks! (Bypasses all DOM obfuscation & shadow roots)
      // We click the exact center of the screen, bypassing click-shields.
      try {
        const { width, height } = await page.evaluate(() => ({
          width: window.innerWidth, height: window.innerHeight
        }));
        // First click usually removes the ad overlay/click-shield
        await page.mouse.click(width / 2, height / 2, { delay: 100 });
        await new Promise(r => setTimeout(r, 400));
        // Second click actually triggers the player
        await page.mouse.click(width / 2, height / 2, { delay: 100 });
      } catch (e) {}

      // ── Poll for up to SCRAPE_TIMEOUT_MS ─────────────────────────────
      const deadline = Date.now() + SCRAPE_TIMEOUT_MS;
      while (!rawStreamUrl && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 400));
      }

      // ── DOM fallback: grep the full HTML for any m3u8 link ────────────
      if (!rawStreamUrl) {
        rawStreamUrl = (await page
          .evaluate(() => {
            const m = document.documentElement.innerHTML.match(
              /(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/,
            );
            return m ? m[1] : '';
          })
          .catch(() => '')) as string;
      }

      let proxiedUrl = '';
      if (rawStreamUrl) {
        let pUrl = `${PROXY_BASE}/api/movies/proxy/manifest?url=${encodeURIComponent(rawStreamUrl)}`;
        if (streamReferer) pUrl += `&ref=${encodeURIComponent(streamReferer)}`;
        if (streamOrigin) pUrl += `&orig=${encodeURIComponent(streamOrigin)}`;
        proxiedUrl = pUrl;
      }

      this.logger.log(
        rawStreamUrl ? `Done. Proxied as ${proxiedUrl}` : 'No stream found.',
      );

      const result = {
        streamUrl: proxiedUrl,
        rawStreamUrl,
        referer: streamReferer,
        origin: streamOrigin,
        subtitles: [...new Map(subtitles.map(s => [s.url, s])).values()],
      };
      
      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error: any) {
      this.logger.error(`Scraping failed: ${error?.message}`);
      throw new Error('Failed to scrape stream URL');
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }
}
