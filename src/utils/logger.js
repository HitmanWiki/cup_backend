// src/utils/logger.js - SIMPLE working version
const logger = {
  info: (message, meta) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message, meta) => {
    console.error(`[ERROR] ${message}`, meta || '');
  },
  warn: (message, meta) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  debug: (message, meta) => {
    console.debug(`[DEBUG] ${message}`, meta || '');
  },
  http: (message, meta) => {
    console.log(`[HTTP] ${message}`, meta || '');
  },
  stream: {
    write: (message) => {
      console.log(`[HTTP] ${message.trim()}`);
    }
  },
  httpLogger: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  },
  // Custom methods
  api: (message, meta) => {
    console.log(`[API] ${message}`, meta || '');
  },
  database: (message, meta) => {
    console.log(`[DB] ${message}`, meta || '');
  },
  blockchain: (message, meta) => {
    console.log(`[BLOCKCHAIN] ${message}`, meta || '');
  },
  security: (message, meta) => {
    console.warn(`[SECURITY] ${message}`, meta || '');
  },
  errorWithContext: (context, error, meta) => {
    console.error(`[${context}] ${error.message}`, { stack: error.stack, ...meta });
  }
};

module.exports = logger;