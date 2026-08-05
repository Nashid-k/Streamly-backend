# AIOS-ALL IN ONE STREAM Backend

This is the backend for the AIOS-ALL IN ONE STREAM catalog application, providing robust, high-performance API endpoints for movie and TV discovery.

## 🚀 Recent Updates & Features
- **In-Memory Caching:** Eliminated TMDB-based live search network latency. Implemented an O(1) high-performance local search engine.
- **Robust State Management:** Added write-locking queues to `users.service.ts` to prevent JSON data loss from concurrent profile writes.
- **Enhanced Sorting Logic:** Removed forced background sorting in API responses to strictly respect frontend relevancy rules.

## Configuration

Local development uses environment files:

Copy `backend/.env.example` to `backend/.env`. Set exactly one of `TMDB_READ_TOKEN` or `TMDB_API_KEY`; this file is server-only.

Adjust `TMDB_CATALOG_PAGES` and `TMDB_ITEMS_PER_RAIL` in `backend/.env` to control catalog breadth. The backend bounds these values to protect the upstream API.

## Deployment

Deploy the frontend and backend as separate services.

- Backend: inject the values in `backend/.env.example` as encrypted service environment variables. Set `FRONTEND_ORIGIN=https://your-frontend.example` (comma-separated for multiple approved origins) and run `npm run start`.

The catalog is populated from paginated TMDB discovery rails and search results. It intentionally has no embedded title list, so it remains current without source changes.
