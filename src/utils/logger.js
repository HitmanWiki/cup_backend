// src/utils/logger.js - FIXED VERSION
const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const logDir = process.env.LOG_DIR || 'logs';
const isProduction = process.env.NODE_ENV === 'production';

// Custom JSON stringify that handles circular references
const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    
    // Handle special cases
    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        name: value.name
      };
    }
    
    // Don't log full HTTP request/response objects
    if (value && (value.req || value.res || value.config || value.request || value.response)) {
      return '[HTTP Object]';
    }
    
    return value;
  }, 2);
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format((info) => {
    // Safely stringify metadata
    if (info.meta) {
      try {
        info.meta = safeStringify(info.meta);
      } catch (error) {
        info.meta = '[Unable to stringify metadata]';
      }
    }
    return info;
  })(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
      try {
        // Filter out problematic fields
        const cleanMeta = { ...meta };
        delete cleanMeta.req;
        delete cleanMeta.res;
        delete cleanMeta.request;
        delete cleanMeta.response;
        delete cleanMeta.config;
        
        if (Object.keys(cleanMeta).length > 0) {
          log += ` ${safeStringify(cleanMeta)}`;
        }
      } catch (error) {
        log += ` [Metadata: ${error.message}]`;
      }
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

// Safe logging for API responses (prevents circular references)
logger.apiResponse = (message, response, meta = {}) => {
  const safeResponse = {
    status: response?.status,
    statusText: response?.statusText,
    dataLength: Array.isArray(response?.data) ? response.data.length : 'N/A',
    config: {
      url: response?.config?.url,
      method: response?.config?.method
    }
  };
  
  logger.info(message, { 
    context: 'API_RESPONSE', 
    response: safeResponse, 
    ...meta 
  });
};

module.exports = logger;