# 🚀 StreamUI Backend (NestJS)

Welcome to the **StreamUI Backend**, a robust, high-performance API service built with NestJS. This backend powers the cinematic StreamUI frontend, handling everything from user authentication to complex catalog metadata scraping and caching.

## ✨ Core Capabilities

- **Ultra-Fast Performance:** Built on top of Express and NestJS, utilizing advanced caching mechanisms to serve metadata at lightning speed.
- **Dynamic Catalog Engine:** Hooks into TMDB and other metadata providers to seamlessly scrape, aggregate, and deliver rich movie/series data.
- **Advanced Caching:** In-memory caching layers ensure that frequently accessed categories and top-10 lists are served with zero database latency.
- **Robust Authentication:** Secure JWT-based authentication system supporting user sessions and multi-profile setups.
- **Cross-Origin Ready:** Pre-configured with CORS and compression to handle thousands of concurrent requests from the frontend efficiently.

## 🛠️ Tech Stack
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Caching:** cache-manager
- **Security:** @nestjs/jwt & class-validator
- **Integrations:** @consumet/extensions, yt-search

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root of the `backend` directory and add your required secrets.
   ```env
   PORT=3001
   JWT_SECRET=your_super_secret_key_here
   ```

3. **Start the Application:**
   
   *Development Mode (with Hot Reloading):*
   ```bash
   npm run start:dev
   ```

   *Production Mode:*
   ```bash
   npm run build
   npm run start:prod
   ```

## 🔐 Architecture Notes
- **Controllers:** Handle incoming HTTP requests and route them to specific services.
- **Services:** Contain the core business logic, web scrapers, and API integrations.
- **Cache:** Heavily relied upon to minimize rate-limiting from external APIs (like TMDB).
