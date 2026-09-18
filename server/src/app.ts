import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isDevelopment, isTest } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimit';
import apiRoutes from './routes';
import uploadRoutes from './routes/upload.routes';

/**
 * Builds the Express app.
 *
 * Split from `server.ts` so tests can import the app with supertest without
 * binding a port.
 */
export function createApp() {
  const app = express();

  // Behind a proxy (Render, Fly, Railway) this makes req.ip and rate limiting
  // see the real client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // This process only ever returns JSON, so a document CSP would be noise.
      contentSecurityPolicy: false,
      // Allow the SPA (and any other origin) to load returned image URLs.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: [env.CLIENT_URL, env.SERVER_URL],
      credentials: true,
    }),
  );

  if (!isTest) {
    app.use(morgan(isDevelopment ? 'dev' : 'combined'));
  }

  // Inline image uploads can be ~1 MB, which exceeds the global limit. Mounting
  // this parser first means `express.json` below sees an already-parsed body
  // (it checks `req._body`) and skips it.
  app.use('/api/uploads', express.json({ limit: '3mb' }), uploadRoutes);

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
