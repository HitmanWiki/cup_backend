// api/index.js - VERCEl VERSION OF YOUR SERVER.JS
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

const app = express();

// Import configurations
const { constants, validateConfig } = require('../src/config/constants');
const database = require('../src/config/database');
const web3Service = require('../src/services/web3Service');
const AuthMiddleware = require('../src/middleware/auth');
const logger = require('../src/utils/logger');

// Import routes
const authRoutes = require('../src/routes/auth');
const matchRoutes = require('../src/routes/matches');
const betRoutes = require('../src/routes/bets');
const leaderboardRoutes = require('../src/routes/leaderboard');
const adminRoutes = require('../src/routes/admin');

// Import new services for external data
const DataSyncService = require('../src/services/dataSyncService');
const SportsDataService = require('../src/services/sportsDataService');

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';

// Global variables
let sportsDataService = null;
let dataSyncService = null;
let isInitialized = false;

// Initialize function
async function initializeBackend() {
  if (isInitialized) return;
  
  try {
    logger.info('🔄 Initializing CLUTCH Backend for Vercel...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize database
    await database.connect();
    logger.info('✅ Database connected');
    
    // Initialize blockchain (optional)
    try {
      await web3Service.initialize();
      logger.info('✅ Blockchain service initialized');
    } catch (error) {
      logger.error('Blockchain connection failed:', error);
      logger.warn('Running in read-only mode (blockchain operations disabled)');
    }
    
    // Initialize external data services
    if (process.env.SPORTS_DATA_API_KEY && process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key') {
      try {
        logger.info('🔗 Connecting to sports data API...');
        sportsDataService = new SportsDataService();
        
        // Test connection
        const isConnected = await sportsDataService.testConnection();
        
        if (isConnected) {
          logger.info('✅ Connected to sports data API');
          dataSyncService = new DataSyncService(sportsDataService);
          
          // Initial sync
          try {
            const syncResult = await dataSyncService.syncMatches();
            logger.info(`✅ Initial data sync: ${syncResult.total || 0} matches`);
          } catch (syncError) {
            logger.warn(`Initial sync failed: ${syncError.message}. Using existing/generated data.`);
          }
        } else {
          logger.warn('⚠️ Using generated match data');
          sportsDataService.usingGeneratedData = true;
          dataSyncService = new DataSyncService(sportsDataService);
          await dataSyncService.syncMatches();
        }
      } catch (error) {
        logger.error('❌ Error in external services initialization:', error.message);
        logger.warn('⚠️ Continuing with generated match data...');
        sportsDataService = new SportsDataService();
        sportsDataService.usingGeneratedData = true;
        dataSyncService = new DataSyncService(sportsDataService);
        await dataSyncService.syncMatches();
      }
    } else {
      logger.warn('SPORTS_DATA_API_KEY not found. Using generated data.');
      sportsDataService = new SportsDataService();
      sportsDataService.usingGeneratedData = true;
      dataSyncService = new DataSyncService(sportsDataService);
      await dataSyncService.syncMatches();
    }
    
    isInitialized = true;
    logger.info('✅ Backend initialization complete');
    
  } catch (error) {
    logger.error('Server initialization failed:', error);
    // Don't throw - server should still start
  }
}

// ==================== MIDDLEWARE ====================
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.RPC_URL_BASE, constants.EXTERNAL_APIS.SPORTS_DATA, constants.EXTERNAL_APIS.FIFA_API]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(AuthMiddleware.requestLogger());

// Rate limiting - increased for external API calls
app.use('/api/', AuthMiddleware.rateLimit(
  parseInt(process.env.RATE_LIMIT_MAX) || 200,
  parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000
));

// Static files (if needed)
app.use('/public', express.static(path.join(__dirname, '../public')));

// ==================== ENDPOINTS ====================

// Health check endpoint with service status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const web3Health = await web3Service.healthCheck();
    
    // Check sports data service
    let sportsDataStatus = 'not_configured';
    if (sportsDataService) {
      try {
        const sportsHealth = await sportsDataService.healthCheck();
        sportsDataStatus = sportsHealth.status === 'healthy' ? 'connected' : 'generated';
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
        blockchain: web3Health.status,
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

// Debug endpoints from server.js
app.get('/api/v4/matches/all', async (req, res) => {
  try {
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

app.get('/api/v4/debug/sports-api', async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    
    // Test connection
    await sportsService.testConnection();
    
    // Fetch competitions
    const competitions = await sportsService.fetchCompetitions();
    const worldCup = competitions.find(c => c.CompetitionId === 21);
    
    // Fetch matches
    const matches = await sportsService.fetchWorldCupMatches();
    const upcoming = await sportsService.fetchUpcomingMatches(3);
    const groups = await sportsService.fetchGroupStageMatches();
    
    res.json({
      success: true,
      connection: 'tested',
      competitions: {
        total: competitions.length,
        worldCup: worldCup ? {
          name: worldCup.Name,
          id: worldCup.CompetitionId,
          seasons: worldCup.Seasons?.map(s => s.Season)
        } : null
      },
      matches: {
        total: matches.length,
        upcoming: upcoming.length,
        groups: Object.keys(groups).length
      },
      config: {
        apiKey: process.env.SPORTS_DATA_API_KEY ? '✓ Set' : '✗ Missing',
        baseUrl: process.env.SPORTS_DATA_API_URL
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      config: {
        apiKey: process.env.SPORTS_DATA_API_KEY ? 'Set' : 'Not set',
        baseUrl: process.env.SPORTS_DATA_API_URL
      }
    });
  }
});

app.get('/api/v4/debug/matches', async (req, res) => {
  try {
    const Match = require('../src/models/Match');
    
    // Get all matches
    const allMatches = await Match.findAll();
    
    // Get upcoming matches
    const upcoming = await Match.getUpcomingMatches(10);
    
    res.json({
      success: true,
      data: {
        totalMatches: allMatches.pagination?.total || 0,
        upcomingCount: upcoming.length || 0,
        allMatchesCount: allMatches.data?.length || 0,
        upcomingMatches: upcoming,
        hasGroupNames: allMatches.data?.filter(m => m.group_name).length || 0
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

app.get('/api/v4/debug/db-matches', async (req, res) => {
  try {
    const db = require('../src/config/database');
    
    // Check matches table directly
    const matches = await db.query('SELECT * FROM matches LIMIT 10');
    const count = await db.query('SELECT COUNT(*) as count FROM matches');
    
    res.json({
      success: true,
      inDatabase: count.rows[0].count,
      sampleMatches: matches.rows,
      databasePath: require('path').join(__dirname, '../database/clutch.db')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoints for result detection
app.get('/api/v4/admin/check-finished-matches', async (req, res) => {
  try {
    const ResultDetectorService = require('../src/services/ResultDetectorService');
    const detector = new ResultDetectorService();
    
    const result = await detector.checkFinishedMatches();
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Manual check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/v4/admin/finish-match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { outcome } = req.body;
    
    if (outcome === undefined || outcome < 0 || outcome > 2) {
      return res.status(400).json({
        success: false,
        error: 'Valid outcome required (0=teamA, 1=draw, 2=teamB)'
      });
    }
    
    const ResultDetectorService = require('../src/services/ResultDetectorService');
    const detector = new ResultDetectorService();
    
    const result = await detector.manuallyFinishMatch(parseInt(matchId), parseInt(outcome));
    
    res.json(result);
  } catch (error) {
    logger.error('Manual finish failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint for authentication testing
app.get('/api/v4/debug/auth-test', AuthMiddleware.verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful!',
    user: req.user,
    headers: req.headers
  });
});

// New endpoint: Force data sync
app.get('/api/admin/sync-data', AuthMiddleware.verifyAdmin, async (req, res) => {
  try {
    logger.info('Manual data sync requested by admin');
    
    if (!dataSyncService) {
      throw new Error('Data sync service not initialized');
    }
    
    const result = await dataSyncService.syncMatches();
    
    res.status(200).json({
      success: true,
      message: 'Data sync completed successfully',
      result: result
    });
  } catch (error) {
    logger.error('Manual data sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync data: ' + error.message
    });
  }
});

// ==================== ROUTES ====================
// API routes
app.use(`${API_PREFIX}/${API_VERSION}/auth`, authRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/matches`, matchRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/bets`, betRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/leaderboard`, leaderboardRoutes);
app.use(`${API_PREFIX}/${API_VERSION}/admin`, adminRoutes);

// API documentation (if using Swagger)
if (process.env.NODE_ENV === 'development') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerJsdoc = require('swagger-jsdoc');
  
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'CLUTCH Betting Platform API',
        version: '1.0.0',
        description: 'API documentation for the CLUTCH World Cup 2026 betting platform with real-time sports data integration',
        contact: {
          name: 'CLUTCH Team',
          email: 'support@clutch.com'
        }
      },
      servers: [
        {
          url: `https://${req.headers.host}${API_PREFIX}/${API_VERSION}`,
          description: 'Vercel server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{
        bearerAuth: []
      }]
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js']
  };
  
  const specs = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  
  logger.info('Swagger documentation available at /api-docs');
}

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ==================== ERROR HANDLING ====================
// Error handling middleware
app.use(AuthMiddleware.errorHandler());

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// ==================== SCHEDULED TASKS ====================
function startScheduledTasks() {
  const cron = require('node-cron');
  
  // Sync with blockchain every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Starting scheduled blockchain sync...');
      await web3Service.syncChainWithDatabase();
      logger.info('Scheduled blockchain sync completed');
    } catch (error) {
      logger.error('Scheduled blockchain sync failed:', error);
    }
  });
  
  // Update leaderboard ranks every hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Starting scheduled leaderboard update...');
      const Leaderboard = require('../src/models/Leaderboard');
      await Leaderboard.updateAllRanks();
      logger.info('Scheduled leaderboard update completed');
    } catch (error) {
      logger.error('Scheduled leaderboard update failed:', error);
    }
  });
  
  // Sync external sports data every 6 hours (only if we have a sports data service)
  cron.schedule('0 */6 * * *', async () => {
    try {
      logger.info('Starting scheduled sports data sync...');
      
      if (dataSyncService) {
        const result = await dataSyncService.syncMatches();
        logger.info(`Scheduled sports data sync completed: ${result.total || 0} matches`);
      } else {
        logger.info('No data sync service available, skipping scheduled sync');
      }
      
    } catch (error) {
      logger.error('Scheduled sports data sync failed:', error);
    }
  });
  
  // Check finished matches every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      logger.info('🔄 Running automatic match result detection...');
      
      const ResultDetectorService = require('../src/services/ResultDetectorService');
      const detector = new ResultDetectorService();
      const result = await detector.checkFinishedMatches();
      logger.info(`Match detection completed: ${result.finished} matches finished`);
    } catch (error) {
      logger.error('Automatic match detection failed:', error);
    }
  });
  
  // Clean up old data daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Starting scheduled data cleanup...');
      const db = require('../src/config/database');
      
      // Delete logs older than 30 days
      await db.query(`
        DELETE FROM logs 
        WHERE created_at < datetime('now', '-30 days')
      `);
      
      // Archive old matches (older than 1 year)
      await db.query(`
        UPDATE matches 
        SET archived = 1 
        WHERE match_date < datetime('now', '-1 year')
      `);
      
      logger.info('Scheduled data cleanup completed');
    } catch (error) {
      logger.error('Scheduled data cleanup failed:', error);
    }
  });
  
  logger.info('Scheduled tasks initialized');
}

// ==================== STARTUP ====================
// Initialize backend on module load
initializeBackend().then(() => {
  // Start scheduled tasks after initialization
  startScheduledTasks();
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • Team USA Mascot                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    Deployment: Vercel Serverless                             ║
║    API Version: ${API_VERSION.padEnd(37)}║
║    Environment: ${(process.env.NODE_ENV || 'production').padEnd(38)}║
║    Database: PostgreSQL (Prisma)${' '.padEnd(26)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
  
  logger.info(`✅ CLUTCH Backend initialized on Vercel`);
}).catch(error => {
  console.error('❌ Failed to initialize backend:', error);
});

// Export for Vercel
module.exports = app;