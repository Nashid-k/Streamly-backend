const apiBaseUrl = process.env.API_URL || 'http://localhost:4000/api';

async function request(path, init) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

const user = await request('/user');
const categories = await request('/movies/categories');
const movies = categories.flatMap((category) => category.movies || []);

if (!categories.length || !movies.length) throw new Error('Catalog is empty.');
if (!movies.some((movie) => movie.audioLanguages?.length)) {
  throw new Error('Catalog titles are missing language metadata.');
}

const originalPreferences = user.preferences || { preferredLanguages: ['All'], dubOption: 'all' };
const testPreferences = { preferredLanguages: ['Tamil', 'Malayalam'], dubOption: 'all' };

try {
  const updated = await request('/user/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPreferences),
  });
  if (JSON.stringify(updated.preferredLanguages) !== JSON.stringify(testPreferences.preferredLanguages)) {
    throw new Error('Multi-language preferences were not saved.');
  }
} finally {
  await request('/user/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(originalPreferences),
  });
}

console.log(`Smoke test passed: ${categories.length} rails, ${movies.length} titles, language preferences accepted.`);
