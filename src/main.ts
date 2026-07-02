import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';
import { SocksClient } from 'socks';
import * as tls from 'tls';
import { AppModule } from './app.module';
import { AppConfig } from '@shared/infrastructure/config/configuration';
import { LoggingInterceptor } from '@shared/interface/logging.interceptor';

const startupLogger = new Logger('Proxy');
const proxyUrl =
  process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.https_proxy ?? process.env.http_proxy;

if (proxyUrl) {
  const url = new URL(proxyUrl);
  if (url.protocol === 'socks5:' || url.protocol === 'socks:') {
    const socksHost = url.hostname;
    const socksPort = Number(url.port);
    setGlobalDispatcher(
      new Agent({
        connect: (options, callback) => {
          SocksClient.createConnection(
            {
              proxy: { host: socksHost, port: socksPort, type: 5 },
              command: 'connect',
              destination: { host: options.hostname, port: Number(options.port) },
            },
            (err, info) => {
              if (err || !info) return callback(err ?? new Error('SOCKS5 no info'), null);
              if (options.protocol === 'https:') {
                const tlsSocket = tls.connect({
                  socket: info.socket,
                  host: options.hostname,
                  servername: options.servername ?? options.hostname,
                });
                tlsSocket.once('error', (e) => callback(e, null));
                tlsSocket.once('secureConnect', () => callback(null, tlsSocket));
              } else {
                callback(null, info.socket);
              }
            },
          );
        },
      }),
    );
    startupLogger.log(`SOCKS5 proxy active: ${socksHost}:${socksPort}`);
  } else {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    startupLogger.log(`HTTP proxy active: ${proxyUrl}`);
  }
} else {
  startupLogger.warn('No HTTPS_PROXY set — outbound fetch goes direct (may fail if api.anthropic.com is blocked)');
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  });

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('W&I AI Service')
    .setDescription(
      'AI microservice for the W&I insurance platform: warranty parsing & 4-bucket ' +
        'categorisation, exclusion-impact mapping, and coverage-position suggestions powered ' +
        'by a pgvector learning loop. Consumed by the panel/portal over the service API key.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'service-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`W&I AI service running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
void bootstrap();
