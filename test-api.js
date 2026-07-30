const fetch = require('node-fetch');

(async () => {
  const rapidApiKey = '33de013735msh146655c5697d832p1e549ejsncafb2247214e';
  const headers = {
    'X-RapidAPI-Key': rapidApiKey,
    'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
  };

  const newRes = await fetch('https://streaming-availability.p.rapidapi.com/changes?country=us&services=netflix&change_type=new&item_type=show', { headers });
  if (newRes.ok) {
    const newData = await newRes.json();
    const newIds = Object.values(newData.shows || {})
      .map((item) => item.tmdbId)
      .filter(Boolean)
      .map((id) => id.includes('/') ? id.split('/')[1] : id);
    console.log('Recently Added IDs:', newIds.slice(0, 5), 'Total:', newIds.length);
  } else {
    console.log('Failed:', newRes.status, await newRes.text());
  }
})();
