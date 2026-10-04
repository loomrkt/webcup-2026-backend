import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

// Force Node's local timezone to UTC so all Date serialization (TypeORM, pg,
// JSON) is consistent with the Postgres session timezone.
process.env.TZ = 'UTC';

async function bootstrap() {
  console.time('boot');
  const app = await NestFactory.create(AppModule);

  // Gzip les réponses (assets Swagger ~3 Mo -> ~1 Mo, swagger.json, JSON API).
  app.use(compression());

app.enableCors({
  origin: '*',
});

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

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
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'WebCup API',
    swaggerOptions: {
      // Évite le rendu lent des grosses specs : les schémas se déplient
      // à la demande au lieu de tout développer au chargement.
      defaultModelsExpandDepth: -1,
      defaultModelExpandDepth: 1,
    },
  });

  // Neon (serverless) se met en autosuspend après quelques minutes
  // d'inactivité : la 1ère requête subit un cold start de plusieurs
  // secondes. Un ping périodique maintient l'instance éveillée
  // (activable avec DB_KEEP_ALIVE=true, sinon garde le coût Neon nul).
  if (process.env.DB_KEEP_ALIVE === 'true') {
    const dataSource = app.get(DataSource);
    const keepAlive = setInterval(() => {
      dataSource.query('SELECT 1').catch(() => undefined);
    }, 30_000);
    app.enableShutdownHooks();
    process.once('beforeExit', () => clearInterval(keepAlive));
  }

  await app.listen(process.env.PORT ?? 5000);
  console.timeEnd('boot');
}
void bootstrap();
