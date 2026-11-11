// Konfiguration aus der Umgebung
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || 'boxenstopp',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'boxenstopp',
  },
  encryptionKey: env.ENCRYPTION_KEY || '',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  secureCookies: env.SECURE_COOKIES === '1' || env.SECURE_COOKIES === 'true',
  backupDir: env.BACKUP_DIR || '/backups',
  backupRetentionDays: Number(env.BACKUP_RETENTION_DAYS || 14),
  publicDir: env.PUBLIC_DIR || new URL('../public', import.meta.url).pathname,
  tz: env.TZ || 'Europe/Berlin',
  version: '0.2.0',
};

export const ENV_PUBLIC = () => ({
  NODE_ENV: env.NODE_ENV || '',
  APP_PORT: env.APP_PORT || '',
  DB_HOST: config.db.host,
  DB_NAME: config.db.database,
  TRUST_PROXY: config.trustProxy ? '1' : '0',
  ENCRYPTION_KEY: config.encryptionKey ? '•••••••• (gesetzt)' : 'FEHLT',
  BACKUP_RETENTION_DAYS: String(config.backupRetentionDays),
  TZ: config.tz,
});
