import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { readRuntimeConfig } from './config/runtime-config';
import { createStartupMessage } from './startup-message';

async function bootstrap() {
  const config = readRuntimeConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Rate limiting keys on the client IP. Trust forwarded headers only when an
  // operator explicitly configures the proxies in front of this service.
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxy);
  app.use(helmet());
  const allowedOrigins = config.frontendOrigins.length
    ? config.frontendOrigins
    : ['http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:8080'];
  app.enableCors({ origin: allowedOrigins, credentials: false });
  const apiPrefix = config.apiPrefix;
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SalamaLine API')
    .setDescription('Safeguarding-first API. Never submit emergency requests expecting this API to contact emergency services automatically.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerPath = 'docs';
  const swaggerEnabled = config.swaggerEnabled;
  if (swaggerEnabled) {
    SwaggerModule.setup(swaggerPath, app, SwaggerModule.createDocument(app, swaggerConfig));
  }
  const port = config.port;
  const configuredHost = process.env.HOST;
  try {
    if (configuredHost) {
      await app.listen(port, configuredHost);
    } else {
      await app.listen(port);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
      console.error(
        `\nSalamaLine could not start: port ${port} is already in use. ` +
          `A backend may already be running. Check with: lsof -nP -iTCP:${port} -sTCP:LISTEN\n`,
      );
    } else {
      console.error('\nSalamaLine failed to bind the HTTP server:', error, '\n');
    }
    await app.close().catch(() => undefined);
    process.exit(1);
  }
  const address = app.getHttpServer().address();
  const actualPort = address && typeof address !== 'string' ? address.port : port;
  const host = configuredHost || (address && typeof address !== 'string' ? address.address : 'localhost');
  console.info(`\n${createStartupMessage({
    version: '1.0.0',
    host,
    port: actualPort,
    apiPrefix,
    swaggerPath,
    swaggerEnabled,
  })}\n`);
}
bootstrap().catch((error: unknown) => {
  console.error('\nSalamaLine failed to start:', error, '\n');
  process.exit(1);
});
