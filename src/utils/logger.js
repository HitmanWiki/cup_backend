// src/utils/logger.js - Vercel-compatible version
const winston = require('winston');

// Check if we're on Vercel
const isVercel = process.env.VERCEL || process.env.NOW_REGION || false;
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Safe stringify for metadata
const safeStringify = (obj) => {
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      if (value instanceof Error) {
        return {
          message: value.message,
          stack: value.stack,
          name: value.name
        };
      }
      return value;
    }, 2);
  } catch (error) {
    return `[Unable to stringify: ${error.message}]`;
  }
};

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
        delete cleanMeta.context;
        delete cleanMeta.service;
        delete cleanMeta.stack;
        
        if (Object.keys(cleanMeta).length > 0) {
          log += ` | ${safeStringify(cleanMeta)}`;
        }
      } catch (error) {
        log += ` | [Metadata error: ${error.message}]`;
      }
    }
    
    return log;
  })
);

// JSON format for production (Vercel logs)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger with only console transport on Vercel
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'clutch-backend' },
  transports: []
});

// On Vercel or production, only use console transport
if (isVercel || isProduction) {
  logger.add(new winston.transports.Console({
    format: jsonFormat // JSON for Vercel logs
  }));
} else {
  // Local development: use pretty console format
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Helper methods
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

// Stream for morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Add http level
logger.addLevel('http', 2, { color: 'magenta' });

// HTTP request logging middleware
logger.httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
};

// Error context helper
logger.errorWithContext = (context, error, meta = {}) => {
  logger.error(error.message, {
    context,
    stack: error.stack,
    ...meta
  });
};

module.exports = logger;