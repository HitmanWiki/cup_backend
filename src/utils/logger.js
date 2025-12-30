// src/utils/logger.js
const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || 'logs';
const isProduction = process.env.NODE_ENV === 'production';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'clutch-backend' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport in non-production environments
if (!isProduction) {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create a stream object for Morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Custom logger methods for different contexts
logger.api = (message, meta = {}) => {
  logger.info(message, { context: 'API', ...meta });
};

logger.database = (message, meta = {}) => {
  logger.info(message, { context: 'DATABASE', ...meta });
};

logger.blockchain = (message, meta = {}) => {
  logger.info(message, { context: 'BLOCKCHAIN', ...meta });
};

logger.security = (message, meta = {}) => {
  logger.warn(message, { context: 'SECURITY', ...meta });
};

logger.performance = (message, duration, meta = {}) => {
  logger.info(message, { context: 'PERFORMANCE', duration, ...meta });
};

// Error logging helper
logger.errorWithContext = (context, error, meta = {}) => {
  logger.error(error.message, {
    context,
    stack: error.stack,
    ...meta
  });
};

module.exports = logger;