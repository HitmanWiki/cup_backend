// server.js - COMPLETE UPDATED VERSION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Import configurations
const { constants, validateConfig } = require('./api/src/config/constants');
const database = require('./api/src/config/database');
const web3Service = require('./api/src/services/web3Service');
const AuthMiddleware = require('./api/src/middleware/auth');
const logger = require('./api/src/utils/logger');

// Import routes
const authRoutes = require('./api/src/routes/auth');
const matchRoutes = require('./api/src/routes/matches');
const betRoutes = require('./api/src/routes/bets');
const leaderboardRoutes = require('./api/src/routes/leaderboard');
const adminRoutes = require('./api/src/routes/admin');

// Import new services for external data
const DataSyncService = require('./api/src/services/dataSyncService');
const SportsDataService = require('./api/src/services/sportsDataService');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.apiPrefix = process.env.API_PREFIX || '/api';
    this.apiVersion = process.env.API_VERSION || 'v4';
    this.sportsDataService = null;
    this.dataSyncService = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Validate configuration
      validateConfig();
      
      // Initialize middleware
      this.initializeMiddleware();
      
      // Initialize database
      await this.initializeDatabase();
      
      // Initialize blockchain connection
      await this.initializeBlockchain();
      
      // Initialize external data services (with fallback support)
      await this.initializeExternalServices();
      
      // Initialize routes
      this.initializeRoutes();
      
      // Initialize error handling
      this.initializeErrorHandling();
      
      // Start scheduled tasks
      this.startScheduledTasks();
      
      logger.info('Server initialization completed');
    } catch (error) {
      logger.error('Server initialization failed:', error);
      
      // Even if initialization fails, start server with basic functionality
      logger.warn('Starting server with limited functionality...');
      this.startServerWithFallback();
      
      throw error; // Still throw to show there was an issue
    }
  }

  startServerWithFallback() {
    this.server = this.app.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • Team USA Mascot                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ⚠️  WARNING: Running in FALLBACK MODE                     ║
║                                                               ║
║    Server running on port: ${this.port.toString().padEnd(34)}║
║    Environment: ${process.env.NODE_ENV?.padEnd(38)}║
║    Data Source: Generated World Cup 2026                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
      
      logger.info(`Server is running on http://localhost:${this.port}`);
      logger.info('⚠️ Running with generated match data');
    });
    
    this.setupGracefulShutdown();
  }

  initializeMiddleware() {
    // Security middleware
    this.app.use(helmet({
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
    
    // CORS configuration - UPDATED
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
this.app.use(cors(corsOptions));
    // Compression
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(AuthMiddleware.requestLogger());
    
    // Rate limiting - increased for external API calls
    this.app.use('/api/', AuthMiddleware.rateLimit(
      parseInt(process.env.RATE_LIMIT_MAX) || 200,
      parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000
    ));
    
    // Static files (if needed)
    this.app.use('/public', express.static(path.join(__dirname, 'public')));
    
    // Health check endpoint with service status
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealth = await database.healthCheck();
        const web3Health = await web3Service.healthCheck();
        
        // Check sports data service
        let sportsDataStatus = 'not_configured';
        if (this.sportsDataService) {
          try {
            const sportsHealth = await this.sportsDataService.healthCheck();
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
    // First, add this debug endpoint to your backend (if not already there)
// In server.js, add:
this.app.get('/api/v4/matches/all', async (req, res) => {
  try {
    const Match = require('./api/src/models/Match');
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
    // Debug endpoint for sports API
    this.app.get('/api/v4/debug/sports-api', async (req, res) => {
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
    // Debug endpoint for matches data
this.app.get('/api/v4/debug/matches', async (req, res) => {
  try {
    const Match = require('./api/src/models/Match');
    
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
// Add this in server.js inside initializeMiddleware method:
this.app.get('/api/v4/debug/db-matches', async (req, res) => {
  try {
    const db = require('./api/src/config/database');
    
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
this.app.get('/api/v4/admin/check-finished-matches', async (req, res) => {
  try {
    const ResultDetectorService = require('./api/src/services/ResultDetectorService');
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

this.app.post('/api/v4/admin/finish-match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { outcome } = req.body;
    
    if (outcome === undefined || outcome < 0 || outcome > 2) {
      return res.status(400).json({
        success: false,
        error: 'Valid outcome required (0=teamA, 1=draw, 2=teamB)'
      });
    }
    
    const ResultDetectorService = require('./api/src/services/ResultDetectorService');
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
this.app.get('/api/v4/debug/auth-test', AuthMiddleware.verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful!',
    user: req.user,
    headers: req.headers
  });
});
    
    // New endpoint: Force data sync
    this.app.get('/api/admin/sync-data', AuthMiddleware.verifyAdmin, async (req, res) => {
      try {
        logger.info('Manual data sync requested by admin');
        
        if (!this.dataSyncService) {
          throw new Error('Data sync service not initialized');
        }
        
        const result = await this.dataSyncService.syncMatches();
        
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
  }
  // Debug endpoint for matches data

  async initializeDatabase() {
    try {
      await database.connect();
      logger.info('Database connection established');
      
      // Check if we have real data or just sample data
      const Match = require('./api/src/models/Match');
      const matchCount = await Match.getCountByStatus();
      const totalMatches = matchCount.reduce((a, b) => a + b.count, 0);
      logger.info(`Database contains ${totalMatches} matches`);
      
      if (totalMatches === 0) {
        logger.info('No matches found in database. Will sync from external source.');
      }
      
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async initializeBlockchain() {
    try {
      await web3Service.initialize();
      logger.info('Blockchain connection established');
    } catch (error) {
      logger.error('Blockchain connection failed:', error);
      logger.warn('Running in read-only mode (blockchain operations disabled)');
    }
  }

  async initializeExternalServices() {
    try {
      // Check API key
      if (!process.env.SPORTS_DATA_API_KEY) {
        logger.warn('SPORTS_DATA_API_KEY not found in .env file. Using generated data.');
        return this.initializeWithGeneratedData();
      }

      logger.info('Initializing external sports data service...');
      
      // Initialize services
      const sportsDataService = new SportsDataService();
      
      // Test connection with timeout handling
      let isConnected = false;
      try {
        logger.info('Testing API connection...');
        
        // Use Promise.race for timeout
        const connectionPromise = sportsDataService.testConnection();
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => {
            logger.warn('API connection timeout after 5 seconds');
            resolve(false);
          }, 5000)
        );
        
        isConnected = await Promise.race([connectionPromise, timeoutPromise]);
        
      } catch (error) {
        logger.warn(`API connection test error: ${error.message}`);
        isConnected = false;
      }
      
      if (!isConnected) {
        logger.warn('⚠️ Could not connect to sports data API');
        logger.warn('⚠️ Using generated World Cup 2026 data instead');
        logger.warn('⚠️ To use real data:');
        logger.warn('   1. Check your internet connection');
        logger.warn('   2. Verify SPORTS_DATA_API_KEY is valid');
        logger.warn('   3. Make sure you have proper API subscription');
        
        // Don't throw error, use generated data
        return this.initializeWithGeneratedData();
      }
      
      // Store service instance
      this.sportsDataService = sportsDataService;
      
      // Initialize data sync
      const dataSyncService = new DataSyncService(sportsDataService);
      this.dataSyncService = dataSyncService;
      
      // Initial sync with error handling
      try {
        logger.info('Performing initial data sync...');
        const syncResult = await dataSyncService.syncMatches();
        
        if (syncResult.success) {
          logger.info(`Initial sync: ${syncResult.total || 0} matches processed`);
        } else {
          logger.warn(`Initial sync completed with issues: ${syncResult.message || 'Unknown error'}`);
        }
        
      } catch (syncError) {
        logger.warn(`Initial sync failed: ${syncError.message}. Using existing/generated data.`);
        // Continue anyway - don't crash the server
      }
      
      logger.info('✅ External services initialized');
      
    } catch (error) {
      logger.error('❌ Error in external services initialization:', error.message);
      logger.warn('⚠️ Continuing with generated match data...');
      
      // Fall back to generated data instead of crashing
      return this.initializeWithGeneratedData();
    }
  }

  async initializeWithGeneratedData() {
    try {
      logger.info('🔄 Initializing with generated match data...');
      
      // Create sports data service in "generated mode"
      const sportsDataService = new SportsDataService();
      sportsDataService.usingGeneratedData = true;
      
      // Store service instance
      this.sportsDataService = sportsDataService;
      
      // Initialize data sync
      const dataSyncService = new DataSyncService(sportsDataService);
      this.dataSyncService = dataSyncService;
      
      // Perform initial sync with generated data
      try {
        const syncResult = await dataSyncService.syncMatches();
        logger.info(`Generated ${syncResult.total || 0} World Cup 2026 matches`);
      } catch (syncError) {
        logger.warn('Failed to sync generated data:', syncError.message);
      }
      
      logger.info('✅ External services initialized with generated data');
      
    } catch (error) {
      logger.error('Failed to initialize with generated data:', error);
      // At this point, just log and continue - server should still start
    }
  }

  initializeRoutes() {
    // API routes
    this.app.use(`${this.apiPrefix}/${this.apiVersion}/auth`, authRoutes);
    this.app.use(`${this.apiPrefix}/${this.apiVersion}/matches`, matchRoutes);
    this.app.use(`${this.apiPrefix}/${this.apiVersion}/bets`, betRoutes);
    this.app.use(`${this.apiPrefix}/${this.apiVersion}/leaderboard`, leaderboardRoutes);
    this.app.use(`${this.apiPrefix}/${this.apiVersion}/admin`, adminRoutes);
    
    // API documentation (if using Swagger)
    this.setupSwagger();
    
    // 404 handler for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  setupSwagger() {
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
              url: `http://localhost:${this.port}${this.apiPrefix}/${this.apiVersion}`,
              description: 'Development server'
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
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
      
      logger.info('Swagger documentation available at /api-docs');
    }
  }
  

  initializeErrorHandling() {
    // Error handling middleware
    this.app.use(AuthMiddleware.errorHandler());
    
    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  startScheduledTasks() {
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
        const Leaderboard = require('./api/src/models/Leaderboard');
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
        
        if (this.dataSyncService) {
          const result = await this.dataSyncService.syncMatches();
          logger.info(`Scheduled sports data sync completed: ${result.total || 0} matches`);
        } else {
          logger.info('No data sync service available, skipping scheduled sync');
        }
        
      } catch (error) {
        logger.error('Scheduled sports data sync failed:', error);
      }
    });
    cron.schedule('*/10 * * * *', async () => { // Every 10 minutes
  try {
    logger.info('🔄 Running automatic match result detection...');
    
    if (server.resultDetectorService) {
      const result = await server.resultDetectorService.checkFinishedMatches();
      logger.info(`Match detection completed: ${result.finished} matches finished`);
    } else {
      logger.info('Result detector service not initialized');
    }
  } catch (error) {
    logger.error('Automatic match detection failed:', error);
  }
});

    
    // Clean up old data daily at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        logger.info('Starting scheduled data cleanup...');
        await this.cleanupOldData();
        logger.info('Scheduled data cleanup completed');
      } catch (error) {
        logger.error('Scheduled data cleanup failed:', error);
      }
    });
    
    logger.info('Scheduled tasks initialized');
  }

  async cleanupOldData() {
    try {
      const db = require('./api/src/config/database');
      
      // Delete logs older than 30 days
      await db.query(`
        DELETE FROM logs 
        WHERE created_at < datetime('now', '-30 days')
      `);
      
      // Delete old notifications
      await db.query(`
        DELETE FROM notifications 
        WHERE created_at < datetime('now', '-7 days') AND read = 1
      `);
      
      // Archive old matches (older than 1 year)
      await db.query(`
        UPDATE matches 
        SET archived = 1 
        WHERE match_date < datetime('now', '-1 year')
      `);
      
      logger.info('Data cleanup completed');
    } catch (error) {
      logger.error('Data cleanup failed:', error);
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      const hasExternalAPI = process.env.SPORTS_DATA_API_KEY && 
                            process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key';
      const usingGeneratedData = this.sportsDataService?.usingGeneratedData || !hasExternalAPI;
      const dataSource = usingGeneratedData ? 'Generated' : 'External API';
      const isHealthy = this.sportsDataService !== null;
      
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform Backend                           ║
║    🦅 World Cup 2026 • Team USA Mascot                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    Server running on port: ${this.port.toString().padEnd(34)}║
║    Environment: ${process.env.NODE_ENV?.padEnd(38)}║
║    API Version: ${this.apiVersion.padEnd(37)}║
║    Database: SQLite${' '.padEnd(37)}║
║    Network: ${process.env.NETWORK?.padEnd(41)}║
║    Data Source: ${dataSource.padEnd(37)}║
║    Status: ${(isHealthy ? '✅ Healthy' : '⚠️ Limited').padEnd(39)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
      
      logger.info(`Server is running on http://localhost:${this.port}`);
      logger.info(`API available at http://localhost:${this.port}${this.apiPrefix}/${this.apiVersion}`);
      
      if (isHealthy) {
        if (!usingGeneratedData) {
          logger.info('✅ Connected to external sports data API');
        } else {
          logger.info('📋 Using generated World Cup 2026 schedule');
        }
      } else {
        logger.info('⚠️ Running with limited functionality');
        logger.info('💡 For full functionality:');
        logger.info('   1. Check database connection');
        logger.info('   2. Verify .env configuration');
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`API documentation: http://localhost:${this.port}/api-docs`);
      }
      
      // Log available endpoints
      logger.info('\n📋 Available Endpoints:');
      logger.info(`   Health Check: http://localhost:${this.port}/health`);
      logger.info(`   Debug API: http://localhost:${this.port}/api/v4/debug/sports-api`);
      logger.info(`   Upcoming Matches: http://localhost:${this.port}/api/v4/matches/upcoming`);
      logger.info(`   Group Stage: http://localhost:${this.port}/api/v4/matches/groups`);
    });
    
    // Graceful shutdown
    this.setupGracefulShutdown();
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      try {
        // Close server
        if (this.server) {
          this.server.close(() => {
            logger.info('HTTP server closed');
          });
        }
        
        // Close database connection
        await database.close();
        logger.info('Database connection closed');
        
        // Close blockchain connections
        // Add any blockchain connection cleanup here
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon restart
  }
}

// Create and start server instance
const server = new Server();
server.start();

module.exports = server;