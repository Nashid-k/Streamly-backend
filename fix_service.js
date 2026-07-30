const fs = require('fs');
let code = fs.readFileSync('src/movies/movies.service.ts', 'utf8');

const classPropRegex = /private movies: Map<string, Movie> = new Map\(\);\s+private tmdbIdIndex: Map<string, Movie> = new Map\(\);\s+private categories: Category\[\] = \[\];\s+private genres: Map<number, string> = new Map\(\);\s+private lastRefreshAttemptAt = 0;\s+private refreshInFlight\?: Promise<void>;\s+private realRecentlyAddedTmdbIds: Set<string> = new Set\(\);\s+private realLeavingSoonTmdbIds: Set<string> = new Set\(\);\s+private activePlatform: 'nflix' \| 'nprime' \| 'hotstar' = 'nflix';/;

const replacement = `private genres: Map<number, string> = new Map();

  private state = {
    nflix: { movies: new Map<string, Movie>(), tmdbIdIndex: new Map<string, Movie>(), categories: [] as Category[], realRecentlyAddedTmdbIds: new Set<string>(), realLeavingSoonTmdbIds: new Set<string>(), lastRefreshAttemptAt: 0, refreshInFlight: null as Promise<void> | null },
    nprime: { movies: new Map<string, Movie>(), tmdbIdIndex: new Map<string, Movie>(), categories: [] as Category[], realRecentlyAddedTmdbIds: new Set<string>(), realLeavingSoonTmdbIds: new Set<string>(), lastRefreshAttemptAt: 0, refreshInFlight: null as Promise<void> | null },
    hotstar: { movies: new Map<string, Movie>(), tmdbIdIndex: new Map<string, Movie>(), categories: [] as Category[], realRecentlyAddedTmdbIds: new Set<string>(), realLeavingSoonTmdbIds: new Set<string>(), lastRefreshAttemptAt: 0, refreshInFlight: null as Promise<void> | null },
  };`;

code = code.replace(classPropRegex, replacement);

// Replace loadRealNetflixStatus
code = code.replace(/private async loadRealNetflixStatus\(\) \{([\s\S]*?)const platform = this\.activePlatform;/g, 'private async loadRealNetflixStatus(platform: "nflix" | "nprime" | "hotstar") {\n    const state = this.state[platform];');
code = code.replace(/this\.realRecentlyAddedTmdbIds/g, 'state.realRecentlyAddedTmdbIds');
code = code.replace(/this\.realLeavingSoonTmdbIds/g, 'state.realLeavingSoonTmdbIds');

// Replace buildDynamicRails
code = code.replace(/private buildDynamicRails\(\): CatalogRail\[\] \{([\s\S]*?)const providerId = this\.activePlatform/g, 'private buildDynamicRails(platform: "nflix" | "nprime" | "hotstar"): CatalogRail[] {\n    const providerId = platform');
code = code.replace(/this\.activePlatform === 'nprime'/g, "platform === 'nprime'");
code = code.replace(/this\.activePlatform === 'hotstar'/g, "platform === 'hotstar'");

// Replace refreshCatalog
code = code.replace(/async refreshCatalog\(\) \{([\s\S]*?)if \(this\.refreshInFlight\) return this\.refreshInFlight;/g, 'async refreshCatalog(platform: "nflix" | "nprime" | "hotstar") {\n    const state = this.state[platform];\n    if (state.refreshInFlight) return state.refreshInFlight;');
code = code.replace(/this\.refreshInFlight = this\.loadCatalog\(\)\.finally\(\(\) => \{/g, 'state.refreshInFlight = this.loadCatalog(platform).finally(() => {');
code = code.replace(/this\.refreshInFlight = undefined;/g, 'state.refreshInFlight = null;');
code = code.replace(/return this\.refreshInFlight;/g, 'return state.refreshInFlight;');

// Replace loadCatalog
code = code.replace(/private async loadCatalog\(\) \{/g, 'private async loadCatalog(platform: "nflix" | "nprime" | "hotstar") {\n    const state = this.state[platform];');
code = code.replace(/this\.lastRefreshAttemptAt = Date\.now\(\);/g, 'state.lastRefreshAttemptAt = Date.now();');
code = code.replace(/await this\.loadRealNetflixStatus\(\);/g, 'await this.loadRealNetflixStatus(platform);');
code = code.replace(/const dynamicRails = this\.buildDynamicRails\(\);/g, 'const dynamicRails = this.buildDynamicRails(platform);');
code = code.replace(/this\.movies = loadedMovies;/g, 'state.movies = loadedMovies;');
code = code.replace(/this\.categories = categories;/g, 'state.categories = categories;');
code = code.replace(/this\.tmdbIdIndex\.clear\(\);/g, 'state.tmdbIdIndex.clear();');
code = code.replace(/this\.tmdbIdIndex\.set/g, 'state.tmdbIdIndex.set');

// Replace ensureCatalog
code = code.replace(/private async ensureCatalog\(platform: 'nflix' \| 'nprime' \| 'hotstar' = 'nflix'\) \{([\s\S]*?)\}/, `private async ensureCatalog(platform: 'nflix' | 'nprime' | 'hotstar' = 'nflix') {
    this.ensureConfigured();
    const state = this.state[platform];
    if (state.movies.size === 0 && !state.refreshInFlight) {
      state.refreshInFlight = this.refreshCatalog(platform);
    }
    if (state.refreshInFlight) {
      await state.refreshInFlight;
    }
  }`);

// Finally replace remaining this.movies, this.categories, this.tmdbIdIndex in public methods
code = code.replace(/this\.movies/g, 'this.state[platform].movies');
code = code.replace(/this\.categories/g, 'this.state[platform].categories');
code = code.replace(/this\.tmdbIdIndex/g, 'this.state[platform].tmdbIdIndex');

// Wait! In `ensureCatalog` replacement, `this.movies` gets replaced to `this.state[platform].state[platform].movies`.
// Let's not do blind global replaces for this.movies.

fs.writeFileSync('src/movies/movies.service.ts.fix', code);
