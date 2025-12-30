// src/models/Leaderboard.js
const db = require('../config/database');
const logger = require('../utils/logger');

class Leaderboard {
  static tableName = 'leaderboard';

  static async updateOrCreate(userData) {
    try {
      const query = `
        INSERT INTO ${this.tableName} 
        (user_address, total_winnings, total_bets, win_rate, streak, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_address) 
        DO UPDATE SET 
          total_winnings = EXCLUDED.total_winnings,
          total_bets = EXCLUDED.total_bets,
          win_rate = EXCLUDED.win_rate,
          streak = EXCLUDED.streak,
          updated_at = NOW()
        RETURNING *
      `;

      const values = [
        userData.user_address.toLowerCase(),
        userData.total_winnings || 0,
        userData.total_bets || 0,
        userData.win_rate || 0,
        userData.streak || 0
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      throw error;
    }
  }

  static async getRankings(filters = {}, pagination = {}) {
    try {
      const { min_bets, min_winnings } = filters;
      
      const {
        page = 1,
        limit = 20,
        sort_by = 'total_winnings',
        sort_order = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;
      const conditions = [];
      const values = [];
      let index = 1;

      if (min_bets) {
        conditions.push(`total_bets >= $${index}`);
        values.push(min_bets);
        index++;
      }

      if (min_winnings) {
        conditions.push(`total_winnings >= $${index}`);
        values.push(min_winnings);
        index++;
      }

      // Validate sort column
      const validSortColumns = [
        'total_winnings', 'total_bets', 'win_rate', 'streak', 'updated_at'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'total_winnings';
      const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName} 
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          l.*,
          u.username,
          ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${order}) as rank
        FROM ${this.tableName} l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        ${whereClause}
        ORDER BY ${sortColumn} ${order}
        LIMIT $${index} OFFSET $${index + 1}
      `;

      const dataValues = [...values, limit, offset];
      const dataResult = await db.query(dataQuery, dataValues);

      return {
        data: dataResult.rows,
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
      const query = `
        SELECT 
          l.*,
          u.username,
          RANK() OVER (ORDER BY l.total_winnings DESC) as rank
        FROM ${this.tableName} l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        ORDER BY l.total_winnings DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting top winners:', error);
      throw error;
    }
  }

  static async getTopWinRate(limit = 10) {
    try {
      const query = `
        SELECT 
          l.*,
          u.username,
          RANK() OVER (ORDER BY l.win_rate DESC) as rank
        FROM ${this.tableName} l
        LEFT JOIN users u ON l.user_address = u.wallet_address
        WHERE l.total_bets >= 10
        ORDER BY l.win_rate DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting top win rate:', error);
      throw error;
    }
  }

  static async getTopVolume(limit = 10) {
    try {
      const query = `
        SELECT 
          u.wallet_address,
          u.username,
          COALESCE(SUM(b.amount), 0) as total_volume,
          COUNT(b.id) as total_bets
        FROM users u
        LEFT JOIN bets b ON u.wallet_address = b.user_address
        WHERE b.amount IS NOT NULL
        GROUP BY u.wallet_address, u.username
        ORDER BY total_volume DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting top volume:', error);
      throw error;
    }
  }

  static async getUserRank(walletAddress) {
    try {
      const query = `
        WITH ranked_users AS (
          SELECT 
            user_address,
            total_winnings,
            ROW_NUMBER() OVER (ORDER BY total_winnings DESC) as rank
          FROM ${this.tableName}
        )
        SELECT 
          r.rank,
          r.total_winnings,
          (SELECT COUNT(*) FROM ${this.tableName}) as total_users
        FROM ranked_users r
        WHERE r.user_address = $1
      `;

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user rank:', error);
      throw error;
    }
  }

  static async updateAllRanks() {
    try {
      const query = `
        UPDATE ${this.tableName} l
        SET rank = r.rank
        FROM (
          SELECT 
            user_address,
            ROW_NUMBER() OVER (ORDER BY total_winnings DESC) as rank
          FROM ${this.tableName}
        ) r
        WHERE l.user_address = r.user_address
      `;

      const result = await db.query(query);
      return result.rowCount;
    } catch (error) {
      logger.error('Error updating all ranks:', error);
      throw error;
    }
  }

  static async getUserStreak(walletAddress) {
    try {
      // Get recent bets to calculate streak
      const query = `
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

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user streak:', error);
      throw error;
    }
  }

  static async getGlobalStats() {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT user_address) as total_players,
          SUM(total_winnings) as total_payouts,
          AVG(total_winnings) as average_winnings,
          AVG(win_rate) as average_win_rate,
          MAX(total_winnings) as top_winner_amount,
          (SELECT username FROM users u 
           JOIN ${this.tableName} l ON u.wallet_address = l.user_address 
           ORDER BY l.total_winnings DESC LIMIT 1) as top_winner_name
        FROM ${this.tableName}
      `;

      const result = await db.query(query);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting global stats:', error);
      throw error;
    }
  }

  static async getWeeklyLeaderboard() {
    try {
      const query = `
        SELECT 
          b.user_address,
          u.username,
          SUM(b.amount) as weekly_volume,
          COUNT(b.id) as weekly_bets,
          SUM(CASE WHEN b.status = 'won' THEN b.potential_win ELSE 0 END) as weekly_winnings
        FROM bets b
        LEFT JOIN users u ON b.user_address = u.wallet_address
        WHERE b.placed_at >= NOW() - INTERVAL '7 days'
        GROUP BY b.user_address, u.username
        ORDER BY weekly_winnings DESC
        LIMIT 20
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting weekly leaderboard:', error);
      throw error;
    }
  }

  static async getMonthlyLeaderboard() {
    try {
      const query = `
        SELECT 
          b.user_address,
          u.username,
          SUM(b.amount) as monthly_volume,
          COUNT(b.id) as monthly_bets,
          SUM(CASE WHEN b.status = 'won' THEN b.potential_win ELSE 0 END) as monthly_winnings
        FROM bets b
        LEFT JOIN users u ON b.user_address = u.wallet_address
        WHERE b.placed_at >= NOW() - INTERVAL '30 days'
        GROUP BY b.user_address, u.username
        ORDER BY monthly_winnings DESC
        LIMIT 20
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting monthly leaderboard:', error);
      throw error;
    }
  }

  static async delete(userAddress) {
    try {
      const query = `
        DELETE FROM ${this.tableName} 
        WHERE user_address = $1
        RETURNING *
      `;

      const result = await db.query(query, [userAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error deleting leaderboard entry:', error);
      throw error;
    }
  }

  static async exists(userAddress) {
    try {
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${this.tableName} 
          WHERE user_address = $1
        )
      `;

      const result = await db.query(query, [userAddress.toLowerCase()]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Error checking if leaderboard entry exists:', error);
      throw error;
    }
  }
}

module.exports = Leaderboard;