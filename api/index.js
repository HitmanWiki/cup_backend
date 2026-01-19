// api/index.js - SIMPLIFIED VERSION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://clutch-dapp.vercel.app'],
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Prisma
const prisma = new PrismaClient();

// Define API prefix and version
const API_PREFIX = '/api';
const API_VERSION = 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// Simple root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      health: '/health',
      debug: `${FULL_API_PATH}/debug`,
      auth: `${FULL_API_PATH}/auth`,
      matches: `${FULL_API_PATH}/matches`,
      bets: `${FULL_API_PATH}/bets`,
      leaderboard: `${FULL_API_PATH}/leaderboard`
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      database: 'connected',
      environment: process.env.NODE_ENV || 'production'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      service: 'clutch-backend'
    });
  }
});

// Debug endpoint
app.get(`${FULL_API_PATH}/debug`, async (req, res) => {
  try {
    // Count matches
    const matchCount = await prisma.match.count();
    
    res.json({
      success: true,
      message: 'API is working!',
      timestamp: new Date().toISOString(),
      stats: {
        matches: matchCount,
        apiVersion: API_VERSION
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple test endpoints
app.get(`${FULL_API_PATH}/test`, (req, res) => {
  res.json({
    success: true,
    message: 'API test endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Try to import routes with error handling
try {
  console.log('Attempting to import routes...');
  
  // Import routes
  const authRoutes = require('./src/routes/auth');
  const matchRoutes = require('./src/routes/matches');
  const betRoutes = require('./src/routes/bets');
  const leaderboardRoutes = require('./src/routes/leaderboard');
  const adminRoutes = require('./src/routes/admin');
  
  // Mount routes
  app.use(`${FULL_API_PATH}/auth`, authRoutes);
  app.use(`${FULL_API_PATH}/matches`, matchRoutes);
  app.use(`${FULL_API_PATH}/bets`, betRoutes);
  app.use(`${FULL_API_PATH}/leaderboard`, leaderboardRoutes);
  app.use(`${FULL_API_PATH}/admin`, adminRoutes);
  
  console.log('✅ Routes imported successfully');
  
} catch (error) {
  console.error('❌ Error importing routes:', error.message);
  
  // Create fallback routes
  app.get(`${FULL_API_PATH}/auth/test`, (req, res) => {
    res.json({ message: 'Auth route fallback' });
  });
  
  app.get(`${FULL_API_PATH}/matches/test`, (req, res) => {
    res.json({ message: 'Matches route fallback' });
  });
}

// Matches endpoints (basic implementation)
app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const matches = await prisma.match.findMany({
      where: {
        status: 'upcoming',
        match_date: {
          gt: new Date()
        }
      },
      take: limit,
      orderBy: { match_date: 'asc' },
      include: {
        teamA: true,
        teamB: true
      }
    });
    
    res.json({
      success: true,
      data: matches,
      count: matches.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get(`${FULL_API_PATH}/matches/all`, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    
    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        skip,
        take: limit,
        orderBy: { match_date: 'asc' },
        include: {
          teamA: true,
          teamB: true
        }
      }),
      prisma.match.count()
    ]);
    
    res.json({
      success: true,
      data: matches,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requested: req.originalUrl,
    availableRoutes: [
      '/',
      '/health',
      `${FULL_API_PATH}/debug`,
      `${FULL_API_PATH}/test`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/matches/all`
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Log startup
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • Team USA Mascot                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    Deployment: Vercel Serverless                             ║
║    Database: PostgreSQL (Prisma)                             ║
║    API Version: ${API_VERSION.padEnd(37)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Export for Vercel
module.exports = app;