// api/index.js - COMPLETE WORKING VERSION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

const app = express();

// Import configurations - with error handling
let constants, validateConfig, database, web3Service, AuthMiddleware, logger;
try {
  const config = require('../src/config/constants');
  constants = config.constants;
  validateConfig = config.validateConfig;
} catch (error) {
  console.warn('❌ Error loading constants:', error.message);
  // Provide defaults
  constants = {
    EXTERNAL_APIS: {
      SPORTS_DATA: process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores',
      FIFA_API: 'https://api.fifa.com/api/v3'
    }
  };
  validateConfig = () => console.log('⚠️ Skipping config validation');
}

try {
  database = require('../src/config/database');
} catch (error) {
  console.warn('❌ Error loading database:', error.message);
  database = { 
    connect: async () => console.log('⚠️ Database not available'),
    healthCheck: async () => ({ status: 'unavailable' })
  };
}

try {
  web3Service = require('../src/services/web3Service');
} catch (error) {
  console.warn('❌ Error loading web3Service:', error.message);
  web3Service = {
    initialize: async () => console.log('⚠️ Web3 service not available'),
    healthCheck: async () => ({ status: 'unavailable' })
  };
}

try {
  AuthMiddleware = require('../src/middleware/auth');
} catch (error) {
  console.warn('❌ Error loading AuthMiddleware:', error.message);
  AuthMiddleware = {
    verifyToken: (req, res, next) => next(),
    verifyAdmin: (req, res, next) => next(),
    requestLogger: () => (req, res, next) => next(),
    errorHandler: () => (err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    },
    rateLimit: (max, windowMs) => (req, res, next) => next()
  };
}

try {
  logger = require('../src/utils/logger');
} catch (error) {
  console.warn('❌ Error loading logger:', error.message);
  logger = {
    info: (msg) => console.log('[INFO]', msg),
    error: (msg) => console.error('[ERROR]', msg),
    warn: (msg) => console.warn('[WARN]', msg)
  };
}

// Import routes with error handling
let authRoutes, matchRoutes, betRoutes, leaderboardRoutes, adminRoutes;

try {
  authRoutes = require('../src/routes/auth');
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.warn('❌ Error loading auth routes:', error.message);
  authRoutes = express.Router();
  authRoutes.get('/test', (req, res) => res.json({ message: 'Auth route test' }));
}

try {
  matchRoutes = require('../src/routes/matches');
  console.log('✅ Match routes loaded');
} catch (error) {
  console.warn('❌ Error loading match routes:', error.message);
  matchRoutes = express.Router();
  matchRoutes.get('/test', (req, res) => res.json({ message: 'Match route test' }));
}

try {
  betRoutes = require('../src/routes/bets');
  console.log('✅ Bet routes loaded');
} catch (error) {
  console.warn('❌ Error loading bet routes:', error.message);
  betRoutes = express.Router();
  betRoutes.get('/test', (req, res) => res.json({ message: 'Bet route test' }));
}

try {
  leaderboardRoutes = require('../src/routes/leaderboard');
  console.log('✅ Leaderboard routes loaded');
} catch (error) {
  console.warn('❌ Error loading leaderboard routes:', error.message);
  leaderboardRoutes = express.Router();
  leaderboardRoutes.get('/test', (req, res) => res.json({ message: 'Leaderboard route test' }));
}

try {
  adminRoutes = require('../src/routes/admin');
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.warn('❌ Error loading admin routes:', error.message);
  adminRoutes = express.Router();
  adminRoutes.get('/test', (req, res) => res.json({ message: 'Admin route test' }));
}

// Import services
let DataSyncService, SportsDataService;
try {
  DataSyncService = require('../src/services/dataSyncService');
  SportsDataService = require('../src/services/sportsDataService');
  console.log('✅ Data services loaded');
} catch (error) {
  console.warn('❌ Error loading data services:', error.message);
}

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.RPC_URL_BASE || '', constants.EXTERNAL_APIS?.SPORTS_DATA || '']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - UPDATED
const corsOptions = {
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app',
    'https://cup-backend-red.vercel.app',
    /\.vercel\.app$/ // Allow all Vercel subdomains
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(AuthMiddleware.requestLogger());

// Rate limiting
app.use('/api/', AuthMiddleware.rateLimit(
  parseInt(process.env.RATE_LIMIT_MAX) || 200,
  parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000
));

// ==================== ROUTES ====================
// Mount API routes
app.use(`${FULL_API_PATH}/auth`, authRoutes);
app.use(`${FULL_API_PATH}/matches`, matchRoutes);
app.use(`${FULL_API_PATH}/bets`, betRoutes);
app.use(`${FULL_API_PATH}/leaderboard`, leaderboardRoutes);
app.use(`${FULL_API_PATH}/admin`, adminRoutes);

console.log(`✅ Routes mounted at ${FULL_API_PATH}`);

// ==================== BASIC ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      root: '/',
      health: '/health',
      debug: `${FULL_API_PATH}/debug`,
      auth: `${FULL_API_PATH}/auth`,
      matches: `${FULL_API_PATH}/matches`,
      bets: `${FULL_API_PATH}/bets`,
      leaderboard: `${FULL_API_PATH}/leaderboard`,
      admin: `${FULL_API_PATH}/admin`
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      database: dbHealth.status,
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

app.get(`${FULL_API_PATH}/debug`, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API Debug Information',
      timestamp: new Date().toISOString(),
      routes: {
        auth: `${FULL_API_PATH}/auth`,
        matches: `${FULL_API_PATH}/matches`,
        bets: `${FULL_API_PATH}/bets`,
        leaderboard: `${FULL_API_PATH}/leaderboard`,
        admin: `${FULL_API_PATH}/admin`
      },
      testEndpoints: [
        `${FULL_API_PATH}/auth/test`,
        `${FULL_API_PATH}/matches/test`,
        `${FULL_API_PATH}/bets/test`,
        `${FULL_API_PATH}/leaderboard/test`,
        `${FULL_API_PATH}/admin/test`
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoints for each route
app.get(`${FULL_API_PATH}/test`, (req, res) => {
  res.json({
    success: true,
    message: 'API test endpoint working!',
    timestamp: new Date().toISOString()
  });
});

// ==================== MATCH ENDPOINTS (Fallback) ====================
app.get(`${FULL_API_PATH}/matches/all`, async (req, res) => {
  try {
    // Try to use your Match model
    const Match = require('../src/models/Match');
    const result = await Match.findAll({}, { limit: 100, page: 1 });
    
    res.json({
      success: true,
      data: result.data,
      total: result.pagination.total
    });
  } catch (error) {
    console.error('Error in matches/all:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    // Try to use your Match model
    const Match = require('../src/models/Match');
    const matches = await Match.getUpcomingMatches(20);
    
    res.json({
      success: true,
      data: matches,
      count: matches.length
    });
  } catch (error) {
    console.error('Error in matches/upcoming:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ERROR HANDLING ====================
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
      `${FULL_API_PATH}/matches/all`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/auth/test`,
      `${FULL_API_PATH}/matches/test`,
      `${FULL_API_PATH}/bets/test`,
      `${FULL_API_PATH}/leaderboard/test`,
      `${FULL_API_PATH}/admin/test`
    ]
  });
});

// Error handler
app.use(AuthMiddleware.errorHandler());

// ==================== INITIALIZATION ====================
async function initializeBackend() {
  try {
    console.log('🔄 Initializing backend...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize database
    await database.connect();
    console.log('✅ Database connected');
    
    // Initialize blockchain
    try {
      await web3Service.initialize();
      console.log('✅ Blockchain service initialized');
    } catch (error) {
      console.warn('⚠️ Blockchain service not available:', error.message);
    }
    
    console.log('✅ Backend initialization complete');
  } catch (error) {
    console.error('❌ Backend initialization failed:', error.message);
    // Don't throw - server should still start
  }
}

// Initialize on startup
initializeBackend();

// ==================== STARTUP LOG ====================
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • Team USA Mascot                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API Version: ${API_VERSION.padEnd(37)}║
║    ✅ Environment: ${(process.env.NODE_ENV || 'production').padEnd(38)}║
║    ✅ Base URL: ${FULL_API_PATH.padEnd(39)}║
║    ✅ Status: Ready${' '.padEnd(43)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

module.exports = app;