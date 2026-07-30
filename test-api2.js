const fetch = require('node-fetch');
(async () => {
  const rapidApiKey = '33de013735msh146655c5697d832p1e549ejsncafb2247214e';
  const headers = { 'X-RapidAPI-Key': rapidApiKey, 'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com' };

  const expRes = await fetch('https://streaming-availability.p.rapidapi.com/changes?country=us&services=netflix&change_type=expiring&item_type=show', { headers });
  if (expRes.ok) {
    const expData = await expRes.json();
    const expIds = Object.values(expData.shows || {})
      .map((item) => item.tmdbId).filter(Boolean)
      .map((id) => id.includes('/') ? id.split('/')[1] : id);
    console.log('Leaving Soon IDs:', expIds.slice(0, 5), 'Total:', expIds.length);
  } else {
    console.log('Failed:', expRes.status, await expRes.text());
  }
})();
