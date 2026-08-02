# Nflix Backend

This is the backend for the Nflix catalog application, providing API endpoints for movie and TV discovery.

## Configuration

Local development uses environment files:

Copy `backend/.env.example` to `backend/.env`. Set exactly one of `TMDB_READ_TOKEN` or `TMDB_API_KEY`; this file is server-only.

Adjust `TMDB_CATALOG_PAGES` and `TMDB_ITEMS_PER_RAIL` in `backend/.env` to control catalog breadth. The backend bounds these values to protect the upstream API.

## Deployment

Deploy the frontend and backend as separate services.

- Backend: inject the values in `backend/.env.example` as encrypted service environment variables. Set `FRONTEND_ORIGIN=https://your-frontend.example` (comma-separated for multiple approved origins) and run `npm run start`.

The catalog is populated from paginated TMDB discovery rails and search results. It intentionally has no embedded title list, so it remains current without source changes.
