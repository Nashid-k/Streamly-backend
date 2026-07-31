import { config } from 'dotenv';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
const compression = require('compression');
import { AppModule } from './app.module';

// Resolve this relative to the backend source/build directory so `npm --prefix
// backend ...` and a root-level process both load backend/.env.
config({ path: join(__dirname, '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(compression());
  
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Keep browser access scoped to this application's frontend.
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,POST,OPTIONS',
    exposedHeaders: ['Cache-Control'],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 NestJS Backend running on port: ${port}`);
  
  // Cron-job to prevent Render from sleeping the instance (14 minutes)
  const renderUrl = 'https://streamly-backend-9q7i.onrender.com';
  setInterval(() => {
    fetch(`${renderUrl}/api/movies/featured?platform=nflix`)
      .then(() => console.log('Pinged self to keep Render awake.'))
      .catch((err) => console.error('Keep-alive ping failed:', err.message));
  }, 14 * 60 * 1000);
}
bootstrap();
