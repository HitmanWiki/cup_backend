// api/index.js - PRISMA VERSION FOR VERCEL
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');

const app = express();

// Import configurations
const { constants, validateConfig } = require('./src/config/constants');
const AuthMiddleware = require('./src/middleware/auth');
const logger = require('./src/utils/logger');

// Import Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import routes
const authRoutes = require('./src/routes/auth');
const matchRoutes = require('./src/routes/matches');
const betRoutes = require('./src/routes/bets');
const leaderboardRoutes = require('./src/routes/leaderboard');
const adminRoutes = require('./src/routes/admin');

// Import services
const DataSyncService = require('./src/services/dataSyncService');
const SportsDataService = require('./src/services/sportsDataService');
const web3Service = require('./src/services/web3Service');

// Define API prefix and version
const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// Global variables
let sportsDataService = null;
let dataSyncService = null;
let isInitialized = false;

// Initialize function
async function initializeBackend() {
  if (isInitialized) return;
  
  try {
    console.log('🔄 Initializing CLUTCH Backend with Prisma...');
    
    // Validate configuration
    validateConfig();
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Prisma connected to database');
    
    // Initialize blockchain (optional)
    try {
      await web3Service.initialize();
      console.log('✅ Blockchain service initialized');
    } catch (error) {
      console.log('⚠️ Blockchain service not available:', error.message);
    }
    
    // Initialize external data services
    if (process.env.SPORTS_DATA_API_KEY && process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key') {
      try {
        console.log('🔗 Connecting to sports data API...');
        sportsDataService = new SportsDataService();
        
        // Test connection
        const isConnected = await sportsDataService.testConnection();
        
        if (isConnected) {
          console.log('✅ Connected to sports data API');
          dataSyncService = new DataSyncService(sportsDataService, prisma);
          
          // Initial sync
          try {
            const syncResult = await dataSyncService.syncMatches();
            console.log(`✅ Initial data sync: ${syncResult.total || 0} matches`);
          } catch (syncError) {
            console.log('⚠️ Initial sync failed:', syncError.message);
          }
        } else {
          console.log('⚠️ Using generated match data');
          sportsDataService.usingGeneratedData = true;
          dataSyncService = new DataSyncService(sportsDataService, prisma);
          await dataSyncService.syncMatches();
        }
      } catch (error) {
        console.log('⚠️ Sports data service error:', error.message);
        sportsDataService = new SportsDataService();
        sportsDataService.usingGeneratedData = true;
        dataSyncService = new DataSyncService(sportsDataService, prisma);
        await dataSyncService.syncMatches();
      }
    } else {
      console.log('📋 Using generated World Cup 2026 data');
      sportsDataService = new SportsDataService();
      sportsDataService.usingGeneratedData = true;
      dataSyncService = new DataSyncService(sportsDataService, prisma);
      await dataSyncService.syncMatches();
    }
    
    isInitialized = true;
    console.log('✅ Backend initialization complete');
    
  } catch (error) {
    console.error('❌ Backend initialization failed:', error);
    // Don't throw - server should still start
  }
}

// Initialize before first request
initializeBackend();

// ==================== MIDDLEWARE ====================
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.RPC_URL_BASE || '']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://clutch-dapp.vercel.app'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add prisma to request object
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});
app.use('/api/', limiter);

// ==================== ROUTES ====================
// Mount API routes
app.use(`${FULL_API_PATH}/auth`, authRoutes);
app.use(`${FULL_API_PATH}/matches`, matchRoutes);
app.use(`${FULL_API_PATH}/bets`, betRoutes);
app.use(`${FULL_API_PATH}/leaderboard`, leaderboardRoutes);
app.use(`${FULL_API_PATH}/admin`, adminRoutes);

// ==================== ENDPOINTS ====================
// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    database: 'PostgreSQL (Prisma)',
    endpoints: {
      health: '/health',
      debug: `${FULL_API_PATH}/debug/matches`,
      auth: `${FULL_API_PATH}/auth`,
      matches: `${FULL_API_PATH}/matches`,
      bets: `${FULL_API_PATH}/bets`,
      leaderboard: `${FULL_API_PATH}/leaderboard`,
      admin: `${FULL_API_PATH}/admin`
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    let sportsDataStatus = 'not_configured';
    if (sportsDataService) {
      try {
        const sportsHealth = await sportsDataService.healthCheck();
        sportsDataStatus = sportsHealth.status === 'healthy' ? 'connected' : 'generated';
      } catch (error) {
        sportsDataStatus = 'error';
      }
    }
    
    // Test blockchain if configured
    let blockchainStatus = 'not_configured';
    if (process.env.RPC_URL) {
      try {
        const web3Health = await web3Service.healthCheck();
        blockchainStatus = web3Health.status;
      } catch (error) {
        blockchainStatus = 'error';
      }
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      initialized: isInitialized,
      services: {
        database: 'connected',
        sports_data: sportsDataStatus,
        blockchain: blockchainStatus
      },
      environment: process.env.NODE_ENV || 'production'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'degraded',
      error: error.message,
      service: 'clutch-backend'
    });
  }
});

// Debug endpoints
app.get(`${FULL_API_PATH}/debug/matches`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      take: 10,
      orderBy: { match_date: 'asc' },
      include: {
        teamA: true,
        teamB: true
      }
    });
    
    const upcoming = await prisma.match.findMany({
      where: {
        status: 'upcoming',
        match_date: {
          gt: new Date()
        }
      },
      take: 10,
      orderBy: { match_date: 'asc' },
      include: {
        teamA: true,
        teamB: true
      }
    });
    
    const totalMatches = await prisma.match.count();
    
    res.json({
      success: true,
      data: {
        totalMatches,
        upcomingCount: upcoming.length,
        allMatchesCount: matches.length,
        upcomingMatches: upcoming,
        sampleMatches: matches
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
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

// ==================== VERCEl SPECIFIC CONFIGURATION ====================
// Prisma needs to generate client on Vercel
if (process.env.VERCEL) {
  console.log('Running on Vercel - ensuring Prisma client is ready...');
  // The prisma client should be generated during build
}

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
║    Environment: ${(process.env.NODE_ENV || 'production').padEnd(38)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Export the app for Vercel
module.exports = app;