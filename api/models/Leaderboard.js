// src/models/Leaderboard.js
const prisma = require('../config/database');
const logger = require('../utils/logger');

class Leaderboard {
  static async updateOrCreate(userData) {
    try {
      const leaderboard = await prisma.leaderboard.upsert({
        where: {
          user_address: userData.user_address.toLowerCase()
        },
        update: {
          total_winnings: userData.total_winnings || 0,
          total_bets: userData.total_bets || 0,
          win_rate: userData.win_rate || 0,
          streak: userData.streak || 0,
          updated_at: new Date()
        },
        create: {
          user_address: userData.user_address.toLowerCase(),
          total_winnings: userData.total_winnings || 0,
          total_bets: userData.total_bets || 0,
          win_rate: userData.win_rate || 0,
          streak: userData.streak || 0,
          updated_at: new Date()
        }
      });
      return leaderboard;
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      throw error;
    }
  }

  static async getRankings(filters = {}, pagination = {}) {
    try {
      const { min_bets, min_winnings } = filters;
      
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 20;
      const sort_by = pagination.sort_by || 'total_winnings';
      const sort_order = pagination.sort_order || 'desc';
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {};
      
      if (min_bets) {
        where.total_bets = {
          gte: parseInt(min_bets)
        };
      }
      
      if (min_winnings) {
        where.total_winnings = {
          gte: parseFloat(min_winnings)
        };
      }
      
      // Validate sort column
      const validSortColumns = [
        'total_winnings', 'total_bets', 'win_rate', 'streak', 'updated_at'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'total_winnings';
      const order = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';
      
      // Get total count
      const total = await prisma.leaderboard.count({ where });
      
      // Get paginated results with rank calculation
      // We need raw query for ROW_NUMBER() window function
      const whereConditions = [];
      const values = [limit, skip];
      let paramIndex = 3;
      
      if (min_bets) {
        whereConditions.push(`total_bets >= $${paramIndex}`);
        values.push(min_bets);
        paramIndex++;
      }
      
      if (min_winnings) {
        whereConditions.push(`total_winnings >= $${paramIndex}`);
        values.push(min_winnings);
        paramIndex++;
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      const rawQuery = `
        SELECT 
          l.*,
          u.username,
          ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${order}) as rank
        FROM leaderboard l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        ${whereClause}
        ORDER BY ${sortColumn} ${order}
        LIMIT $1 OFFSET $2
      `;
      
      const rankings = await prisma.$queryRawUnsafe(rawQuery, ...values);
      
      return {
        data: rankings,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting leaderboard rankings:', error);
      throw error;
    }
  }

  static async getTopWinners(limit = 10) {
    try {
      const rawQuery = `
        SELECT 
          l.*,
          u.username,
          RANK() OVER (ORDER BY l.total_winnings DESC) as rank
        FROM leaderboard l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        ORDER BY l.total_winnings DESC
        LIMIT $1
      `;
      
      const topWinners = await prisma.$queryRawUnsafe(rawQuery, parseInt(limit));
      return topWinners;
    } catch (error) {
      logger.error('Error getting top winners:', error);
      throw error;
    }
  }

  static async getTopWinRate(limit = 10) {
    try {
      const rawQuery = `
        SELECT 
          l.*,
          u.username,
          RANK() OVER (ORDER BY l.win_rate DESC) as rank
        FROM leaderboard l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        WHERE l.total_bets >= 10
        ORDER BY l.win_rate DESC
        LIMIT $1
      `;
      
      const topWinRate = await prisma.$queryRawUnsafe(rawQuery, parseInt(limit));
      return topWinRate;
    } catch (error) {
      logger.error('Error getting top win rate:', error);
      throw error;
    }
  }

  static async getTopVolume(limit = 10) {
    try {
      const topVolume = await prisma.user.findMany({
        select: {
          wallet_address: true,
          username: true,
          bets: {
            select: {
              amount: true
            },
            where: {
              amount: {
                not: null
              }
            }
          }
        },
        orderBy: {
          bets: {
            _count: 'desc'
          }
        },
        take: parseInt(limit)
      });
      
      // Transform the result to match the expected format
      return topVolume.map(user => {
        const totalVolume = user.bets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
        const totalBets = user.bets.length;
        
        return {
          wallet_address: user.wallet_address,
          username: user.username,
          total_volume: totalVolume,
          total_bets: totalBets
        };
      });
    } catch (error) {
      logger.error('Error getting top volume:', error);
      throw error;
    }
  }

  static async getUserRank(walletAddress) {
    try {
      const rawQuery = `
        WITH ranked_users AS (
          SELECT 
            user_address,
            total_winnings,
            ROW_NUMBER() OVER (ORDER BY total_winnings DESC) as rank
          FROM leaderboard
        )
        SELECT 
          r.rank,
          r.total_winnings,
          (SELECT COUNT(*) FROM leaderboard) as total_users
        FROM ranked_users r
        WHERE r.user_address = $1
      `;
      
      const userRank = await prisma.$queryRawUnsafe(rawQuery, walletAddress.toLowerCase());
      return userRank[0] || null;
    } catch (error) {
      logger.error('Error getting user rank:', error);
      throw error;
    }
  }

  static async updateAllRanks() {
    try {
      const rawQuery = `
        UPDATE leaderboard l
        SET rank = r.rank
        FROM (
          SELECT 
            user_address,
            ROW_NUMBER() OVER (ORDER BY total_winnings DESC) as rank
          FROM leaderboard
        ) r
        WHERE l.user_address = r.user_address
      `;
      
      const result = await prisma.$executeRawUnsafe(rawQuery);
      return result;
    } catch (error) {
      logger.error('Error updating all ranks:', error);
      throw error;
    }
  }

  static async getUserStreak(walletAddress) {
    try {
      const rawQuery = `
        WITH recent_bets AS (
          SELECT 
            b.status,
            b.placed_at,
            LAG(b.status) OVER (ORDER BY b.placed_at) as prev_status
          FROM bets b
          WHERE b.user_address = $1
          ORDER BY b.placed_at DESC
          LIMIT 20
        ),
        streak_calc AS (
          SELECT 
            status,
            SUM(CASE WHEN status = prev_status THEN 0 ELSE 1 END) 
              OVER (ORDER BY placed_at DESC) as streak_group
          FROM recent_bets
        ),
        current_streak AS (
          SELECT 
            status,
            COUNT(*) as streak_length
          FROM streak_calc
          WHERE streak_group = 0
          GROUP BY status
          ORDER BY streak_length DESC
          LIMIT 1
        )
        SELECT 
          status as current_streak_status,
          streak_length as current_streak_length
        FROM current_streak
      `;
      
      const streak = await prisma.$queryRawUnsafe(rawQuery, walletAddress.toLowerCase());
      return streak[0] || null;
    } catch (error) {
      logger.error('Error getting user streak:', error);
      throw error;
    }
  }

  static async getGlobalStats() {
    try {
      const rawQuery = `
        SELECT 
          COUNT(DISTINCT user_address) as total_players,
          SUM(total_winnings) as total_payouts,
          AVG(total_winnings) as average_winnings,
          AVG(win_rate) as average_win_rate,
          MAX(total_winnings) as top_winner_amount,
          (
            SELECT username 
            FROM users u 
            JOIN leaderboard l ON u.wallet_address = l.user_address 
            ORDER BY l.total_winnings DESC 
            LIMIT 1
          ) as top_winner_name
        FROM leaderboard
      `;
      
      const stats = await prisma.$queryRawUnsafe(rawQuery);
      return stats[0] || null;
    } catch (error) {
      logger.error('Error getting global stats:', error);
      throw error;
    }
  }

  static async getWeeklyLeaderboard() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const weeklyStats = await prisma.bet.groupBy({
        by: ['user_address'],
        where: {
          placed_at: {
            gte: oneWeekAgo
          }
        },
        _sum: {
          amount: true,
          potential_win: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            potential_win: 'desc'
          }
        },
        take: 20
      });
      
      // Get usernames for each user
      const userIds = weeklyStats.map(stat => stat.user_address);
      const users = await prisma.user.findMany({
        where: {
          wallet_address: {
            in: userIds
          }
        },
        select: {
          wallet_address: true,
          username: true
        }
      });
      
      const userMap = {};
      users.forEach(user => {
        userMap[user.wallet_address] = user.username;
      });
      
      return weeklyStats.map(stat => ({
        user_address: stat.user_address,
        username: userMap[stat.user_address] || null,
        weekly_volume: stat._sum.amount || 0,
        weekly_bets: stat._count.id || 0,
        weekly_winnings: stat._sum.potential_win || 0
      }));
    } catch (error) {
      logger.error('Error getting weekly leaderboard:', error);
      throw error;
    }
  }

  static async getMonthlyLeaderboard() {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const monthlyStats = await prisma.bet.groupBy({
        by: ['user_address'],
        where: {
          placed_at: {
            gte: oneMonthAgo
          }
        },
        _sum: {
          amount: true,
          potential_win: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            potential_win: 'desc'
          }
        },
        take: 20
      });
      
      // Get usernames for each user
      const userIds = monthlyStats.map(stat => stat.user_address);
      const users = await prisma.user.findMany({
        where: {
          wallet_address: {
            in: userIds
          }
        },
        select: {
          wallet_address: true,
          username: true
        }
      });
      
      const userMap = {};
      users.forEach(user => {
        userMap[user.wallet_address] = user.username;
      });
      
      return monthlyStats.map(stat => ({
        user_address: stat.user_address,
        username: userMap[stat.user_address] || null,
        monthly_volume: stat._sum.amount || 0,
        monthly_bets: stat._count.id || 0,
        monthly_winnings: stat._sum.potential_win || 0
      }));
    } catch (error) {
      logger.error('Error getting monthly leaderboard:', error);
      throw error;
    }
  }

  static async delete(userAddress) {
    try {
      const leaderboard = await prisma.leaderboard.delete({
        where: {
          user_address: userAddress.toLowerCase()
        }
      });
      return leaderboard;
    } catch (error) {
      logger.error('Error deleting leaderboard entry:', error);
      throw error;
    }
  }

  static async exists(userAddress) {
    try {
      const count = await prisma.leaderboard.count({
        where: {
          user_address: userAddress.toLowerCase()
        }
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking if leaderboard entry exists:', error);
      throw error;
    }
  }
}

module.exports = Leaderboard;