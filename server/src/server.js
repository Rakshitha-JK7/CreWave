const app = require('./app');
const config = require('./config/config');
const db = require('./models/db');

async function startServer() {
  try {
    // Initialize database tables and connection
    await db.init();

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log('================================================================');
      console.log('   CareWave Telemedicine Backend - Server Running');
      console.log('================================================================');
      console.log(` * Local URL:        http://localhost:${config.port}`);
      console.log(` * API Prefix:       ${config.apiPrefix}`);
      console.log(` * Environment:      ${config.nodeEnv}`);
      console.log(` * Database:         ${db.getType().toUpperCase()}`);
      console.log(` * Health/Ping:      http://localhost:${config.port}/api/health`);
      console.log(` * Patients API:     http://localhost:${config.port}/api/patients`);
      console.log(` * Consultations:    http://localhost:${config.port}/api/consultations`);
      console.log(` * Doctor Queue:     http://localhost:${config.port}/api/doctor/consultations`);
      console.log(` * Chunked Uploads:  http://localhost:${config.port}/api/uploads/init`);
      console.log(` * Clinic Sync:      http://localhost:${config.port}/api/sync/responses`);
      console.log(` * Auth API:         http://localhost:${config.port}/api/auth/login`);
      console.log('================================================================');
    });

    // Graceful shutdown
    const handleShutdown = (signal) => {
      console.log(`\nReceived ${signal}. Shutting down CareWave server gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    return server;
  } catch (err) {
    console.error('Failed to start CareWave server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
