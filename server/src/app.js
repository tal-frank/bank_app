// Builds and configures the Express app, but does NOT start listening.
// server.js starts it. Keeping them apart means:
//   - tests (Phase 12, Supertest) can create the app without opening a port;
//   - Socket.IO (Phase 7) can attach to the HTTP server created in server.js.
import { readFileSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import { env } from './config/env.js';
import { router } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

// Read the Phase 1 spec once at startup, to serve it as interactive docs.
const openapiSpec = YAML.parse(
  readFileSync(new URL('./docs/openapi.yaml', import.meta.url), 'utf8'),
);

export function createApp() {
  const app = express();

  // Express runs middleware TOP TO BOTTOM, so the order below matters.

  // 1. Security headers on every response (also removes the
  //    "X-Powered-By: Express" header, which tells attackers what we run).
  app.use(helmet());

  // 2. CORS: browsers block a page from calling an API on a different origin
  //    (the React app runs on :5173, the API on :3000) unless the API allows
  //    it. We allow ONLY our own frontend. `credentials: true` lets the
  //    browser send cookies - needed for the refresh-token cookie.
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // 3. Parse JSON request bodies into req.body. The 10kb cap rejects huge
  //    bodies before we spend memory on them; our biggest request is tiny.
  app.use(express.json({ limit: '10kb' }));

  // 4. Parse the Cookie header into req.cookies (used for the refresh token).
  app.use(cookieParser());

  // 5. Log each request: method, URL, status, time. Off during tests to keep
  //    test output readable.
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // 6. Interactive API docs at http://localhost:3000/api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // 7. The API itself.
  app.use('/api', router);

  // 8. Nothing above matched: answer 404 in our JSON error shape.
  app.use(notFound);

  // 9. MUST be last: turns every error into the spec's error response.
  app.use(errorHandler);

  return app;
}
