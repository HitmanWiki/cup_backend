// src/models/Bet.js
const prisma = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class Bet {
  static async create(betData) {
    try {
      const bet = await prisma.bet.create({
        data: {
          bet_id: betData.bet_id,
          user_address: betData.user_address.toLowerCase(),
          match_id: parseInt(betData.match_id),
          outcome: parseInt(betData.outcome),
          amount: parseFloat(betData.amount),
          potential_win: parseFloat(betData.potential_win),
          odds: parseFloat(betData.odds),
          status: betData.status || constants.BET_STATUS.PENDING,
          claimed: betData.claimed ? 1 : 0, // Convert boolean to 0/1
          placed_at: new Date()
        }
      });
      return bet;
    } catch (error) {
      logger.error('Error creating bet:', error);
      throw error;
    }
  }

  static async findById(betId) {
    try {
      const bet = await prisma.bet.findFirst({
        where: { bet_id: parseInt(betId) },
        include: {
          match: {
            select: {
              team_a: true,
              team_b: true,
              match_date: true,
              status: true
            }
          }
        }
      });
      return bet;
    } catch (error) {
      logger.error('Error finding bet by ID:', error);
      throw error;
    }
  }

  static async findByUser(walletAddress, filters = {}, pagination = {}) {
    try {
      const { status, match_id, outcome, claimed } = filters;
      
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || constants.PAGINATION.DEFAULT_LIMIT;
      const sort_by = pagination.sort_by || 'placed_at';
      const sort_order = pagination.sort_order || 'desc';
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {
        user_address: walletAddress.toLowerCase()
      };
      
      if (status) where.status = status;
      if (match_id) where.match_id = parseInt(match_id);
      if (outcome !== undefined) where.outcome = parseInt(outcome);
      if (claimed !== undefined) where.claimed = claimed ? 1 : 0; // Convert boolean to 0/1
      
      // Validate sort column
      const validSortColumns = [
        'placed_at', 'amount', 'potential_win', 'odds',
        'result_set_at', 'claimed_at'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'placed_at';
      const order = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';
      
      // Get total count
      const total = await prisma.bet.count({ where });
      
      // Get paginated results
      const bets = await prisma.bet.findMany({
        where,
        include: {
          match: {
            select: {
              team_a: true,
              team_b: true,
              match_date: true,
              status: true,
              result: true
            }
          }
        },
        orderBy: { [sortColumn]: order },
        skip,
        take: limit
      });
      
      return {
        data: bets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding bets by user:', error);
      throw error;
    }
  }

  static async findByMatch(matchId, filters = {}, pagination = {}) {
    try {
      const { outcome, status } = filters;
      
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || constants.PAGINATION.DEFAULT_LIMIT;
      const sort_by = pagination.sort_by || 'amount';
      const sort_order = pagination.sort_order || 'desc';
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {
        match_id: parseInt(matchId)
      };
      
      if (outcome !== undefined) where.outcome = parseInt(outcome);
      if (status) where.status = status;
      
      // Get total count
      const total = await prisma.bet.count({ where });
      
      // Get paginated results
      const bets = await prisma.bet.findMany({
        where,
        include: {
          user: {
            select: {
              username: true
            }
          }
        },
        orderBy: { [sort_by]: sort_order },
        skip,
        take: limit
      });
      
      return {
        data: bets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding bets by match:', error);
      throw error;
    }
  }

  static async update(betId, updateData) {
    try {
      // Prepare data for update
      const data = {};
      
      // Handle special fields
      if (updateData.status !== undefined) data.status = updateData.status;
      if (updateData.claimed !== undefined) data.claimed = updateData.claimed ? 1 : 0; // Convert boolean to 0/1
      if (updateData.result_set_at !== undefined) {
        data.result_set_at = updateData.result_set_at === true ? new Date() : updateData.result_set_at;
      }
      if (updateData.claimed_at !== undefined) {
        data.claimed_at = updateData.claimed_at === true ? new Date() : updateData.claimed_at;
      }
      
      // Update other fields
      const otherFields = ['amount', 'potential_win', 'odds', 'outcome'];
      otherFields.forEach(field => {
        if (updateData[field] !== undefined) data[field] = updateData[field];
      });
      
      if (Object.keys(data).length === 0) {
        throw new Error('No fields to update');
      }
      
      const bet = await prisma.bet.update({
        where: { bet_id: parseInt(betId) },
        data
      });
      
      return bet;
    } catch (error) {
      logger.error('Error updating bet:', error);
      throw error;
    }
  }

  static async updateStatusForMatch(matchId, result) {
    try {
      // Find all pending bets for this match
      const pendingBets = await prisma.bet.findMany({
        where: {
          match_id: parseInt(matchId),
          status: constants.BET_STATUS.PENDING
        }
      });
      
      const updatePromises = [];
      
      for (const bet of pendingBets) {
        const newStatus = bet.outcome === parseInt(result) 
          ? constants.BET_STATUS.WON 
          : constants.BET_STATUS.LOST;
        
        updatePromises.push(
          prisma.bet.update({
            where: { id: bet.id },
            data: {
              status: newStatus,
              result_set_at: new Date()
            }
          })
        );
      }
      
      const updatedBets = await Promise.all(updatePromises);
      return updatedBets;
    } catch (error) {
      logger.error('Error updating bet status for match:', error);
      throw error;
    }
  }

  static async claim(betId, userAddress) {
    try {
      const bet = await prisma.bet.update({
        where: {
          bet_id: parseInt(betId),
          user_address: userAddress.toLowerCase(),
          status: constants.BET_STATUS.WON
        },
        data: {
          claimed: 1, // Changed from true to 1
          claimed_at: new Date()
        }
      });
      return bet;
    } catch (error) {
      // If bet not found or not won
      if (error.code === 'P2025') {
        return null;
      }
      logger.error('Error claiming bet:', error);
      throw error;
    }
  }

  static async getUserActiveBets(walletAddress) {
    try {
      const bets = await prisma.bet.findMany({
        where: {
          user_address: walletAddress.toLowerCase(),
          status: constants.BET_STATUS.PENDING,
          match: {
            status: {
              in: [constants.MATCH_STATUS.UPCOMING, constants.MATCH_STATUS.LIVE]
            }
          }
        },
        include: {
          match: {
            select: {
              team_a: true,
              team_b: true,
              match_date: true,
              status: true
            }
          }
        },
        orderBy: {
          match: {
            match_date: 'asc'
          }
        }
      });
      return bets;
    } catch (error) {
      logger.error('Error getting user active bets:', error);
      throw error;
    }
  }

  static async getUserWinningBets(walletAddress) {
    try {
      const bets = await prisma.bet.findMany({
        where: {
          user_address: walletAddress.toLowerCase(),
          status: constants.BET_STATUS.WON
        },
        include: {
          match: {
            select: {
              team_a: true,
              team_b: true,
              match_date: true
            }
          }
        },
        orderBy: {
          placed_at: 'desc'
        }
      });
      return bets;
    } catch (error) {
      logger.error('Error getting user winning bets:', error);
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const stats = await prisma.bet.groupBy({
        by: ['status'],
        where: {
          user_address: walletAddress.toLowerCase()
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true,
          potential_win: true
        },
        _avg: {
          odds: true
        },
        _max: {
          amount: true
        },
        _min: {
          amount: true
        }
      });
      
      // Transform the result
      const result = {
        total_bets: 0,
        pending_bets: 0,
        won_bets: 0,
        lost_bets: 0,
        total_potential_winnings: 0,
        total_staked: 0,
        average_odds: 0,
        largest_bet: 0,
        smallest_bet: 0
      };
      
      stats.forEach(stat => {
        const count = stat._count.id || 0;
        result.total_bets += count;
        
        if (stat.status === constants.BET_STATUS.PENDING) {
          result.pending_bets = count;
        } else if (stat.status === constants.BET_STATUS.WON) {
          result.won_bets = count;
          result.total_potential_winnings = stat._sum.potential_win || 0;
        } else if (stat.status === constants.BET_STATUS.LOST) {
          result.lost_bets = count;
        }
        
        result.total_staked += stat._sum.amount || 0;
      });
      
      // Calculate average odds
      const totalOdds = stats.reduce((sum, stat) => {
        return sum + (stat._avg.odds || 0) * (stat._count.id || 0);
      }, 0);
      
      result.average_odds = result.total_bets > 0 ? totalOdds / result.total_bets : 0;
      
      // Get largest and smallest bet
      const amounts = stats.flatMap(stat => [
        stat._max.amount || 0,
        stat._min.amount || 0
      ]).filter(amount => amount > 0);
      
      result.largest_bet = amounts.length > 0 ? Math.max(...amounts) : 0;
      result.smallest_bet = amounts.length > 0 ? Math.min(...amounts) : 0;
      
      return result;
    } catch (error) {
      logger.error('Error getting user bet stats:', error);
      throw error;
    }
  }

  static async getMatchBetStats(matchId) {
    try {
      const stats = await prisma.bet.groupBy({
        by: ['outcome'],
        where: {
          match_id: parseInt(matchId),
          status: constants.BET_STATUS.PENDING
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        _avg: {
          amount: true
        },
        _max: {
          amount: true
        }
      });
      
      return stats.map(stat => ({
        outcome: stat.outcome,
        bet_count: stat._count.id,
        total_amount: stat._sum.amount,
        average_bet: stat._avg.amount,
        largest_bet: stat._max.amount
      }));
    } catch (error) {
      logger.error('Error getting match bet stats:', error);
      throw error;
    }
  }

  static async getRecentBets(limit = 20) {
    try {
      const bets = await prisma.bet.findMany({
        include: {
          user: {
            select: {
              username: true
            }
          },
          match: {
            select: {
              team_a: true,
              team_b: true
            }
          }
        },
        orderBy: {
          placed_at: 'desc'
        },
        take: parseInt(limit)
      });
      return bets;
    } catch (error) {
      logger.error('Error getting recent bets:', error);
      throw error;
    }
  }

  static async getLargestBets(limit = 10) {
    try {
      const bets = await prisma.bet.findMany({
        where: {
          status: constants.BET_STATUS.PENDING
        },
        include: {
          user: {
            select: {
              username: true
            }
          },
          match: {
            select: {
              team_a: true,
              team_b: true,
              match_date: true
            }
          }
        },
        orderBy: {
          amount: 'desc'
        },
        take: parseInt(limit)
      });
      return bets;
    } catch (error) {
      logger.error('Error getting largest bets:', error);
      throw error;
    }
  }

  static async getTotalStats() {
    try {
      const stats = await prisma.bet.groupBy({
        by: ['status'],
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        _avg: {
          amount: true
        },
        _max: {
          amount: true
        },
        _min: {
          amount: true
        }
      });
      
      const result = {
        total_bets: 0,
        total_volume: 0,
        active_bets: 0,
        won_bets: 0,
        lost_bets: 0,
        average_bet_size: 0,
        largest_bet: 0,
        smallest_bet: 0
      };
      
      stats.forEach(stat => {
        const count = stat._count.id || 0;
        result.total_bets += count;
        result.total_volume += stat._sum.amount || 0;
        
        if (stat.status === constants.BET_STATUS.PENDING) {
          result.active_bets = count;
        } else if (stat.status === constants.BET_STATUS.WON) {
          result.won_bets = count;
        } else if (stat.status === constants.BET_STATUS.LOST) {
          result.lost_bets = count;
        }
      });
      
      // Calculate averages
      result.average_bet_size = result.total_bets > 0 
        ? result.total_volume / result.total_bets 
        : 0;
      
      // Get largest and smallest bet
      const amounts = stats.flatMap(stat => [
        stat._max.amount || 0,
        stat._min.amount || 0
      ]).filter(amount => amount > 0);
      
      result.largest_bet = amounts.length > 0 ? Math.max(...amounts) : 0;
      result.smallest_bet = amounts.length > 0 ? Math.min(...amounts) : 0;
      
      return result;
    } catch (error) {
      logger.error('Error getting total bet stats:', error);
      throw error;
    }
  }

  static async delete(betId) {
    try {
      const bet = await prisma.bet.delete({
        where: { bet_id: parseInt(betId) }
      });
      return bet;
    } catch (error) {
      logger.error('Error deleting bet:', error);
      throw error;
    }
  }

  static async exists(betId) {
    try {
      const count = await prisma.bet.count({
        where: { bet_id: parseInt(betId) }
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking if bet exists:', error);
      throw error;
    }
  }
}

module.exports = Bet;