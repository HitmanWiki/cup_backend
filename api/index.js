// api/index.js - UPDATED FOR VERCEL DEPLOYMENT
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://your-frontend.vercel.app'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes from your main backend
const authRoutes = require('../src/routes/auth');
const matchRoutes = require('../src/routes/matches');
const betRoutes = require('../src/routes/bets');
const leaderboardRoutes = require('../src/routes/leaderboard');
const adminRoutes = require('../src/routes/admin');

// Import middleware
const AuthMiddleware = require('../src/middleware/auth');
const logger = require('../src/utils/logger');

// Import database
const database = require('../src/config/database');

// Use the API prefix from your server.js
const API_PREFIX = '/api';
const API_VERSION = 'v4';

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    let dbHealth = { status: 'unknown' };
    try {
      dbHealth = await database.healthCheck();
    } catch (dbError) {
      logger.error('Database health check failed:', dbError);
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      environment: process.env.NODE_ENV || 'production',
      version: API_VERSION,
      services: {
        database: dbHealth.status
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'degraded',
      error: error.message,
      service: 'clutch-backend'
    });
  }
});

// Debug endpoints (similar to server.js)
app.get('/api/debug/matches', async (req, res) => {
  try {
    // Import only when needed
    const Match = require('../src/models/Match');
    const result = await Match.findAll({}, { limit: 100, page: 1 });
    
    res.json({
      success: true,
      data: result.data,
      total: result.pagination.total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Routes with the correct prefix
app.use(`${API_PREFIX}/${API_VERSION}/auth`, authRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/matches`, matchRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/bets`, betRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/leaderboard`, leaderboardRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/admin`, adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    endpoints: {
      health: '/health',
      debug: '/api/debug/matches',
      auth: `/api/${API_VERSION}/auth`,
      matches: `/api/${API_VERSION}/matches`,
      bets: `/api/${API_VERSION}/bets`,
      leaderboard: `/api/${API_VERSION}/leaderboard`
    }
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      '/health',
      '/api/debug/matches',
      `/api/${API_VERSION}/auth`,
      `/api/${API_VERSION}/matches`,
      `/api/${API_VERSION}/bets`,
      `/api/${API_VERSION}/leaderboard`
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize database connection when server starts
async function initializeApp() {
  try {
    await database.connect();
    logger.info('Database connection established for Vercel deployment');
    
    // Check for matches
    const Match = require('../src/models/Match');
    const matchCount = await Match.getCountByStatus();
    const totalMatches = matchCount.reduce((a, b) => a + b.count, 0);
    logger.info(`Database contains ${totalMatches} matches`);
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    // Don't throw - server should still start
  }
}

// Initialize before first request
initializeApp();

module.exports = app;