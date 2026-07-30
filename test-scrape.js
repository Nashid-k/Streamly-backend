const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.whats-on-netflix.com/whats-new/', { waitUntil: 'domcontentloaded' });
  const titles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h3, .title, .card-title, .entry-title')).map(el => el.textContent.trim()).filter(t => t);
  });
  console.log("TITLES:", titles.slice(0, 15));
  await browser.close();
})();
