// src/models/User.js - COMPLETE Prisma Version
const prisma = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class User {
  static async create(userData) {
    try {
      console.log('🔍 User.create called with:', userData);
      
      const walletAddress = userData.wallet_address;
      console.log('🔍 wallet_address from userData:', walletAddress);
      
      if (!walletAddress || typeof walletAddress !== 'string') {
        throw new Error(`Invalid wallet address: ${walletAddress}`);
      }
      
      const normalizedAddress = walletAddress.toLowerCase();
      const username = userData.username || `user_${normalizedAddress.slice(2, 8)}`;
      const email = userData.email || null;
      const balance = userData.balance || 1000;
      
      console.log('🔍 Creating user with balance:', balance);
      
      // Use upsert to handle create or update
      const user = await prisma.user.upsert({
        where: {
          wallet_address: normalizedAddress
        },
        update: {
          username: username,
          email: email,
          last_active: new Date()
        },
        create: {
          wallet_address: normalizedAddress,
          username: username,
          email: email,
          balance: balance,
          total_bets: 0,
          total_won: 0,
          total_staked: 0,
          created_at: new Date(),
          last_active: new Date()
        }
      });
      
      console.log('✅ User created/updated:', user);
      return user;
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  static async createWithoutBalance(userData) {
    try {
      const walletAddress = userData.wallet_address;
      const normalizedAddress = walletAddress.toLowerCase();
      const username = userData.username || `user_${normalizedAddress.slice(2, 8)}`;
      const email = userData.email || null;
      
      const user = await prisma.user.upsert({
        where: {
          wallet_address: normalizedAddress
        },
        update: {
          username: username,
          email: email,
          last_active: new Date()
        },
        create: {
          wallet_address: normalizedAddress,
          username: username,
          email: email,
          balance: 1000,
          total_bets: 0,
          total_won: 0,
          total_staked: 0,
          created_at: new Date(),
          last_active: new Date()
        }
      });
      
      console.log('✅ User created/updated without balance');
      return user;
    } catch (error) {
      logger.error('Error creating user without balance:', error);
      throw error;
    }
  }

  static async ensureTableExists() {
    // Not needed with Prisma - tables are managed by migrations
    console.log('✅ Tables managed by Prisma migrations');
    return true;
  }

  static async findByWalletAddress(walletAddress) {
    try {
      console.log('🔍 User.findByWalletAddress called with:', walletAddress);
      
      if (!walletAddress || typeof walletAddress !== 'string') {
        console.error('Invalid wallet address:', walletAddress);
        return null;
      }
      
      const normalizedAddress = walletAddress.toLowerCase();
      
      const user = await prisma.user.findUnique({
        where: {
          wallet_address: normalizedAddress
        }
      });
      
      console.log('🔍 Found user:', user ? 'Yes' : 'No');
      return user;
    } catch (error) {
      logger.error('Error finding user by wallet address:', error);
      throw error;
    }
  }

  static async findById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: parseInt(userId)
        }
      });
      return user;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async update(walletAddress, updateData) {
    try {
      const normalizedAddress = walletAddress.toLowerCase();
      
      const user = await prisma.user.update({
        where: {
          wallet_address: normalizedAddress
        },
        data: {
          ...updateData,
          updated_at: new Date()
        }
      });
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async updateStats(walletAddress, stats) {
    try {
      const normalizedAddress = walletAddress.toLowerCase();
      
      // Build update data
      const updateData = {
        updated_at: new Date()
      };
      
      if (stats.total_bets !== undefined) {
        updateData.total_bets = {
          increment: parseInt(stats.total_bets)
        };
      }
      
      if (stats.total_won !== undefined) {
        updateData.total_won = {
          increment: parseFloat(stats.total_won)
        };
      }
      
      if (stats.total_staked !== undefined) {
        updateData.total_staked = {
          increment: parseFloat(stats.total_staked)
        };
      }
      
      if (stats.balance !== undefined) {
        updateData.balance = {
          increment: parseFloat(stats.balance)
        };
      }
      
      const user = await prisma.user.update({
        where: {
          wallet_address: normalizedAddress
        },
        data: updateData
      });
      return user;
    } catch (error) {
      logger.error('Error updating user stats:', error);
      throw error;
    }
  }

  static async getUserStats(walletAddress) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          wallet_address: walletAddress.toLowerCase()
        },
        select: {
          total_bets: true,
          total_won: true,
          total_staked: true,
          balance: true,
          created_at: true,
          last_active: true
        }
      });
      
      if (!user) return null;
      
      // Calculate ROI and win ratio
      const roi_percentage = user.total_bets > 0 
        ? ((user.total_won / user.total_staked) * 100).toFixed(2)
        : '0.00';
      
      const win_ratio = user.total_bets > 0 
        ? (user.total_won / (user.total_staked || 1)).toFixed(2)
        : '0.00';
      
      return {
        ...user,
        roi_percentage: parseFloat(roi_percentage),
        win_ratio: parseFloat(win_ratio)
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  static async getTopUsers(limit = 10) {
    try {
      const users = await prisma.user.findMany({
        where: {
          total_bets: {
            gt: 0
          }
        },
        select: {
          wallet_address: true,
          username: true,
          total_won: true,
          total_bets: true,
          total_staked: true,
          balance: true
        },
        orderBy: {
          total_won: 'desc'
        },
        take: parseInt(limit)
      });
      
      // Add ROI percentage calculation
      return users.map(user => ({
        ...user,
        roi_percentage: user.total_bets > 0 
          ? parseFloat(((user.total_won / user.total_staked) * 100).toFixed(2))
          : 0
      }));
    } catch (error) {
      logger.error('Error getting top users:', error);
      throw error;
    }
  }

  static async searchUsers(searchTerm, limit = 20) {
    try {
      // Use raw query for ILIKE search
      const rawQuery = `
        SELECT 
          id,
          wallet_address,
          username,
          total_bets,
          total_won,
          total_staked,
          created_at
        FROM users
        WHERE 
          wallet_address ILIKE $1 OR
          username ILIKE $1
        ORDER BY total_won DESC
        LIMIT $2
      `;
      
      const users = await prisma.$queryRawUnsafe(
        rawQuery, 
        `%${searchTerm}%`, 
        parseInt(limit)
      );
      
      return users;
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  static async getActiveUsers(days = 7) {
    try {
      const rawQuery = `
        SELECT 
          COUNT(*) as active_users,
          DATE(last_active) as date
        FROM users
        WHERE last_active >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(last_active)
        ORDER BY date DESC
      `;
      
      const result = await prisma.$queryRawUnsafe(rawQuery);
      return result;
    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  static async getRegistrationStats(days = 30) {
    try {
      const rawQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM users
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      const result = await prisma.$queryRawUnsafe(rawQuery);
      return result;
    } catch (error) {
      logger.error('Error getting registration stats:', error);
      throw error;
    }
  }

  static async delete(walletAddress) {
    try {
      const user = await prisma.user.delete({
        where: {
          wallet_address: walletAddress.toLowerCase()
        }
      });
      return user;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  static async exists(walletAddress) {
    try {
      const count = await prisma.user.count({
        where: {
          wallet_address: walletAddress.toLowerCase()
        }
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking if user exists:', error);
      throw error;
    }
  }

  static async getCount() {
    try {
      const count = await prisma.user.count();
      return count;
    } catch (error) {
      logger.error('Error getting user count:', error);
      throw error;
    }
  }

  // ADDITIONAL METHODS FROM YOUR ORIGINAL CODE
  
  static async getAllUsers(pagination = {}) {
    try {
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 20;
      const skip = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: skip,
          take: limit,
          orderBy: {
            created_at: 'desc'
          }
        }),
        prisma.user.count()
      ]);
      
      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  static async updateLastActive(walletAddress) {
    try {
      const user = await prisma.user.update({
        where: {
          wallet_address: walletAddress.toLowerCase()
        },
        data: {
          last_active: new Date()
        }
      });
      return user;
    } catch (error) {
      logger.error('Error updating last active:', error);
      throw error;
    }
  }

  static async getUsersWithMostBets(limit = 10) {
    try {
      const users = await prisma.user.findMany({
        where: {
          total_bets: {
            gt: 0
          }
        },
        orderBy: {
          total_bets: 'desc'
        },
        take: parseInt(limit)
      });
      return users;
    } catch (error) {
      logger.error('Error getting users with most bets:', error);
      throw error;
    }
  }

  static async getUsersWithHighestBalance(limit = 10) {
    try {
      const users = await prisma.user.findMany({
        orderBy: {
          balance: 'desc'
        },
        take: parseInt(limit)
      });
      return users;
    } catch (error) {
      logger.error('Error getting users with highest balance:', error);
      throw error;
    }
  }

  static async getUsersByDateRange(startDate, endDate) {
    try {
      const users = await prisma.user.findMany({
        where: {
          created_at: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });
      return users;
    } catch (error) {
      logger.error('Error getting users by date range:', error);
      throw error;
    }
  }

  static async getInactiveUsers(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const rawQuery = `
        SELECT *
        FROM users
        WHERE last_active < $1
        ORDER BY last_active ASC
      `;
      
      const users = await prisma.$queryRawUnsafe(rawQuery, cutoffDate);
      return users;
    } catch (error) {
      logger.error('Error getting inactive users:', error);
      throw error;
    }
  }

  static async bulkUpdateUsers(updates) {
    try {
      const updatePromises = updates.map(update => 
        prisma.user.update({
          where: {
            wallet_address: update.wallet_address.toLowerCase()
          },
          data: update.data
        })
      );
      
      const results = await Promise.all(updatePromises);
      return results;
    } catch (error) {
      logger.error('Error bulk updating users:', error);
      throw error;
    }
  }

  static async getUserWithBets(walletAddress) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          wallet_address: walletAddress.toLowerCase()
        },
        include: {
          bets: {
            take: 10,
            orderBy: {
              placed_at: 'desc'
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
            }
          }
        }
      });
      return user;
    } catch (error) {
      logger.error('Error getting user with bets:', error);
      throw error;
    }
  }

  static async getLeaderboardStats() {
    try {
      const rawQuery = `
        SELECT 
          wallet_address,
          username,
          total_bets,
          total_won,
          total_staked,
          balance,
          RANK() OVER (ORDER BY total_won DESC) as rank,
          ROUND(
            CASE 
              WHEN total_bets > 0 THEN (total_won / total_staked) * 100 
              ELSE 0 
            END, 2
          ) as roi_percentage
        FROM users
        WHERE total_bets > 0
        ORDER BY rank
        LIMIT 100
      `;
      
      const stats = await prisma.$queryRawUnsafe(rawQuery);
      return stats;
    } catch (error) {
      logger.error('Error getting leaderboard stats:', error);
      throw error;
    }
  }
}

module.exports = User;