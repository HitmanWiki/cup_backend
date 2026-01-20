// src/controllers/leaderboardController.js - UPDATED
const Leaderboard = require('../models/Leaderboard');
const logger = require('../utils/logger');

class LeaderboardController {
  static async getRankings(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'total_winnings',
        sort_order = 'DESC'
      } = req.query;

      const result = await Leaderboard.getRankings({}, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by,
        sort_order
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get rankings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get leaderboard rankings'
      });
    }
  }

  static async getTopWinners(req, res) {
    try {
      const { limit = 10 } = req.query;
      const winners = await Leaderboard.getTopWinners(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: winners
      });
    } catch (error) {
      logger.error('Get top winners error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get top winners'
      });
    }
  }

  static async getTopWinRate(req, res) {
    try {
      const { limit = 10 } = req.query;
      const topWinRate = await Leaderboard.getTopWinRate(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: topWinRate
      });
    } catch (error) {
      logger.error('Get top win rate error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get top win rate leaders'
      });
    }
  }

  static async getTopVolume(req, res) {
    try {
      const { limit = 10 } = req.query;
      const topVolume = await Leaderboard.getTopVolume(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: topVolume
      });
    } catch (error) {
      logger.error('Get top volume error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get top volume leaders'
      });
    }
  }

  static async getWeeklyLeaderboard(req, res) {
    try {
      const { limit = 10 } = req.query;
      const weekly = await Leaderboard.getWeeklyLeaderboard(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: weekly
      });
    } catch (error) {
      logger.error('Get weekly leaderboard error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get weekly leaderboard'
      });
    }
  }

  static async getMonthlyLeaderboard(req, res) {
    try {
      const { limit = 10 } = req.query;
      const monthly = await Leaderboard.getMonthlyLeaderboard(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: monthly
      });
    } catch (error) {
      logger.error('Get monthly leaderboard error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get monthly leaderboard'
      });
    }
  }

  static async getGlobalStats(req, res) {
    try {
      const stats = await Leaderboard.getGlobalStats();
      
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get global stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get global stats'
      });
    }
  }

  static async getUserRank(req, res) {
    try {
      const { walletAddress } = req.user;
      const rank = await Leaderboard.getUserRank(walletAddress);
      
      if (!rank) {
        return res.status(404).json({
          success: false,
          error: 'User not found in leaderboard'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: rank
      });
    } catch (error) {
      logger.error('Get user rank error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user rank'
      });
    }
  }

  static async getUserStreak(req, res) {
    try {
      const { walletAddress } = req.user;
      const streak = await Leaderboard.getUserStreak(walletAddress);
      
      return res.status(200).json({
        success: true,
        data: { streak }
      });
    } catch (error) {
      logger.error('Get user streak error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user streak'
      });
    }
  }

  static async updateAllRanks(req, res) {
    try {
      const result = await Leaderboard.updateAllRanks();
      
      return res.status(200).json({
        success: true,
        message: 'Leaderboard ranks updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Update all ranks error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update leaderboard ranks'
      });
    }
  }
}

module.exports = LeaderboardController;