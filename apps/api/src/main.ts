import { createProductSource, createServices } from './composition.ts';
import { ConfigError, loadConfig } from './config/config.ts';
import { buildApp } from './http/app.ts';
import { createLogger } from './logging/create-logger.ts';

/**
 * Composition root (ARCHITECTURE §3.1): reads configuration, builds the
 * adapters and the app, and starts listening. Wiring only, no logic.
 */
async function main(): Promise<void> {
  let loaded;
  try {
    loaded = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      // The logger isn't configured yet; this is the one place we write directly.
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
  const { config, warnings } = loaded;

  const logger = createLogger({ level: config.server.logLevel });
  for (const warning of warnings) {
    logger.warn({ event: warning.event }, warning.message);
  }

  const productSource = await createProductSource(config.productSource, logger);
  const services = createServices({ productSource, logger, catalogue: config.catalogue });
  const app = buildApp({ logger, services, trustProxyHops: config.server.trustProxyHops });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await app.listen({ host: config.server.host, port: config.server.port });
  logger.info({ productSource: config.productSource.kind }, 'API ready');
}

await main();
