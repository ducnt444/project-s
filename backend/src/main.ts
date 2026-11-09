import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Behind a hosting proxy, use the client's IP for rate limiting.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  serveFrontend(app, process.env.FRONTEND_DIR);
  await app.listen(process.env.PORT ?? 3000);
}

/**
 * In a deployed build the API also serves the compiled Angular app, so the
 * whole site is one service on one origin. Locally `ng serve` does this instead.
 */
function serveFrontend(app: NestExpressApplication, dir?: string) {
  if (!dir) return;
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`FRONTEND_DIR has no index.html: ${dir}`);
  }
  app.useStaticAssets(dir, {
    index: false,
    setHeaders: (res, path) => {
      // Angular puts a content hash in bundle names, so those never change.
      const hashed = /-[A-Z0-9]{8}\.(js|css)$/.test(path);
      res.setHeader(
        'Cache-Control',
        hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });
  // Any other GET outside /api is a client-side route: return the app shell.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}

await bootstrap();
