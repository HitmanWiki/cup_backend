// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');
const User = require('../models/User');

class AuthMiddleware {
  // Verify JWT token
  // src/middleware/auth.js
// Update the verifyToken method:

static async verifyToken(req, res, next) {
  try {
    // Try multiple ways to get the token
    let token;
    
    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7); // Remove "Bearer "
    }
    // 2. Check x-access-token header
    else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }
    // 3. Check x-auth-token header
    else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }
    // 4. Check cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      logger.warn('No token provided', {
        url: req.url,
        method: req.method,
        headers: req.headers
      });
      
      return res.status(401).json({
        success: false,
        error: 'Access token required. Please log in first.'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Make sure walletAddress exists in token
    if (!decoded.walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token: missing wallet address'
      });
    }
    
    // Optional: Verify user exists in database
    try {
      const user = await User.findByWalletAddress(decoded.walletAddress);
      if (!user) {
        logger.warn('User not found in database:', decoded.walletAddress);
        // Don't fail here - just log and continue
      }
    } catch (dbError) {
      logger.warn('Database check failed:', dbError);
      // Continue anyway - token is valid
    }
    
    // Add user info to request
    req.user = {
      walletAddress: decoded.walletAddress.toLowerCase(),
      ...decoded
    };
    
    // Add debug logging in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Token verified for:', {
        walletAddress: req.user.walletAddress,
        url: req.url
      });
    }
    
    next();
  } catch (error) {
    logger.error('Token verification error:', {
      name: error.name,
      message: error.message,
      url: req.url
    });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please log in again.'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

  // Verify wallet signature
  static async verifyWallet(req, res, next) {
    try {
      const { walletAddress, signature, message } = req.body;
      
      if (!walletAddress || !signature || !message) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address, signature, and message are required'
        });
      }

      // In production, you would verify the signature against the message
      // For now, we'll just validate the wallet address format
      const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
      
      if (!isValidAddress) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address'
        });
      }

      req.walletAddress = walletAddress.toLowerCase();
      next();
    } catch (error) {
      logger.error('Wallet verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Wallet verification failed'
      });
    }
  }

  // Generate JWT token
  static generateToken(walletAddress, userData = {}) {
    const payload = {
      walletAddress: walletAddress.toLowerCase(),
      ...userData
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }

  // Admin authentication
  static async verifyAdmin(req, res, next) {
    try {
      await this.verifyToken(req, res, () => {
        // Check if user is admin
        // This would typically check against a database or environment variable
        const adminWallets = process.env.ADMIN_WALLETS?.split(',') || [];
        
        if (!adminWallets.includes(req.user.walletAddress.toLowerCase())) {
          return res.status(403).json({
            success: false,
            error: 'Admin access required'
          });
        }
        
        next();
      });
    } catch (error) {
      logger.error('Admin verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'Admin verification failed'
      });
    }
  }

  // API key authentication
  static async verifyApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required'
        });
      }

      // Verify API key (in production, this would check against a database)
      const validApiKeys = process.env.API_KEYS?.split(',') || [];
      
      if (!validApiKeys.includes(apiKey)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      next();
    } catch (error) {
      logger.error('API key verification error:', error);
      return res.status(500).json({
        success: false,
        error: 'API key verification failed'
      });
    }
  }

  // Rate limiting middleware
  static rateLimit(limit = 100, windowMs = 15 * 60 * 1000) {
    const requests = new Map();
    
    return (req, res, next) => {
      const key = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      
      const userRequests = requests.get(key);
      const windowStart = now - windowMs;
      
      // Remove old requests
      while (userRequests.length > 0 && userRequests[0] < windowStart) {
        userRequests.shift();
      }
      
      // Check if limit exceeded
      if (userRequests.length >= limit) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later'
        });
      }
      
      // Add current request
      userRequests.push(now);
      requests.set(key, userRequests);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - userRequests.length);
      res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + windowMs) / 1000));
      
      next();
    };
  }

  // CORS middleware
  static cors() {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    };
  }

  // Request logging middleware
  static requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Log request
      logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Log response
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        logger.info('Response sent', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('Content-Length')
        });
      });
      
      next();
    };
  }

  // Error handling middleware
  static errorHandler() {
    return (err, req, res, next) => {
      logger.error('Unhandled error:', err);
      
      // Default error response
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal server error';
      
      // Hide detailed errors in production
      const errorResponse = {
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : message
      };
      
      // Add stack trace in development
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.stack = err.stack;
      }
      
      res.status(statusCode).json(errorResponse);
    };
  }

  // Validate request body
  static validateRequest(schema) {
    return (req, res, next) => {
      try {
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }));
          
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors
          });
        }
        
        req.body = value;
        next();
      } catch (error) {
        logger.error('Request validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Validation failed'
        });
      }
    };
  }
}

module.exports = AuthMiddleware;