// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

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

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.apiPrefix = process.env.API_PREFIX || '/api';
    this.apiVersion = process.env.API_VERSION || 'v1';
    
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
      
      // Initialize routes
      this.initializeRoutes();
      
      // Initialize error handling
      this.initializeErrorHandling();
      
      // Start scheduled tasks
      this.startScheduledTasks();
      
      logger.info('Server initialization completed');
    } catch (error) {
      logger.error('Server initialization failed:', error);
      process.exit(1);
    }
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
          connectSrc: ["'self'", process.env.RPC_URL_SEPOLIA]
        }
      },
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    };
    this.app.use(cors(corsOptions));
    
    // Compression
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use(AuthMiddleware.requestLogger());
    
    // Rate limiting
    this.app.use('/api/', AuthMiddleware.rateLimit(
      parseInt(process.env.RATE_LIMIT_MAX) || 100,
      parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000
    ));
    
    // Static files (if needed)
    this.app.use('/public', express.static(path.join(__dirname, 'public')));
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'clutch-backend'
      });
    });
  }

  async initializeDatabase() {
    try {
      await database.connect();
      logger.info('Database connection established');
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
      // Don't throw error here, as the app can still function in read-only mode
      logger.warn('Running in read-only mode (blockchain operations disabled)');
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
            description: 'API documentation for the CLUTCH World Cup 2026 betting platform',
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
        const Leaderboard = require('./src/models/Leaderboard');
        await Leaderboard.updateAllRanks();
        logger.info('Scheduled leaderboard update completed');
      } catch (error) {
        logger.error('Scheduled leaderboard update failed:', error);
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
      const db = require('./src/config/database');
      
      // Delete logs older than 30 days
      await db.query(`
        DELETE FROM logs 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      // Delete old notifications
      await db.query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '7 days' AND read = true
      `);
      
      // Archive old matches (older than 1 year)
      await db.query(`
        UPDATE matches 
        SET archived = true 
        WHERE match_date < NOW() - INTERVAL '1 year'
      `);
      
      logger.info('Data cleanup completed');
    } catch (error) {
      logger.error('Data cleanup failed:', error);
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
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
║    Database: ${process.env.DB_NAME?.padEnd(40)}║
║    Network: ${process.env.NETWORK?.padEnd(41)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
      
      logger.info(`Server is running on http://localhost:${this.port}`);
      logger.info(`API available at http://localhost:${this.port}${this.apiPrefix}/${this.apiVersion}`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`API documentation: http://localhost:${this.port}/api-docs`);
      }
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