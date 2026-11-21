const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/config');
const db = require('./models/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const consultationRoutes = require('./routes/consultations');
const doctorRoutes = require('./routes/doctor');
const uploadRoutes = require('./routes/uploads');
const responseRoutes = require('./routes/responses');
const syncRoutes = require('./routes/sync');

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  credentials: true,
}));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file access for completed uploads
app.use('/uploads/completed', express.static(config.completedDir));

// Reachability / Network Ping endpoint (Essential for network latency measurement)
app.get(['/api/health', '/api/ping', '/health', '/ping'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    dbEngine: db.getType(),
    version: '1.0.0',
    service: 'CareWave Rural Telemedicine Backend',
  });
});

// API Routes
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/patients`, patientRoutes);
app.use(`${config.apiPrefix}/consultations`, consultationRoutes);
app.use(`${config.apiPrefix}/doctor`, doctorRoutes);
app.use(`${config.apiPrefix}/uploads`, uploadRoutes);
app.use(`${config.apiPrefix}/responses`, responseRoutes);
app.use(`${config.apiPrefix}/sync`, syncRoutes);

// Catch 404s
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
