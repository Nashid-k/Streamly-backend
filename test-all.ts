import axios from 'axios';

const tmdbIdStr = '690957';
const season = '1';
const episode = '1';

const urls = [
  { name: 'VidSrc', url: `https://vidsrc.cc/v2/embed/movie/${tmdbIdStr}` },
  { name: 'VidSrc.me', url: `https://vidsrc.me/embed/movie?tmdb=${tmdbIdStr}` },
  { name: 'VidSrc.net', url: `https://vidsrc.net/embed/movie?tmdb=${tmdbIdStr}` },
  { name: 'VidSrc.xyz', url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbIdStr}` },
  { name: 'SuperEmbed', url: `https://multiembed.mov/directstream.php?video_id=${tmdbIdStr}&tmdb=1` },
  { name: '2Embed', url: `https://www.2embed.cc/embed/${tmdbIdStr}` },
  { name: 'Smashy', url: `https://player.smashy.stream/movie/${tmdbIdStr}` },
  { name: 'VidLink', url: `https://vidlink.pro/movie/${tmdbIdStr}` },
  { name: 'Club', url: `https://moviesapi.club/movie/${tmdbIdStr}` },
  { name: 'Vidsrc.icu', url: `https://vidsrc.icu/embed/movie/${tmdbIdStr}` },
  { name: 'VidBinge', url: `https://vidbinge.dev/embed/movie/${tmdbIdStr}` },
  { name: 'Flix', url: `https://flix.pm/embed/movie/${tmdbIdStr}` }
];

async function check() {
  for (const u of urls) {
    try {
      const res = await axios.get(u.url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`[${u.name}] OK (${res.status}) - ${res.data.length} bytes`);
    } catch (e: any) {
      console.log(`[${u.name}] FAIL: ${e.message}`);
    }
  }
}
check();
