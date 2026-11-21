const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',

  // Database
  dbClient: (process.env.DB_CLIENT || 'sqlite').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL,
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'carewave',
  },
  sqlite: {
    dbPath: path.resolve(__dirname, '../../', process.env.SQLITE_DB_PATH || 'carewave.db'),
  },

  // Auth & Security
  jwtSecret: process.env.JWT_SECRET || 'carewave-fallback-dev-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  disableAuth: process.env.DISABLE_AUTH === 'true',

  // Storage / Uploads
  uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
  chunkDir: path.resolve(__dirname, '../../', process.env.CHUNK_DIR || 'uploads/chunks'),
  completedDir: path.resolve(__dirname, '../../', process.env.COMPLETED_DIR || 'uploads/completed'),
  maxChunkSizeMb: parseInt(process.env.MAX_CHUNK_SIZE_MB, 10) || 10,
  defaultChunkSize: parseInt(process.env.DEFAULT_CHUNK_SIZE, 10) || 1048576, // 1MB default
  uploadSessionTtlHours: parseInt(process.env.UPLOAD_SESSION_TTL_HOURS, 10) || 24,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

module.exports = config;
