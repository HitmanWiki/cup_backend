// src/models/Bet.js
const db = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class Bet {
  static tableName = 'bets';

  static async create(betData) {
    try {
      const query = `
        INSERT INTO ${this.tableName} 
        (
          bet_id, user_address, match_id, outcome, amount, 
          potential_win, odds, status, claimed, placed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const values = [
        betData.bet_id,
        betData.user_address.toLowerCase(),
        betData.match_id,
        betData.outcome,
        betData.amount,
        betData.potential_win,
        betData.odds,
        betData.status || constants.BET_STATUS.PENDING,
        betData.claimed || false
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating bet:', error);
      throw error;
    }
  }

  static async findById(betId) {
    try {
      const query = `
        SELECT b.*, m.team_a, m.team_b, m.match_date, m.status as match_status
        FROM ${this.tableName} b
        LEFT JOIN matches m ON b.match_id = m.match_id
        WHERE b.bet_id = $1
      `;

      const result = await db.query(query, [betId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding bet by ID:', error);
      throw error;
    }
  }

  static async findByUser(walletAddress, filters = {}, pagination = {}) {
    try {
      const { status, match_id, outcome, claimed } = filters;
      
      const {
        page = 1,
        limit = constants.PAGINATION.DEFAULT_LIMIT,
        sort_by = 'placed_at',
        sort_order = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;
      const conditions = ['b.user_address = $1'];
      const values = [walletAddress.toLowerCase()];
      let index = 2;

      if (status) {
        conditions.push(`b.status = $${index}`);
        values.push(status);
        index++;
      }

      if (match_id) {
        conditions.push(`b.match_id = $${index}`);
        values.push(match_id);
        index++;
      }

      if (outcome !== undefined) {
        conditions.push(`b.outcome = $${index}`);
        values.push(outcome);
        index++;
      }

      if (claimed !== undefined) {
        conditions.push(`b.claimed = $${index}`);
        values.push(claimed);
        index++;
      }

      // Validate sort column
      const validSortColumns = [
        'placed_at', 'amount', 'potential_win', 'odds',
        'result_set_at', 'claimed_at'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'placed_at';
      const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName} b
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          b.*,
          m.team_a,
          m.team_b,
          m.match_date,
          m.status as match_status,
          m.result as match_result
        FROM ${this.tableName} b
        LEFT JOIN matches m ON b.match_id = m.match_id
        ${whereClause}
        ORDER BY b.${sortColumn} ${order}
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
      logger.error('Error finding bets by user:', error);
      throw error;
    }
  }

  static async findByMatch(matchId, filters = {}, pagination = {}) {
    try {
      const { outcome, status } = filters;
      
      const {
        page = 1,
        limit = constants.PAGINATION.DEFAULT_LIMIT,
        sort_by = 'amount',
        sort_order = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;
      const conditions = ['b.match_id = $1'];
      const values = [matchId];
      let index = 2;

      if (outcome !== undefined) {
        conditions.push(`b.outcome = $${index}`);
        values.push(outcome);
        index++;
      }

      if (status) {
        conditions.push(`b.status = $${index}`);
        values.push(status);
        index++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName} b
        ${whereClause}
      `;

      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          b.*,
          u.username
        FROM ${this.tableName} b
        LEFT JOIN users u ON b.user_address = u.wallet_address
        ${whereClause}
        ORDER BY b.${sort_by} ${sort_order}
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
      logger.error('Error finding bets by match:', error);
      throw error;
    }
  }

  static async update(betId, updateData) {
    try {
      const fields = [];
      const values = [];
      let index = 1;

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = $${index}`);
          
          if (key === 'result_set_at' || key === 'claimed_at') {
            values.push(updateData[key] === true ? 'NOW()' : updateData[key]);
          } else {
            values.push(updateData[key]);
          }
          
          index++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(betId);
      
      const query = `
        UPDATE ${this.tableName} 
        SET ${fields.join(', ')}
        WHERE bet_id = $${index}
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating bet:', error);
      throw error;
    }
  }

  static async updateStatusForMatch(matchId, result) {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET 
          status = CASE 
            WHEN outcome = $1 THEN $2
            ELSE $3
          END,
          result_set_at = NOW()
        WHERE match_id = $4 AND status = $5
        RETURNING *
      `;

      const values = [
        result,
        constants.BET_STATUS.WON,
        constants.BET_STATUS.LOST,
        matchId,
        constants.BET_STATUS.PENDING
      ];

      const resultData = await db.query(query, values);
      return resultData.rows;
    } catch (error) {
      logger.error('Error updating bet status for match:', error);
      throw error;
    }
  }

  static async claim(betId, userAddress) {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET 
          claimed = TRUE,
          claimed_at = NOW()
        WHERE bet_id = $1 AND user_address = $2 AND status = $3
        RETURNING *
      `;

      const result = await db.query(query, [
        betId,
        userAddress.toLowerCase(),
        constants.BET_STATUS.WON
      ]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error claiming bet:', error);
      throw error;
    }
  }

  static async getUserActiveBets(walletAddress) {
    try {
      const query = `
        SELECT 
          b.*,
          m.team_a,
          m.team_b,
          m.match_date,
          m.status as match_status
        FROM ${this.tableName} b
        LEFT JOIN matches m ON b.match_id = m.match_id
        WHERE 
          b.user_address = $1 AND 
          b.status = $2 AND
          m.status IN ($3, $4)
        ORDER BY m.match_date ASC
      `;

      const result = await db.query(query, [
        walletAddress.toLowerCase(),
        constants.BET_STATUS.PENDING,
        constants.MATCH_STATUS.UPCOMING,
        constants.MATCH_STATUS.LIVE
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user active bets:', error);
      throw error;
    }
  }

  static async getUserWinningBets(walletAddress) {
    try {
      const query = `
        SELECT 
          b.*,
          m.team_a,
          m.team_b,
          m.match_date
        FROM ${this.tableName} b
        LEFT JOIN matches m ON b.match_id = m.match_id
        WHERE 
          b.user_address = $1 AND 
          b.status = $2
        ORDER BY b.placed_at DESC
      `;

      const result = await db.query(query, [
        walletAddress.toLowerCase(),
        constants.BET_STATUS.WON
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user winning bets:', error);
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_bets,
          COUNT(CASE WHEN status = $1 THEN 1 END) as pending_bets,
          COUNT(CASE WHEN status = $2 THEN 1 END) as won_bets,
          COUNT(CASE WHEN status = $3 THEN 1 END) as lost_bets,
          SUM(CASE WHEN status = $2 THEN potential_win ELSE 0 END) as total_potential_winnings,
          SUM(amount) as total_staked,
          AVG(odds) as average_odds,
          MAX(amount) as largest_bet,
          MIN(amount) as smallest_bet
        FROM ${this.tableName}
        WHERE user_address = $4
      `;

      const result = await db.query(query, [
        constants.BET_STATUS.PENDING,
        constants.BET_STATUS.WON,
        constants.BET_STATUS.LOST,
        walletAddress.toLowerCase()
      ]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user bet stats:', error);
      throw error;
    }
  }

  static async getMatchBetStats(matchId) {
    try {
      const query = `
        SELECT 
          outcome,
          COUNT(*) as bet_count,
          SUM(amount) as total_amount,
          AVG(amount) as average_bet,
          MAX(amount) as largest_bet
        FROM ${this.tableName}
        WHERE match_id = $1 AND status = $2
        GROUP BY outcome
        ORDER BY outcome
      `;

      const result = await db.query(query, [
        matchId,
        constants.BET_STATUS.PENDING
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting match bet stats:', error);
      throw error;
    }
  }

  static async getRecentBets(limit = 20) {
    try {
      const query = `
        SELECT 
          b.*,
          u.username,
          m.team_a,
          m.team_b
        FROM ${this.tableName} b
        LEFT JOIN users u ON b.user_address = u.wallet_address
        LEFT JOIN matches m ON b.match_id = m.match_id
        ORDER BY b.placed_at DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent bets:', error);
      throw error;
    }
  }

  static async getLargestBets(limit = 10) {
    try {
      const query = `
        SELECT 
          b.*,
          u.username,
          m.team_a,
          m.team_b,
          m.match_date
        FROM ${this.tableName} b
        LEFT JOIN users u ON b.user_address = u.wallet_address
        LEFT JOIN matches m ON b.match_id = m.match_id
        WHERE b.status = $1
        ORDER BY b.amount DESC
        LIMIT $2
      `;

      const result = await db.query(query, [
        constants.BET_STATUS.PENDING,
        limit
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting largest bets:', error);
      throw error;
    }
  }

  static async getTotalStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_bets,
          SUM(amount) as total_volume,
          COUNT(CASE WHEN status = $1 THEN 1 END) as active_bets,
          COUNT(CASE WHEN status = $2 THEN 1 END) as won_bets,
          COUNT(CASE WHEN status = $3 THEN 1 END) as lost_bets,
          AVG(amount) as average_bet_size,
          MAX(amount) as largest_bet,
          MIN(amount) as smallest_bet
        FROM ${this.tableName}
      `;

      const result = await db.query(query, [
        constants.BET_STATUS.PENDING,
        constants.BET_STATUS.WON,
        constants.BET_STATUS.LOST
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting total bet stats:', error);
      throw error;
    }
  }

  static async delete(betId) {
    try {
      const query = `
        DELETE FROM ${this.tableName} 
        WHERE bet_id = $1
        RETURNING *
      `;

      const result = await db.query(query, [betId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error deleting bet:', error);
      throw error;
    }
  }

  static async exists(betId) {
    try {
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${this.tableName} 
          WHERE bet_id = $1
        )
      `;

      const result = await db.query(query, [betId]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Error checking if bet exists:', error);
      throw error;
    }
  }
}

module.exports = Bet;