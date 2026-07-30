const fs = require('fs');
const path = require('path');

// 1. Update movies.controller.ts
const controllerPath = path.join('/home/edure/Desktop/nflix/backend/src/movies/movies.controller.ts');
let controllerStr = fs.readFileSync(controllerPath, 'utf8');

// Replace all occurrences of `'nflix' | 'nprime'` with `'nflix' | 'nprime' | 'hotstar'`
controllerStr = controllerStr.replace(/'nflix' \| 'nprime' = 'nflix'/g, "'nflix' | 'nprime' | 'hotstar' = 'nflix'");
fs.writeFileSync(controllerPath, controllerStr);

// 2. Update movies.service.ts
const servicePath = path.join('/home/edure/Desktop/nflix/backend/src/movies/movies.service.ts');
let serviceStr = fs.readFileSync(servicePath, 'utf8');

serviceStr = serviceStr.replace(/'nflix' \| 'nprime' = 'nflix'/g, "'nflix' | 'nprime' | 'hotstar' = 'nflix'");
serviceStr = serviceStr.replace(/platform: 'nflix' \| 'nprime'\)/g, "platform: 'nflix' | 'nprime' | 'hotstar')");
serviceStr = serviceStr.replace(/private activePlatform: 'nflix' \| 'nprime' = 'nflix';/, "private activePlatform: 'nflix' | 'nprime' | 'hotstar' = 'nflix';");

// Update RapidAPI serviceName
serviceStr = serviceStr.replace(
  /const serviceName = platform === 'nprime' \? 'prime' : 'netflix';/g,
  "const serviceName = platform === 'hotstar' ? 'hotstar' : (platform === 'nprime' ? 'prime' : 'netflix');"
);

// Update buildDynamicRails providerId and region
const oldRailsCode = `const providerId = this.activePlatform === 'nprime' ? '9|119|10' : '8';
    const monetization = this.activePlatform === 'nprime' ? 'flatrate|rent|buy' : 'flatrate';
    
    // Core discovery query fragments (Watch provider logic built-in)
    const baseDiscover = \`with_watch_providers=\${providerId}&watch_region=US&with_watch_monetization_types=\${monetization}\`;`;

const newRailsCode = `const providerId = this.activePlatform === 'hotstar' ? '122' : (this.activePlatform === 'nprime' ? '9|119|10' : '8');
    const monetization = this.activePlatform === 'nprime' ? 'flatrate|rent|buy' : 'flatrate';
    const region = this.activePlatform === 'hotstar' ? 'IN' : 'US';
    
    // Core discovery query fragments (Watch provider logic built-in)
    const baseDiscover = \`with_watch_providers=\${providerId}&watch_region=\${region}&with_watch_monetization_types=\${monetization}\`;`;

serviceStr = serviceStr.replace(oldRailsCode, newRailsCode);

// There's also `buildHero` query in movies.service.ts that might hardcode provider and region!
// Let's find it.
serviceStr = serviceStr.replace(/with_watch_providers=8&watch_region=US/g, "with_watch_providers=${this.activePlatform === 'hotstar' ? '122' : '8'}&watch_region=${this.activePlatform === 'hotstar' ? 'IN' : 'US'}");

// Wait, the original code had: `const heroQuery = '/discover/tv?with_watch_providers=8&watch_region=US&...';`
// I need to properly template it if it wasn't templated.
// Let's use regex.
serviceStr = serviceStr.replace(
  /with_watch_providers=8&watch_region=US/g,
  "${this.activePlatform === 'hotstar' ? '122' : (this.activePlatform === 'nprime' ? '9|119|10' : '8')}&watch_region=${this.activePlatform === 'hotstar' ? 'IN' : 'US'}"
);
serviceStr = serviceStr.replace(
  /with_watch_providers=\$\{this\.activePlatform === 'hotstar' \? '122' : \(this\.activePlatform === 'nprime' \? '9\|119\|10' : '8'\)\}/g,
  "${this.activePlatform === 'hotstar' ? '122' : (this.activePlatform === 'nprime' ? '9|119|10' : '8')}" // Just in case it runs twice.
);

fs.writeFileSync(servicePath, serviceStr);
console.log('done updating backend platforms');
