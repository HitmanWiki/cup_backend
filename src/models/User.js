// src/models/User.js
const db = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class User {
  static tableName = 'users';

  static async create(walletAddress, userData = {}) {
    try {
      const query = `
        INSERT INTO ${this.tableName} 
        (wallet_address, username, email, total_bets, total_won, total_staked, created_at, last_active)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (wallet_address) 
        DO UPDATE SET 
          username = COALESCE($2, users.username),
          email = COALESCE($3, users.email),
          last_active = NOW()
        RETURNING *
      `;

      const values = [
        walletAddress.toLowerCase(),
        userData.username || null,
        userData.email || null,
        userData.total_bets || 0,
        userData.total_won || 0,
        userData.total_staked || 0
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  static async findByWalletAddress(walletAddress) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE wallet_address = $1
      `;

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by wallet address:', error);
      throw error;
    }
  }

  static async findById(userId) {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE id = $1
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async update(walletAddress, updateData) {
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

      values.push(walletAddress.toLowerCase());
      
      const query = `
        UPDATE ${this.tableName} 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE wallet_address = $${index}
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async updateStats(walletAddress, stats) {
    try {
      const updates = [];
      const values = [walletAddress.toLowerCase()];
      let index = 2;

      if (stats.total_bets !== undefined) {
        updates.push(`total_bets = total_bets + $${index}`);
        values.push(stats.total_bets);
        index++;
      }

      if (stats.total_won !== undefined) {
        updates.push(`total_won = total_won + $${index}`);
        values.push(stats.total_won);
        index++;
      }

      if (stats.total_staked !== undefined) {
        updates.push(`total_staked = total_staked + $${index}`);
        values.push(stats.total_staked);
        index++;
      }

      if (updates.length === 0) {
        return null;
      }

      const query = `
        UPDATE ${this.tableName} 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE wallet_address = $1
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating user stats:', error);
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const query = `
        SELECT 
          total_bets,
          total_won,
          total_staked,
          created_at,
          last_active,
          ROUND(
            CASE 
              WHEN total_bets > 0 THEN (total_won / total_staked) * 100 
              ELSE 0 
            END, 2
          ) as roi_percentage,
          ROUND(
            CASE 
              WHEN total_bets > 0 THEN (total_won / NULLIF(total_staked, 0)) 
              ELSE 0 
            END, 2
          ) as win_ratio
        FROM ${this.tableName}
        WHERE wallet_address = $1
      `;

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  static async getTopUsers(limit = 10) {
    try {
      const query = `
        SELECT 
          wallet_address,
          username,
          total_won,
          total_bets,
          total_staked,
          ROUND(
            CASE 
              WHEN total_bets > 0 THEN (total_won / total_staked) * 100 
              ELSE 0 
            END, 2
          ) as roi_percentage
        FROM ${this.tableName}
        WHERE total_bets > 0
        ORDER BY total_won DESC
        LIMIT $1
      `;

      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting top users:', error);
      throw error;
    }
  }

  static async searchUsers(searchTerm, limit = 20) {
    try {
      const query = `
        SELECT 
          id,
          wallet_address,
          username,
          total_bets,
          total_won,
          total_staked,
          created_at
        FROM ${this.tableName}
        WHERE 
          wallet_address ILIKE $1 OR
          username ILIKE $1
        ORDER BY total_won DESC
        LIMIT $2
      `;

      const result = await db.query(query, [`%${searchTerm}%`, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  static async getActiveUsers(days = 7) {
    try {
      const query = `
        SELECT 
          COUNT(*) as active_users,
          DATE(last_active) as date
        FROM ${this.tableName}
        WHERE last_active >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(last_active)
        ORDER BY date DESC
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  static async getRegistrationStats(days = 30) {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM ${this.tableName}
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting registration stats:', error);
      throw error;
    }
  }

  static async delete(walletAddress) {
    try {
      const query = `
        DELETE FROM ${this.tableName} 
        WHERE wallet_address = $1
        RETURNING *
      `;

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  static async exists(walletAddress) {
    try {
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${this.tableName} 
          WHERE wallet_address = $1
        )
      `;

      const result = await db.query(query, [walletAddress.toLowerCase()]);
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Error checking if user exists:', error);
      throw error;
    }
  }

  static async getCount() {
    try {
      const query = `
        SELECT COUNT(*) as user_count FROM ${this.tableName}
      `;

      const result = await db.query(query);
      return parseInt(result.rows[0].user_count);
    } catch (error) {
      logger.error('Error getting user count:', error);
      throw error;
    }
  }
}

module.exports = User;