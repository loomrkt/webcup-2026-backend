import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

// Force Node's local timezone to UTC so all Date serialization (TypeORM, pg,
// JSON) is consistent with the Postgres session timezone.
process.env.TZ = 'UTC';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://loomrkt.madagascar.webcup.hodi.cloud',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Compression gzip des réponses (JSON volumineux divisés par ~5-10).
  app.use(compression());

  app.setGlobalPrefix('api');

  // F77 — surcharge serveurs : les GET publics sont identiques pour tous,
  // laisse les navigateurs et caches intermédiaires absorber le trafic
  // répété (max-age = navigateur, s-maxage = CDN/proxy partagé).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && !req.headers.authorization) {
      res.setHeader(
        'Cache-Control',
        'public, max-age=120, s-maxage=300, stale-while-revalidate=60',
      );
    }
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('Generated API')
    .setDescription('NestJS API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.security = [{ bearer: [] }];
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
