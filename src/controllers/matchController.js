// src/controllers/matchController.js
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const web3Service = require('../services/web3Service');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class MatchController {
  // Get all matches with filters
  static async getMatches(req, res) {
    try {
      const {
        status,
        group,
        team,
        start_date,
        end_date,
        has_result,
        page = 1,
        limit = constants.PAGINATION.DEFAULT_LIMIT,
        sort_by = 'match_date',
        sort_order = 'ASC'
      } = req.query;

      const filters = {
        status,
        group_name: group,
        team,
        start_date,
        end_date,
        has_result: has_result === 'true' ? true : has_result === 'false' ? false : undefined
      };

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), constants.PAGINATION.MAX_LIMIT),
        sort_by,
        sort_order
      };

      const result = await Match.findAll(filters, pagination);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get matches error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get matches'
      });
    }
  }

  // Get single match by ID
  static async getMatchById(req, res) {
    try {
      const { matchId } = req.params;
      
      const match = await Match.findById(parseInt(matchId));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }
      
      // Get match stats
      const stats = await Match.getMatchStats(parseInt(matchId));
      
      return res.status(200).json({
        success: true,
        data: {
          match,
          stats
        }
      });
    } catch (error) {
      logger.error('Get match by ID error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get match'
      });
    }
  }

  // Create new match (admin only)
  static async createMatch(req, res) {
    try {
      const {
        team_a,
        team_b,
        match_date,
        venue,
        group_name,
        odds_team_a,
        odds_draw,
        odds_team_b
      } = req.body;

      // Validate required fields
      if (!team_a || !team_b || !match_date || !odds_team_a || !odds_draw || !odds_team_b) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      // Validate odds
      if (
        odds_team_a < constants.BETTING_LIMITS.MIN_ODDS ||
        odds_draw < constants.BETTING_LIMITS.MIN_ODDS ||
        odds_team_b < constants.BETTING_LIMITS.MIN_ODDS ||
        odds_team_a > constants.BETTING_LIMITS.MAX_ODDS ||
        odds_draw > constants.BETTING_LIMITS.MAX_ODDS ||
        odds_team_b > constants.BETTING_LIMITS.MAX_ODDS
      ) {
        return res.status(400).json({
          success: false,
          error: `Odds must be between ${constants.BETTING_LIMITS.MIN_ODDS} and ${constants.BETTING_LIMITS.MAX_ODDS}`
        });
      }

      // Validate match date is in future
      const matchDate = new Date(match_date);
      if (matchDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Match date must be in the future'
        });
      }

      // Create match on blockchain
      const matchData = {
        team_a,
        team_b,
        match_date: matchDate,
        venue,
        group_name,
        odds_team_a: parseFloat(odds_team_a),
        odds_draw: parseFloat(odds_draw),
        odds_team_b: parseFloat(odds_team_b)
      };

      const chainResult = await web3Service.createMatchOnChain(matchData);
      
      // Create match in database
      const dbMatch = await Match.create({
        match_id: chainResult.matchId,
        ...matchData
      });

      logger.info(`Match created: ${chainResult.matchId} - ${team_a} vs ${team_b}`);

      return res.status(201).json({
        success: true,
        message: 'Match created successfully',
        data: {
          match: dbMatch,
          chain: {
            txHash: chainResult.txHash,
            matchId: chainResult.matchId
          }
        }
      });
    } catch (error) {
      logger.error('Create match error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to create match'
      });
    }
  }

  // Update match (admin only)
  static async updateMatch(req, res) {
    try {
      const { matchId } = req.params;
      const updateData = req.body;

      // Validate match exists
      const match = await Match.findById(parseInt(matchId));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      // Don't allow updating certain fields if bets are placed
      if (match.total_staked > 0) {
        const restrictedFields = ['odds_team_a', 'odds_draw', 'odds_team_b', 'match_date'];
        const hasRestrictedFields = Object.keys(updateData).some(field => 
          restrictedFields.includes(field)
        );

        if (hasRestrictedFields) {
          return res.status(400).json({
            success: false,
            error: 'Cannot update odds or date after bets have been placed'
          });
        }
      }

      // Update match
      const updatedMatch = await Match.update(parseInt(matchId), updateData);

      if (!updatedMatch) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update match'
        });
      }

      logger.info(`Match updated: ${matchId}`);

      return res.status(200).json({
        success: true,
        message: 'Match updated successfully',
        data: updatedMatch
      });
    } catch (error) {
      logger.error('Update match error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update match'
      });
    }
  }

  // Update match status (admin only)
  static async updateMatchStatus(req, res) {
    try {
      const { matchId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = Object.values(constants.MATCH_STATUS);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Validate match exists
      const match = await Match.findById(parseInt(matchId));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      // Update on blockchain if needed
      if (status === constants.MATCH_STATUS.FINISHED) {
        // Only update blockchain when match is finished
        // The actual result will be set separately
      }

      // Update in database
      const updatedMatch = await Match.update(parseInt(matchId), { status });

      logger.info(`Match status updated: ${matchId} -> ${status}`);

      return res.status(200).json({
        success: true,
        message: 'Match status updated successfully',
        data: updatedMatch
      });
    } catch (error) {
      logger.error('Update match status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update match status'
      });
    }
  }

  // Set match result (admin/oracle only)
  static async setMatchResult(req, res) {
    try {
      const { matchId } = req.params;
      const { result, verified_by } = req.body;

      // Validate result
      const validResults = Object.values(constants.OUTCOMES);
      if (!validResults.includes(parseInt(result))) {
        return res.status(400).json({
          success: false,
          error: `Invalid result. Must be one of: ${validResults.join(', ')}`
        });
      }

      // Validate match exists and is finished
      const match = await Match.findById(parseInt(matchId));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      if (match.status !== constants.MATCH_STATUS.FINISHED) {
        return res.status(400).json({
          success: false,
          error: 'Match must be finished to set result'
        });
      }

      if (match.result !== null) {
        return res.status(400).json({
          success: false,
          error: 'Result already set for this match'
        });
      }

      // Set result on blockchain
      const chainResult = await web3Service.setMatchResultOnChain(
        parseInt(matchId),
        parseInt(result)
      );

      logger.info(`Match result set: ${matchId} -> ${result}`);

      return res.status(200).json({
        success: true,
        message: 'Match result set successfully',
        data: {
          matchId,
          result,
          chain: {
            txHash: chainResult.txHash
          }
        }
      });
    } catch (error) {
      logger.error('Set match result error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to set match result'
      });
    }
  }

  // Get match bets
  static async getMatchBets(req, res) {
    try {
      const { matchId } = req.params;
      const {
        outcome,
        status,
        page = 1,
        limit = 20,
        sort_by = 'amount',
        sort_order = 'DESC'
      } = req.query;

      const filters = {
        outcome: outcome !== undefined ? parseInt(outcome) : undefined,
        status
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by,
        sort_order
      };

      const result = await Bet.findByMatch(parseInt(matchId), filters, pagination);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get match bets error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get match bets'
      });
    }
  }

  // Get match statistics
  static async getMatchStats(req, res) {
    try {
      const { matchId } = req.params;
      
      const stats = await Match.getMatchStats(parseInt(matchId));
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }
      
      // Get bet distribution
      const betStats = await Bet.getMatchBetStats(parseInt(matchId));
      
      return res.status(200).json({
        success: true,
        data: {
          match: stats,
          bets: betStats
        }
      });
    } catch (error) {
      logger.error('Get match stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get match statistics'
      });
    }
  }

  // Get upcoming matches
  static async getUpcomingMatches(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const matches = await Match.getUpcomingMatches(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Get upcoming matches error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get upcoming matches'
      });
    }
  }

  // Get live matches
  static async getLiveMatches(req, res) {
    try {
      const matches = await Match.getLiveMatches();
      
      return res.status(200).json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Get live matches error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get live matches'
      });
    }
  }

  // Get finished matches
  static async getFinishedMatches(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const matches = await Match.getFinishedMatches(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Get finished matches error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get finished matches'
      });
    }
  }

  // Get popular matches
  static async getPopularMatches(req, res) {
    try {
      const { limit = 5 } = req.query;
      
      const matches = await Match.getPopularMatches(parseInt(limit));
      
      return res.status(200).json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Get popular matches error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get popular matches'
      });
    }
  }

  // Get matches by group
  static async getMatchesByGroup(req, res) {
    try {
      const { groupName } = req.params;
      
      const matches = await Match.getMatchesByGroup(groupName);
      
      return res.status(200).json({
        success: true,
        data: matches
      });
    } catch (error) {
      logger.error('Get matches by group error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get matches by group'
      });
    }
  }

  // Delete match (admin only)
  static async deleteMatch(req, res) {
    try {
      const { matchId } = req.params;

      // Validate match exists
      const match = await Match.findById(parseInt(matchId));
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      // Check if bets have been placed
      if (match.total_staked > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete match with active bets'
        });
      }

      // Delete match
      const deletedMatch = await Match.delete(parseInt(matchId));

      logger.info(`Match deleted: ${matchId}`);

      return res.status(200).json({
        success: true,
        message: 'Match deleted successfully',
        data: deletedMatch
      });
    } catch (error) {
      logger.error('Delete match error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete match'
      });
    }
  }
}

module.exports = MatchController;