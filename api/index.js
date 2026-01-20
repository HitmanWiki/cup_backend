// api/index.js - FOCUSED ON REAL API DATA FLOW
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();

// Import configurations
const { constants, validateConfig } = require('./src/config/constants');
const database = require('./src/config/database');
const web3Service = require('./src/services/web3Service');
const AuthMiddleware = require('./src/middleware/auth');
const logger = require('./src/utils/logger');

// Import routes
const authRoutes = require('./src/routes/auth');
const matchRoutes = require('./src/routes/matches');
const betRoutes = require('./src/routes/bets');
const leaderboardRoutes = require('./src/routes/leaderboard');
const adminRoutes = require('./src/routes/admin');

// Import data services - CRITICAL FOR API FLOW
const DataSyncService = require('./src/services/dataSyncService');
const SportsDataService = require('./src/services/sportsDataService');

// Service instances
let sportsDataService = null;
let dataSyncService = null;

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
      connectSrc: ["'self'", process.env.RPC_URL_BASE || '', constants.EXTERNAL_APIS.SPORTS_DATA || '']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - UPDATED with your frontend domain
const corsOptions = {
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(AuthMiddleware.requestLogger());

// Rate limiting
app.use('/api/', AuthMiddleware.rateLimit(200, 15 * 60 * 1000));

// ==================== ROUTES ====================
// Mount API routes
app.use(`${FULL_API_PATH}/auth`, authRoutes);
app.use(`${FULL_API_PATH}/matches`, matchRoutes);
app.use(`${FULL_API_PATH}/bets`, betRoutes);
app.use(`${FULL_API_PATH}/leaderboard`, leaderboardRoutes);
app.use(`${FULL_API_PATH}/admin`, adminRoutes);

console.log(`✅ Routes mounted at ${FULL_API_PATH}`);

// ==================== INITIALIZATION FUNCTION ====================
async function initializeBackend() {
  try {
    console.log('🔄 Initializing backend with REAL API data...');
    
    // 1. Validate configuration
    validateConfig();
    
    // 2. Initialize database
    await database.connect();
    console.log('✅ Database connected');
    
    // 3. Initialize blockchain
    try {
      await web3Service.initialize();
      console.log('✅ Blockchain service initialized');
    } catch (error) {
      console.warn('⚠️ Blockchain service not available:', error.message);
    }
    
    // 4. INITIALIZE SPORTS DATA SERVICE - CRITICAL STEP
    console.log('📡 Initializing sports data service...');
    
    // Check if API key exists
    if (!process.env.SPORTS_DATA_API_KEY || process.env.SPORTS_DATA_API_KEY === 'your_sports_data_api_key') {
      console.warn('❌ SPORTS_DATA_API_KEY not configured in .env file');
      console.warn('   Please add your SportsData.io API key to .env');
      console.warn('   Using fallback mode - no real match data');
    } else {
      // Initialize with real API
      sportsDataService = new SportsDataService();
      
      // Test API connection
      console.log('🔄 Testing API connection...');
      try {
        const isConnected = await sportsDataService.testConnection();
        
        if (isConnected) {
          console.log('✅ Sports API connection successful');
          
          // Initialize data sync service
          dataSyncService = new DataSyncService(sportsDataService);
          
          // PERFORM INITIAL DATA SYNC - FETCH FROM API AND STORE IN DB
          console.log('🔄 Performing initial data sync from API...');
          const syncResult = await dataSyncService.syncMatches();
          
          if (syncResult.success) {
            console.log(`✅ Initial sync successful: ${syncResult.total || 0} matches fetched from API`);
            console.log(`✅ ${syncResult.added || 0} new matches added to database`);
            console.log(`✅ ${syncResult.updated || 0} matches updated`);
            
            // Schedule automatic syncs
            scheduleDataSyncTasks();
          } else {
            console.warn(`⚠️ Initial sync had issues: ${syncResult.message}`);
          }
        } else {
          console.warn('❌ Could not connect to Sports API');
          console.warn('   Check your API key and internet connection');
        }
      } catch (apiError) {
        console.error('❌ API connection error:', apiError.message);
        console.warn('⚠️ Running without external match data');
      }
    }
    
    console.log('✅ Backend initialization complete');
    
  } catch (error) {
    console.error('❌ Backend initialization failed:', error.message);
    // Server should still start
  }
}

// ==================== DATA SYNC ENDPOINTS ====================
// Manual data sync endpoint (for testing)
app.get('/api/admin/sync-data', async (req, res) => {
  try {
    console.log('🔄 Manual data sync requested');
    
    if (!dataSyncService) {
      return res.status(400).json({
        success: false,
        error: 'Data sync service not initialized. Check API key configuration.'
      });
    }
    
    console.log('📡 Fetching data from Sports API...');
    const result = await dataSyncService.syncMatches();
    
    res.json({
      success: true,
      message: 'Data sync completed',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API status endpoint
app.get('/api/v4/status', async (req, res) => {
  try {
    const Match = require('../src/models/Match');
    const matchCount = await Match.getCountByStatus();
    const totalMatches = matchCount.reduce((a, b) => a + b.count, 0);
    
    res.json({
      success: true,
      status: {
        database: 'connected',
        sportsApi: sportsDataService ? 'available' : 'unavailable',
        usingRealData: !(sportsDataService?.usingGeneratedData),
        totalMatchesInDb: totalMatches,
        matchesByStatus: matchCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to see raw API data
app.get('/api/v4/debug/api-raw', async (req, res) => {
  try {
    if (!sportsDataService) {
      return res.json({
        success: false,
        error: 'Sports data service not initialized',
        apiKeyConfigured: !!process.env.SPORTS_DATA_API_KEY
      });
    }
    
    // Try to fetch directly from API
    const matches = await sportsDataService.fetchWorldCupMatches();
    
    res.json({
      success: true,
      apiKeyConfigured: !!process.env.SPORTS_DATA_API_KEY,
      totalMatchesFromApi: matches.length,
      sampleMatches: matches.slice(0, 3),
      usingGeneratedData: sportsDataService.usingGeneratedData
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      apiKeyConfigured: !!process.env.SPORTS_DATA_API_KEY,
      apiUrl: process.env.SPORTS_DATA_API_URL
    });
  }
});

// ==================== SCHEDULED TASKS ====================
function scheduleDataSyncTasks() {
  if (!dataSyncService) return;
  
  // Sync matches every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('🔄 Scheduled data sync starting...');
      const result = await dataSyncService.syncMatches();
      console.log(`✅ Scheduled sync completed: ${result.total || 0} matches`);
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error.message);
    }
  });
  
  // Update match results every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('🔄 Checking for match results...');
      const Match = require('../src/models/Match');
      const updated = await Match.updateMatchResults();
      if (updated > 0) {
        console.log(`✅ Updated ${updated} match results`);
      }
    } catch (error) {
      console.error('❌ Result update failed:', error.message);
    }
  });
  
  console.log('✅ Scheduled tasks initialized');
}

// ==================== BASIC ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    dataSource: sportsDataService ? (sportsDataService.usingGeneratedData ? 'generated' : 'real API') : 'unknown',
    endpoints: {
      status: '/api/v4/status',
      manualSync: '/api/admin/sync-data',
      debugApi: '/api/v4/debug/api-raw',
      matches: '/api/v4/matches',
      bets: '/api/v4/bets',
      leaderboard: '/api/v4/leaderboard'
    },
    note: process.env.SPORTS_DATA_API_KEY ? 'API key configured' : '⚠️ API key missing in .env'
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
      sportsApi: sportsDataService ? 'initialized' : 'not initialized',
      usingRealData: sportsDataService && !sportsDataService.usingGeneratedData
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      service: 'clutch-backend'
    });
  }
});

// ==================== ERROR HANDLING ====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requested: req.originalUrl,
    availableRoutes: [
      '/',
      '/health',
      '/api/v4/status',
      '/api/admin/sync-data',
      '/api/v4/debug/api-raw',
      '/api/v4/matches/all',
      '/api/v4/matches/upcoming',
      '/api/v4/matches/groups'
    ]
  });
});

app.use(AuthMiddleware.errorHandler());

// ==================== START SERVER ====================
// Initialize backend on startup
initializeBackend();

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • REAL API DATA FLOW                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API Version: ${API_VERSION.padEnd(37)}║
║    ✅ Environment: ${(process.env.NODE_ENV || 'production').padEnd(38)}║
║    ✅ Base URL: ${FULL_API_PATH.padEnd(39)}║
║    ✅ Data Flow: API → Database → Frontend                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('📋 Critical Endpoints for Debugging:');
console.log(`   1. API Status: https://cup-backend-red.vercel.app/api/v4/status`);
console.log(`   2. Force Sync: https://cup-backend-red.vercel.app/api/admin/sync-data`);
console.log(`   3. Debug API: https://cup-backend-red.vercel.app/api/v4/debug/api-raw`);
console.log(`   4. Health: https://cup-backend-red.vercel.app/health`);
console.log('');
console.log('🔑 API Key Status:', process.env.SPORTS_DATA_API_KEY ? '✅ Configured' : '❌ MISSING');
if (!process.env.SPORTS_DATA_API_KEY) {
  console.log('');
  console.log('⚠️  IMPORTANT: To fetch real match data:');
  console.log('   1. Get API key from SportsData.io');
  console.log('   2. Add to .env file: SPORTS_DATA_API_KEY=your_key_here');
  console.log('   3. Redeploy to Vercel');
}

module.exports = app;