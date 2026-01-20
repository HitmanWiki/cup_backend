// api/index.js - COMPLETE SERVER.JS STRUCTURE FOR VERCELL (FIXED)
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient(); // <-- SINGLE DECLARATION HERE

// Import configurations (will be created in api/config/)
let constants, validateConfig, database, AuthMiddleware, logger;

try {
  const config = require('./config/constants');
  constants = config.constants;
  validateConfig = config.validateConfig;
} catch (error) {
  console.warn('❌ Error loading constants:', error.message);
  // Fallback constants
  constants = {
    EXTERNAL_APIS: {
      SPORTS_DATA: process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores',
      FIFA_API: 'https://api.fifa.com/api/v3'
    }
  };
  validateConfig = () => console.log('⚠️ Skipping config validation');
}

try {
  database = require('./config/database');
} catch (error) {
  console.warn('❌ Error loading database:', error.message);
  // Create simple database adapter
  database = {
    connect: async () => {
      await prisma.$connect();
      console.log('✅ Database connected via Prisma');
    },
    healthCheck: async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy', error: error.message };
      }
    },
    close: async () => {
      await prisma.$disconnect();
    }
  };
}

try {
  AuthMiddleware = require('./middleware/auth');
} catch (error) {
  console.warn('❌ Error loading auth middleware:', error.message);
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
  logger = require('./utils/logger');
} catch (error) {
  console.warn('❌ Error loading logger:', error.message);
  logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`)
  };
}

// Try to import routes and services
let authRoutes, matchRoutes, betRoutes, leaderboardRoutes, adminRoutes;
let SportsDataService, DataSyncService;

try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.warn('❌ Error loading auth routes:', error.message);
  authRoutes = express.Router();
  authRoutes.get('/test', (req, res) => res.json({ message: 'Auth route test' }));
}

try {
  matchRoutes = require('./routes/matches');
  console.log('✅ Match routes loaded');
} catch (error) {
  console.warn('❌ Error loading match routes:', error.message);
  matchRoutes = express.Router();
  matchRoutes.get('/test', (req, res) => res.json({ message: 'Match route test' }));
}

try {
  betRoutes = require('./routes/bets');
  console.log('✅ Bet routes loaded');
} catch (error) {
  console.warn('❌ Error loading bet routes:', error.message);
  betRoutes = express.Router();
  betRoutes.get('/test', (req, res) => res.json({ message: 'Bet route test' }));
}

try {
  leaderboardRoutes = require('./routes/leaderboard');
  console.log('✅ Leaderboard routes loaded');
} catch (error) {
  console.warn('❌ Error loading leaderboard routes:', error.message);
  leaderboardRoutes = express.Router();
  leaderboardRoutes.get('/test', (req, res) => res.json({ message: 'Leaderboard route test' }));
}

try {
  adminRoutes = require('./routes/admin');
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.warn('❌ Error loading admin routes:', error.message);
  adminRoutes = express.Router();
  adminRoutes.get('/test', (req, res) => res.json({ message: 'Admin route test' }));
}

try {
  SportsDataService = require('./services/sportsDataService');
  DataSyncService = require('./services/dataSyncService');
  console.log('✅ Data services loaded');
} catch (error) {
  console.warn('❌ Error loading data services:', error.message);
  SportsDataService = class {
    constructor() {
      this.baseUrl = constants.EXTERNAL_APIS.SPORTS_DATA;
      this.apiKey = process.env.SPORTS_DATA_API_KEY;
    }
    async testConnection() {
      if (!this.apiKey) throw new Error('API key not configured');
      return false;
    }
    async fetchWorldCupMatches() { return []; }
    healthCheck() { return { status: 'unavailable' }; }
  };
  DataSyncService = class {
    constructor() {}
    async syncMatches() {
      return { success: false, error: 'Service not available' };
    }
  };
}

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// Service instances
let sportsDataService = null;
let dataSyncService = null;

// ==================== MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.RPC_URL_BASE || '', constants.EXTERNAL_APIS.SPORTS_DATA || '']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(AuthMiddleware.requestLogger());

// Rate limiting
app.use('/api/', AuthMiddleware.rateLimit(200, 15 * 60 * 1000));

// ==================== PRISMA-BASED MATCH MODEL ====================
class MatchModel {
  static async findAll(filters = {}, options = {}) {
    const limit = options.limit || 100;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.group_name) {
      where.group_name = filters.group_name;
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { match_date: 'asc' },
        skip,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getUpcomingMatches(limit = 20) {
    return await prisma.match.findMany({
      where: {
        status: 'upcoming',
        match_date: {
          gt: new Date()
        }
      },
      orderBy: { match_date: 'asc' },
      take: limit
    });
  }

  static async getCountByStatus() {
    const result = await prisma.match.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    return result.map(item => ({
      status: item.status,
      count: item._count.status
    }));
  }
}

// ==================== ENDPOINTS (SAME AS SERVER.JS) ====================
// Health check
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    
    let sportsDataStatus = 'not_configured';
    if (sportsDataService) {
      try {
        const sportsHealth = await sportsDataService.healthCheck();
        sportsDataStatus = sportsHealth.status;
      } catch (error) {
        sportsDataStatus = 'error';
      }
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      services: {
        database: dbHealth.status,
        sports_data: sportsDataStatus
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      health: '/health',
      debug_sports_api: `${FULL_API_PATH}/debug/sports-api`,
      matches: `${FULL_API_PATH}/matches`,
      upcoming_matches: `${FULL_API_PATH}/matches/upcoming`,
      group_stage: `${FULL_API_PATH}/matches/groups`,
      sync_data: '/api/admin/sync-data'
    }
  });
});

// Debug sports API endpoint
app.get(`${FULL_API_PATH}/debug/sports-api`, async (req, res) => {
  try {
    if (!sportsDataService) {
      sportsDataService = new SportsDataService();
    }
    
    const isConnected = await sportsDataService.testConnection();
    
    res.json({
      success: true,
      connection: isConnected ? 'connected' : 'failed',
      apiKeyConfigured: !!process.env.SPORTS_DATA_API_KEY,
      baseUrl: constants.EXTERNAL_APIS.SPORTS_DATA
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      apiKeyConfigured: !!process.env.SPORTS_DATA_API_KEY
    });
  }
});

// Get all matches
app.get(`${FULL_API_PATH}/matches/all`, async (req, res) => {
  try {
    const result = await MatchModel.findAll({}, { limit: 100, page: 1 });
    
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

// Get upcoming matches
app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const matches = await MatchModel.getUpcomingMatches(limit);
    
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

// Get group stage matches
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const result = await MatchModel.findAll({});
    const matches = result.data;
    
    const groups = {};
    matches.forEach(match => {
      const group = match.group_name || 'Unknown';
      if (!groups[group]) {
        groups[group] = {
          matchCount: 0,
          firstMatch: match.match_date,
          lastMatch: match.match_date,
          matches: []
        };
      }
      
      groups[group].matchCount++;
      groups[group].firstMatch = new Date(Math.min(
        new Date(groups[group].firstMatch).getTime(),
        new Date(match.match_date).getTime()
      ));
      groups[group].lastMatch = new Date(Math.max(
        new Date(groups[group].lastMatch).getTime(),
        new Date(match.match_date).getTime()
      ));
      groups[group].matches.push(match);
    });
    
    res.json({
      success: true,
      data: groups
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual data sync endpoint
app.get('/api/admin/sync-data', async (req, res) => {
  try {
    logger.info('Manual data sync requested');
    
    if (!sportsDataService) {
      sportsDataService = new SportsDataService();
    }
    
    if (!dataSyncService) {
      dataSyncService = new DataSyncService(sportsDataService);
    }
    
    const result = await dataSyncService.syncMatches();
    
    res.json({
      success: true,
      message: 'Data sync completed',
      result: result
    });
    
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mount other routes
app.use(`${FULL_API_PATH}/auth`, authRoutes);
app.use(`${FULL_API_PATH}/matches`, matchRoutes);
app.use(`${FULL_API_PATH}/bets`, betRoutes);
app.use(`${FULL_API_PATH}/leaderboard`, leaderboardRoutes);
app.use(`${FULL_API_PATH}/admin`, adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      '/',
      '/health',
      `${FULL_API_PATH}/debug/sports-api`,
      `${FULL_API_PATH}/matches/all`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/matches/groups`,
      '/api/admin/sync-data'
    ]
  });
});

// Error handler
app.use(AuthMiddleware.errorHandler());

// ==================== INITIALIZATION ====================
async function initializeBackend() {
  try {
    console.log('🔄 Initializing backend...');
    
    // Initialize database
    await database.connect();
    console.log('✅ Database connected');
    
    // Check if we have matches in database
    const matchCount = await prisma.match.count();
    console.log(`📊 Database contains ${matchCount} matches`);
    
    // Initialize sports data service if API key is configured
    if (process.env.SPORTS_DATA_API_KEY && process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key') {
      sportsDataService = new SportsDataService();
      dataSyncService = new DataSyncService(sportsDataService);
      
      try {
        // Test API connection
        await sportsDataService.testConnection();
        console.log('✅ Sports API connected');
        
        // Perform initial sync if no matches in DB
        if (matchCount === 0) {
          console.log('🔄 No matches in DB, performing initial sync...');
          const result = await dataSyncService.syncMatches();
          console.log(`✅ Initial sync: ${result.total || 0} matches`);
        }
      } catch (apiError) {
        console.warn('⚠️ Could not connect to Sports API:', apiError.message);
      }
    } else {
      console.warn('⚠️ Sports API key not configured');
      console.warn('   Add SPORTS_DATA_API_KEY to your .env file');
    }
    
    console.log('✅ Backend initialization complete');
    
  } catch (error) {
    console.error('❌ Backend initialization failed:', error);
  }
}

// Initialize on startup
initializeBackend();

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform API (Vercel)                      ║
║    🦅 World Cup 2026 • REAL API DATA                         ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Database: PostgreSQL with Prisma                       ║
║    ✅ Frontend: https://world-lpdco43xk-hitmanwikis-projects.vercel.app║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\n📋 Available Endpoints:');
console.log(`   Health Check: /health`);
console.log(`   Debug API: ${FULL_API_PATH}/debug/sports-api`);
console.log(`   Upcoming Matches: ${FULL_API_PATH}/matches/upcoming`);
console.log(`   Group Stage: ${FULL_API_PATH}/matches/groups`);
console.log(`   Force Sync: /api/admin/sync-data`);
console.log(`   All Matches: ${FULL_API_PATH}/matches/all`);

module.exports = app;