// src/controllers/betController.js
const Bet = require('../models/Bet');
const Match = require('../models/Match');
const User = require('../models/User');
const web3Service = require('../services/web3Service');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class BetController {
  // Place a bet
  static async placeBet(req, res) {
    try {
      const { walletAddress } = req.user;
      const { match_id, outcome, amount } = req.body;

      // Validate required fields
      if (!match_id || outcome === undefined || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Match ID, outcome, and amount are required'
        });
      }

      // Validate amount
      const minAmount = constants.BETTING_LIMITS.MIN_AMOUNT;
      const maxAmount = constants.BETTING_LIMITS.MAX_AMOUNT;

      if (amount < minAmount) {
        return res.status(400).json({
          success: false,
          error: `Minimum bet amount is ${minAmount} CLUTCH`
        });
      }

      if (amount > maxAmount) {
        return res.status(400).json({
          success: false,
          error: `Maximum bet amount is ${maxAmount} CLUTCH`
        });
      }

      // Validate outcome
      const validOutcomes = Object.values(constants.OUTCOMES);
      if (!validOutcomes.includes(parseInt(outcome))) {
        return res.status(400).json({
          success: false,
          error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`
        });
      }

      // Validate match exists and is bettable
      const match = await Match.findById(parseInt(match_id));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      if (match.status !== constants.MATCH_STATUS.UPCOMING) {
        return res.status(400).json({
          success: false,
          error: 'Match is not bettable'
        });
      }

      // Get odds based on outcome
      let odds;
      if (parseInt(outcome) === constants.OUTCOMES.TEAM_A_WIN) {
        odds = match.odds_team_a;
      } else if (parseInt(outcome) === constants.OUTCOMES.DRAW) {
        odds = match.odds_draw;
      } else {
        odds = match.odds_team_b;
      }

      // Place bet on blockchain
      const chainResult = await web3Service.placeBetOnChain(
        walletAddress,
        parseInt(match_id),
        parseInt(outcome),
        parseFloat(amount)
      );

      // Create bet in database
      const betData = {
        bet_id: chainResult.betId,
        user_address: walletAddress,
        match_id: parseInt(match_id),
        outcome: parseInt(outcome),
        amount: parseFloat(amount),
        potential_win: chainResult.potentialWin,
        odds: chainResult.odds,
        status: constants.BET_STATUS.PENDING,
        claimed: false
      };

      const dbBet = await Bet.create(betData);

      // Update user stats
      await User.updateStats(walletAddress, {
        total_bets: 1,
        total_staked: parseFloat(amount)
      });

      // Update match total staked
      await Match.updateTotalStaked(parseInt(match_id), parseFloat(amount));

      logger.info(`Bet placed: ${chainResult.betId} by ${walletAddress} on match ${match_id}`);

      return res.status(201).json({
        success: true,
        message: 'Bet placed successfully',
        data: {
          bet: dbBet,
          chain: {
            txHash: chainResult.txHash,
            betId: chainResult.betId
          }
        }
      });
    } catch (error) {
      logger.error('Place bet error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to place bet'
      });
    }
  }

  // Get user bets
  static async getUserBets(req, res) {
    try {
      const { walletAddress } = req.user;
      const {
        status,
        match_id,
        outcome,
        claimed,
        page = 1,
        limit = constants.PAGINATION.DEFAULT_LIMIT,
        sort_by = 'placed_at',
        sort_order = 'DESC'
      } = req.query;

      const filters = {
        status,
        match_id: match_id ? parseInt(match_id) : undefined,
        outcome: outcome !== undefined ? parseInt(outcome) : undefined,
        claimed: claimed === 'true' ? true : claimed === 'false' ? false : undefined
      };

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), constants.PAGINATION.MAX_LIMIT),
        sort_by,
        sort_order
      };

      const result = await Bet.findByUser(walletAddress, filters, pagination);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get user bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user bets'
      });
    }
  }

  // Get single bet by ID
  static async getBetById(req, res) {
    try {
      const { betId } = req.params;
      
      const bet = await Bet.findById(parseInt(betId));
      if (!bet) {
        return res.status(404).json({
          success: false,
          error: 'Bet not found'
        });
      }
      
      // Check if user owns the bet
      const { walletAddress } = req.user;
      if (bet.user_address.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: bet
      });
    } catch (error) {
      logger.error('Get bet by ID error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get bet'
      });
    }
  }

  // Claim bet winnings
  static async claimBetWinnings(req, res) {
    try {
      const { walletAddress } = req.user;
      const { betId } = req.params;

      // Validate bet exists
      const bet = await Bet.findById(parseInt(betId));
      if (!bet) {
        return res.status(404).json({
          success: false,
          error: 'Bet not found'
        });
      }

      // Check if user owns the bet
      if (bet.user_address.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check if bet is won and not claimed
      if (bet.status !== constants.BET_STATUS.WON) {
        return res.status(400).json({
          success: false,
          error: 'Bet is not won'
        });
      }

      if (bet.claimed) {
        return res.status(400).json({
          success: false,
          error: 'Bet already claimed'
        });
      }

      // Claim on blockchain
      const chainResult = await web3Service.claimWinningsOnChain(
        parseInt(betId),
        walletAddress
      );

      // Update bet in database
      await Bet.claim(parseInt(betId), walletAddress);

      // Update user stats
      await User.updateStats(walletAddress, {
        total_won: bet.potential_win
      });

      logger.info(`Bet winnings claimed: ${betId} by ${walletAddress}`);

      return res.status(200).json({
        success: true,
        message: 'Winnings claimed successfully',
        data: {
          betId,
          amount: bet.potential_win,
          chain: {
            txHash: chainResult.txHash
          }
        }
      });
    } catch (error) {
      logger.error('Claim bet winnings error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to claim winnings'
      });
    }
  }

  // Get user active bets
  static async getUserActiveBets(req, res) {
    try {
      const { walletAddress } = req.user;
      
      const activeBets = await Bet.getUserActiveBets(walletAddress);
      
      return res.status(200).json({
        success: true,
        data: activeBets
      });
    } catch (error) {
      logger.error('Get user active bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get active bets'
      });
    }
  }

  // Get user winning bets
  static async getUserWinningBets(req, res) {
    try {
      const { walletAddress } = req.user;
      
      const winningBets = await Bet.getUserWinningBets(walletAddress);
      
      return res.status(200).json({
        success: false,
        data: winningBets
      });
    } catch (error) {
      logger.error('Get user winning bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get winning bets'
      });
    }
  }

  // Get user bet statistics
  static async getUserBetStats(req, res) {
    try {
      const { walletAddress } = req.user;
      
      const stats = await Bet.getUserStats(walletAddress);
      
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
      logger.error('Get user bet stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user bet statistics'
      });
    }
  }

  // Get recent bets (public)
  static async getRecentBets(req, res) {
    try {
      const { limit = 20 } = req.query;
      
      const bets = await Bet.getRecentBets(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: bets
      });
    } catch (error) {
      logger.error('Get recent bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get recent bets'
      });
    }
  }

  // Get largest bets (public)
  static async getLargestBets(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const bets = await Bet.getLargestBets(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: bets
      });
    } catch (error) {
      logger.error('Get largest bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get largest bets'
      });
    }
  }

  // Get total bet statistics (admin)
  static async getTotalBetStats(req, res) {
    try {
      const stats = await Bet.getTotalStats();
      
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get total bet stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get total bet statistics'
      });
    }
  }

  // Cancel bet (admin only)
  static async cancelBet(req, res) {
    try {
      const { betId } = req.params;
      const { reason } = req.body;

      // Validate bet exists
      const bet = await Bet.findById(parseInt(betId));
      if (!bet) {
        return res.status(404).json({
          success: false,
          error: 'Bet not found'
        });
      }

      // Check if bet can be cancelled
      if (bet.status !== constants.BET_STATUS.PENDING) {
        return res.status(400).json({
          success: false,
          error: 'Only pending bets can be cancelled'
        });
      }

      // Get match to check status
      const match = await Match.findById(bet.match_id);
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      // Only allow cancellation if match is cancelled
      if (match.status !== constants.MATCH_STATUS.CANCELLED) {
        return res.status(400).json({
          success: false,
          error: 'Bet can only be cancelled if match is cancelled'
        });
      }

      // Update bet status
      const updatedBet = await Bet.update(parseInt(betId), {
        status: constants.BET_STATUS.CANCELLED
      });

      // Refund user (in production, this would trigger a blockchain transaction)
      await User.updateStats(bet.user_address, {
        total_staked: -bet.amount
      });

      logger.info(`Bet cancelled: ${betId}, reason: ${reason}`);

      return res.status(200).json({
        success: true,
        message: 'Bet cancelled successfully',
        data: updatedBet
      });
    } catch (error) {
      logger.error('Cancel bet error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel bet'
      });
    }
  }

  // Delete bet (admin only)
  static async deleteBet(req, res) {
    try {
      const { betId } = req.params;

      // Validate bet exists
      const bet = await Bet.findById(parseInt(betId));
      if (!bet) {
        return res.status(404).json({
          success: false,
          error: 'Bet not found'
        });
      }

      // Check if bet can be deleted
      if (bet.status === constants.BET_STATUS.PENDING) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete pending bets'
        });
      }

      // Delete bet
      const deletedBet = await Bet.delete(parseInt(betId));

      logger.info(`Bet deleted: ${betId}`);

      return res.status(200).json({
        success: true,
        message: 'Bet deleted successfully',
        data: deletedBet
      });
    } catch (error) {
      logger.error('Delete bet error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete bet'
      });
    }
  }
}

module.exports = BetController;