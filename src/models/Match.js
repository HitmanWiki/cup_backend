// src/models/Match.js
const db = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class Match {
  static tableName = 'matches';

  static async create(matchData) {
    try {
      const query = `
        INSERT INTO ${this.tableName} 
        (
          match_id, team_a, team_b, match_date, venue, group_name,
          odds_team_a, odds_draw, odds_team_b, status, total_staked,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *
      `;

      const values = [
        matchData.match_id,
        matchData.team_a,
        matchData.team_b,
        matchData.match_date,
        matchData.venue || null,
        matchData.group_name || null,
        matchData.odds_team_a,
        matchData.odds_draw,
        matchData.odds_team_b,
        matchData.status || constants.MATCH_STATUS.UPCOMING,
        matchData.total_staked || 0
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating match:', error);
      throw error;
    }
  }

  static async findById(matchId) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE match_id = $1
      `;

      const result = await db.query(query, [matchId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding match by ID:', error);
      throw error;
    }
  }

  static async findAll(filters = {}, pagination = {}) {
    try {
      const {
        status,
        group_name,
        team,
        start_date,
        end_date,
        has_result
      } = filters;

      const {
        page = 1,
        limit = constants.PAGINATION.DEFAULT_LIMIT,
        sort_by = 'match_date',
        sort_order = 'ASC'
      } = pagination;

      const offset = (page - 1) * limit;
      const conditions = [];
      const values = [];
      let index = 1;

      if (status) {
        conditions.push(`status = $${index}`);
        values.push(status);
        index++;
      }

      if (group_name) {
        conditions.push(`group_name = $${index}`);
        values.push(group_name);
        index++;
      }

      if (team) {
        conditions.push(`(team_a ILIKE $${index} OR team_b ILIKE $${index})`);
        values.push(`%${team}%`);
        index++;
      }

      if (start_date) {
        conditions.push(`match_date >= $${index}`);
        values.push(start_date);
        index++;
      }

      if (end_date) {
        conditions.push(`match_date <= $${index}`);
        values.push(end_date);
        index++;
      }

      if (has_result === true) {
        conditions.push(`result IS NOT NULL`);
      } else if (has_result === false) {
        conditions.push(`result IS NULL`);
      }

      // Validate sort column
      const validSortColumns = [
        'match_id', 'match_date', 'created_at', 'updated_at',
        'total_staked', 'odds_team_a', 'odds_draw', 'odds_team_b'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'match_date';
      const order = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      let whereClause = '';
      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

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
        SELECT * FROM ${this.tableName} 
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
      logger.error('Error finding matches:', error);
      throw error;
    }
  }

  static async update(matchId, updateData) {
    try {
      const fields = [];
      const values = [];
      let index = 1;

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = $${index}`);
          values.push(updateData[key]);
          index++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(matchId);
      
      const query = `
        UPDATE ${this.tableName} 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE match_id = $${index}
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating match:', error);
      throw error;
    }
  }

  static async updateTotalStaked(matchId, amount) {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET total_staked = total_staked + $1, updated_at = NOW()
        WHERE match_id = $2
        RETURNING *
      `;

      const result = await db.query(query, [amount, matchId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating match total staked:', error);
      throw error;
    }
  }

  static async setResult(matchId, result, verifiedBy, txHash = null) {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET 
          result = $1,
          status = $2,
          updated_at = NOW()
        WHERE match_id = $3
        RETURNING *
      `;

      const values = [
        result,
        constants.MATCH_STATUS.FINISHED,
        matchId
      ];

      const resultData = await db.query(query, values);

      // Record result in results table
      if (resultData.rows[0]) {
        await db.query(
          `INSERT INTO results 
           (match_id, result, verified_by, oracle_tx_hash, verified_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [matchId, result, verifiedBy, txHash]
        );
      }

      return resultData.rows[0];
    } catch (error) {
      logger.error('Error setting match result:', error);
      throw error;
    }
  }

  static async getUpcomingMatches(limit = 10) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE 
          status = $1 AND 
          match_date > NOW()
        ORDER BY match_date ASC
        LIMIT $2
      `;

      const result = await db.query(query, [
        constants.MATCH_STATUS.UPCOMING,
        limit
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting upcoming matches:', error);
      throw error;
    }
  }

  static async getLiveMatches() {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE status = $1
        ORDER BY match_date ASC
      `;

      const result = await db.query(query, [constants.MATCH_STATUS.LIVE]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting live matches:', error);
      throw error;
    }
  }

  static async getFinishedMatches(limit = 10) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE status = $1
        ORDER BY match_date DESC
        LIMIT $2
      `;

      const result = await db.query(query, [
        constants.MATCH_STATUS.FINISHED,
        limit
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting finished matches:', error);
      throw error;
    }
  }

  static async getMatchesByGroup(groupName) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE group_name = $1
        ORDER BY match_date ASC
      `;

      const result = await db.query(query, [groupName]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting matches by group:', error);
      throw error;
    }
  }

  static async getMatchStats(matchId) {
    try {
      const query = `
        SELECT 
          m.*,
          COUNT(b.id) as total_bets,
          SUM(b.amount) as total_amount,
          COUNT(CASE WHEN b.outcome = 0 THEN 1 END) as bets_team_a,
          COUNT(CASE WHEN b.outcome = 1 THEN 1 END) as bets_draw,
          COUNT(CASE WHEN b.outcome = 2 THEN 1 END) as bets_team_b,
          SUM(CASE WHEN b.outcome = 0 THEN b.amount END) as amount_team_a,
          SUM(CASE WHEN b.outcome = 1 THEN b.amount END) as amount_draw,
          SUM(CASE WHEN b.outcome = 2 THEN b.amount END) as amount_team_b
        FROM ${this.tableName} m
        LEFT JOIN bets b ON m.match_id = b.match_id
        WHERE m.match_id = $1
        GROUP BY m.match_id
      `;

      const result = await db.query(query, [matchId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting match stats:', error);
      throw error;
    }
  }

  static async getPopularMatches(limit = 5) {
    try {
      const query = `
        SELECT 
          m.*,
          COUNT(b.id) as bet_count,
          SUM(b.amount) as total_staked
        FROM ${this.tableName} m
        LEFT JOIN bets b ON m.match_id = b.match_id
        WHERE m.status = $1
        GROUP BY m.match_id
        ORDER BY total_staked DESC NULLS LAST
        LIMIT $2
      `;

      const result = await db.query(query, [
        constants.MATCH_STATUS.UPCOMING,
        limit
      ]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting popular matches:', error);
      throw error;
    }
  }

  static async getCountByStatus() {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY status
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting match count by status:', error);
      throw error;
    }
  }

  static async delete(matchId) {
    try {
      const query = `
        DELETE FROM ${this.tableName} 
        WHERE match_id = $1
        RETURNING *
      `;

      const result = await db.query(query, [matchId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error deleting match:', error);
      throw error;
    }
  }

  static async exists(matchId) {
    try {
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${this.tableName} 
          WHERE match_id = $1
        )
      `;

      const result = await db.query(query, [matchId]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Error checking if match exists:', error);
      throw error;
    }
  }

  static async getTotalVolume() {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(total_staked), 0) as total_volume,
          COUNT(*) as total_matches
        FROM ${this.tableName}
      `;

      const result = await db.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting total volume:', error);
      throw error;
    }
  }
}

module.exports = Match;