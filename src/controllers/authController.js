// src/controllers/authController.js
const AuthMiddleware = require('../middleware/auth');
const User = require('../models/User');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class AuthController {
  // Connect wallet and get JWT token
  static async connectWallet(req, res) {
    try {
      const { walletAddress } = req;
      
      // Create or update user in database
      const user = await User.create(walletAddress);
      
      // Generate JWT token
      const token = AuthMiddleware.generateToken(walletAddress, {
        userId: user.id,
        username: user.username
      });
      
      logger.info(`User connected: ${walletAddress}`);
      
      return res.status(200).json({
        success: true,
        message: 'Wallet connected successfully',
        data: {
          token,
          user: {
            id: user.id,
            wallet_address: user.wallet_address,
            username: user.username,
            total_bets: user.total_bets,
            total_won: user.total_won,
            total_staked: user.total_staked,
            created_at: user.created_at
          }
        }
      });
    } catch (error) {
      logger.error('Wallet connection error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to connect wallet'
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
      
      const stats = await User.getUserStats(walletAddress);
      
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            wallet_address: user.wallet_address,
            username: user.username,
            email: user.email,
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
        error: 'Failed to get profile'
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
        error: 'Failed to update profile'
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
      
      const stats = await User.getUserStats(walletAddress);
      
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
        error: 'Failed to get user stats'
      });
    }
  }

  // Get user activity
  static async getUserActivity(req, res) {
    try {
      const { walletAddress } = req.user;
      const { page = 1, limit = 20 } = req.query;
      
      // This would typically fetch from an activity log table
      // For now, we'll return recent bets as activity
      const bets = await User.getRecentBets(walletAddress, {
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      return res.status(200).json({
        success: true,
        data: bets
      });
    } catch (error) {
      logger.error('Get user activity error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user activity'
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
      
      const users = await User.searchUsers(query, parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Search users error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search users'
      });
    }
  }

  // Get top users (public endpoint)
  static async getTopUsers(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const users = await User.getTopUsers(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Get top users error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get top users'
      });
    }
  }

  // Health check endpoint
  static async healthCheck(req, res) {
    try {
      // Check database connection
      const dbHealth = await require('../config/database').healthCheck();
      
      // Check blockchain connection
      const web3Service = require('../services/web3Service');
      const chainHealth = await web3Service.healthCheck();
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        blockchain: chainHealth,
        version: process.env.npm_package_version || '1.0.0'
      };
      
      // Determine overall status
      if (dbHealth.status !== 'healthy' || chainHealth.chain.status !== 'healthy') {
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