import { lookup } from 'dns/promises';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export { ConfigModule, ConfigService };
export const typeOrmModule = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    // Lit via ConfigService, avec repli sur process.env
    const databaseUrl =
      config.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is not defined. Check your .env file or the environment variables of the server.',
      );
    }

    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error(
        'DATABASE_URL is not a valid URL (expected: postgresql://user:pass@host:5432/db).',
      );
    }

    // The pg driver keeps the first DNS answer: on hosts where IPv6 is
    // returned first, the pooler connection dies with a fast ETIMEDOUT
    // before any fallback. We resolve an IPv4 address ourselves and
    // connect to it directly.
    const { address } = await lookup(url.hostname, { family: 4 });

    const options = ['-c timezone=UTC'];
    if (url.hostname.endsWith('.neon.tech')) {
      // Neon's pooler requires the endpoint ID (first label of the
      // hostname) when the TLS SNI cannot carry it (IP connection).
      options.push(`endpoint=${url.hostname.split('.')[0]}`);
    }

    return {
      type: 'postgres' as const,
      host: address,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.slice(1),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: true,
      // Désactivé par défaut : synchronize rejoue du DDL sur chaque boot
      // (très lent sur une DB distante, 43 entités). À activer
      // explicitement en local uniquement (DB_SYNCHRONIZE=true).
      synchronize:
        String(config.get('DB_SYNCHRONIZE', 'false')).toLowerCase() === 'true',
      // Échoue vite plutôt que de réessayer 10× (défaut) pendant ~40 s.
      retryAttempts: 3,
      retryDelay: 1000,
      extra: { options: options.join(' ') },
    };
  },
});
