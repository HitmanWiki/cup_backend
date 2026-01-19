// src/controllers/authController.js
const AuthMiddleware = require('../middleware/auth');
const User = require('../models/User');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class AuthController {
  // REPLACE ONLY THE walletLogin method with this:

static async walletLogin(req, res) {
  try {
    console.log('🔍 Backend received login request');
    
    // 1. Get data from request
    const walletAddress = req.body.walletAddress;
    const signature = req.body.signature || '';
    const message = req.body.message || '';
    
    console.log('🔍 Raw walletAddress from body:', walletAddress);
    console.log('🔍 Type:', typeof walletAddress);
    
    // 2. FIX: Check if it's undefined or null
    if (walletAddress == null) {
      console.error('❌ walletAddress is null or undefined');
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    // 3. FIX: Use toString() instead of String()
    let walletAddressStr;
    try {
      walletAddressStr = walletAddress.toString();
      console.log('✅ After toString():', walletAddressStr);
    } catch (error) {
      console.error('❌ toString() failed:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }
    
    // 4. FIX: Validate format
    if (!walletAddressStr.startsWith('0x') || walletAddressStr.length !== 42) {
      console.error('❌ Invalid ETH address format:', walletAddressStr);
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    // 5. FIX: Now safely lowercase
    const normalizedAddress = walletAddressStr.toLowerCase();
    console.log('✅ Normalized address:', normalizedAddress);
    
    // 6. Find or create user
    let user = await User.findByWalletAddress(normalizedAddress);
    console.log('🔍 User found:', !!user);
    
    if (!user) {
      console.log('🆕 Creating new user...');
      user = await User.create({
        wallet_address: normalizedAddress,
        username: `user_${normalizedAddress.slice(2, 8)}`,
        balance: 1000
      });
      console.log('✅ User created');
    }
    
    // 7. Generate token
    // In walletLogin method, after user creation, you have:
const token = AuthMiddleware.generateToken(normalizedAddress, {
  userId: user.id,  // This is line 73 - user might be undefined
  username: user.username
});
    
    console.log('✅ Login successful');
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        walletAddress: user.wallet_address,
        username: user.username,
        balance: user.balance || 0,
        total_bets: user.total_bets || 0,
        total_won: user.total_won || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('❌ Error details:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
}
  // Connect wallet and get JWT token (alternative method)
  static async connectWallet(req, res) {
    try {
      const { walletAddress, signature, message } = req.body;
      
      // Validate required fields
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required'
        });
      }

      // Validate Ethereum address format
      const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
      if (!isValidAddress) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address format'
        });
      }

      const normalizedAddress = walletAddress.toLowerCase();

      // Check if user exists
      let user = await User.findByWalletAddress(normalizedAddress);
      
      // Create user if doesn't exist
      if (!user) {
        user = await User.create({
          wallet_address: normalizedAddress,
          username: `user_${normalizedAddress.slice(2, 8)}`,
          balance: 1000 // Starting balance for testing
        });
        logger.info(`New user created: ${normalizedAddress}`);
      }

      // Generate JWT token
      const token = AuthMiddleware.generateToken(normalizedAddress, {
        userId: user.id,
        username: user.username
      });

      logger.info(`User connected: ${normalizedAddress}`);
      
      return res.status(200).json({
        success: true,
        message: 'Wallet connected successfully',
        data: {
          token,
          user: {
            id: user.id,
            wallet_address: user.wallet_address,
            username: user.username,
            balance: user.balance,
            total_bets: user.total_bets || 0,
            total_won: user.total_won || 0,
            total_staked: user.total_staked || 0,
            created_at: user.created_at
          }
        }
      });
    } catch (error) {
      logger.error('Wallet connection error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect wallet'
      });
    }
  }

  // Get user profile
  static async getProfile(req, res) {
    try {
      const { walletAddress } = req.user;
      
      const user = await User.findByWalletAddress(walletAddress);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Get user stats if available
      const stats = await User.getUserStats ? await User.getUserStats(walletAddress) : {
        total_bets: user.total_bets || 0,
        total_won: user.total_won || 0,
        total_staked: user.total_staked || 0
      };
      
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            wallet_address: user.wallet_address,
            username: user.username,
            email: user.email,
            balance: user.balance,
            created_at: user.created_at,
            last_active: user.last_active
          },
          stats
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { walletAddress } = req.user;
      const { username, email } = req.body;
      
      // Validate input
      if (username && username.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Username must be at least 3 characters'
        });
      }
      
      if (email && !this.validateEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email address'
        });
      }
      
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      
      const updatedUser = await User.update(walletAddress, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      logger.info(`User profile updated: ${walletAddress}`);
      
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: updatedUser.id,
            wallet_address: updatedUser.wallet_address,
            username: updatedUser.username,
            email: updatedUser.email
          }
        }
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update profile'
      });
    }
  }

  // Validate email format
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Get user stats
  static async getUserStats(req, res) {
    try {
      const { walletAddress } = req.user;
      
      let stats;
      if (User.getUserStats) {
        stats = await User.getUserStats(walletAddress);
      } else {
        const user = await User.findByWalletAddress(walletAddress);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }
        stats = {
          total_bets: user.total_bets || 0,
          total_won: user.total_won || 0,
          total_staked: user.total_staked || 0,
          balance: user.balance || 0
        };
      }
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'User stats not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user stats'
      });
    }
  }

  // Get user activity
  static async getUserActivity(req, res) {
    try {
      const { walletAddress } = req.user;
      const { page = 1, limit = 20 } = req.query;
      
      // This would typically fetch from an activity log table
      // For now, we'll return a placeholder
      const activity = {
        recent_bets: [],
        total_activity: 0,
        page: parseInt(page),
        limit: parseInt(limit)
      };
      
      logger.info(`Get user activity: ${walletAddress}`);
      
      return res.status(200).json({
        success: true,
        data: activity
      });
    } catch (error) {
      logger.error('Get user activity error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user activity'
      });
    }
  }

  // Search users (public endpoint)
  static async searchUsers(req, res) {
    try {
      const { query, limit = 20 } = req.query;
      
      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters'
        });
      }
      
      // Try to search users, fallback to empty array if method not implemented
      let users = [];
      if (User.searchUsers) {
        users = await User.searchUsers(query, parseInt(limit));
      }
      
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Search users error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to search users'
      });
    }
  }

  // Get top users (public endpoint)
  static async getTopUsers(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      // Try to get top users, fallback to empty array if method not implemented
      let users = [];
      if (User.getTopUsers) {
        users = await User.getTopUsers(parseInt(limit));
      }
      
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Get top users error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get top users'
      });
    }
  }

  // Health check endpoint
  static async healthCheck(req, res) {
    try {
      // Check database connection
      const db = require('../config/database');
      const dbHealth = await db.healthCheck ? await db.healthCheck() : { status: 'unknown' };
      
      // Check blockchain connection
      const web3Service = require('../services/web3Service');
      let chainHealth = { status: 'unknown' };
      try {
        chainHealth = await web3Service.healthCheck();
      } catch (web3Error) {
        chainHealth = { status: 'unhealthy', error: web3Error.message };
      }
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        blockchain: chainHealth,
        version: process.env.npm_package_version || '1.0.0'
      };
      
      // Determine overall status
      if (dbHealth.status !== 'healthy' || chainHealth.status !== 'healthy') {
        healthStatus.status = 'unhealthy';
      }
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      
      return res.status(statusCode).json(healthStatus);
    } catch (error) {
      logger.error('Health check error:', error);
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = AuthController;