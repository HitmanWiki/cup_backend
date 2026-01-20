// src/models/Match.js - COMPLETE Prisma Version (CORRECTED)
const prisma = require('../config/database');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class Match {
  static async create(matchData) {
    try {
      const match = await prisma.match.create({
        data: {
          match_id: parseInt(matchData.match_id),
          team_a: matchData.team_a,
          team_b: matchData.team_b,
          match_date: new Date(matchData.match_date),
          venue: matchData.venue || null,
          group_name: matchData.group_name || null,
          odds_team_a: parseFloat(matchData.odds_team_a),
          odds_draw: parseFloat(matchData.odds_draw),
          odds_team_b: parseFloat(matchData.odds_team_b),
          status: matchData.status || constants.MATCH_STATUS.UPCOMING,
          total_staked: matchData.total_staked || 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      return match;
    } catch (error) {
      logger.error('Error creating match:', error);
      throw error;
    }
  }

  static async findById(matchId) {
    try {
      const match = await prisma.match.findFirst({
        where: { match_id: parseInt(matchId) }
      });
      return match;
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

      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || constants.PAGINATION.DEFAULT_LIMIT;
      const sort_by = pagination.sort_by || 'match_date';
      const sort_order = pagination.sort_order || 'asc';
      
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where = {};
      
      if (status) where.status = status;
      if (group_name) where.group_name = group_name;
      
      if (team) {
        where.OR = [
          { team_a: { contains: team, mode: 'insensitive' } },
          { team_b: { contains: team, mode: 'insensitive' } }
        ];
      }
      
      if (start_date) {
        where.match_date = {
          gte: new Date(start_date)
        };
      }
      
      if (end_date) {
        if (where.match_date) {
          where.match_date.lte = new Date(end_date);
        } else {
          where.match_date = {
            lte: new Date(end_date)
          };
        }
      }
      
      if (has_result === true) {
        where.result = { not: null };
      } else if (has_result === false) {
        where.result = null;
      }
      
      // Validate sort column
      const validSortColumns = [
        'match_id', 'match_date', 'created_at', 'updated_at',
        'total_staked', 'odds_team_a', 'odds_draw', 'odds_team_b'
      ];
      
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'match_date';
      const order = sort_order.toLowerCase() === 'desc' ? 'desc' : 'asc';
      
      // Get total count
      const total = await prisma.match.count({ where });
      
      // Get paginated results
      const matches = await prisma.match.findMany({
        where,
        orderBy: { [sortColumn]: order },
        skip,
        take: limit
      });
      
      return {
        data: matches,
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
      // Filter out problematic columns
      const columnsToExclude = ['external_id', 'competition_id', 'season', 'api_data'];
      
      const data = {};
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && !columnsToExclude.includes(key)) {
          data[key] = updateData[key];
        }
      });
      
      // Always update timestamp
      data.updated_at = new Date();
      
      const match = await prisma.match.update({
        where: { match_id: parseInt(matchId) },
        data
      });
      return match;
    } catch (error) {
      logger.error('Error updating match:', error);
      throw error;
    }
  }

  static async updateTotalStaked(matchId, amount) {
    try {
      const match = await prisma.match.update({
        where: { match_id: parseInt(matchId) },
        data: {
          total_staked: {
            increment: parseFloat(amount)
          },
          updated_at: new Date()
        }
      });
      return match;
    } catch (error) {
      logger.error('Error updating match total staked:', error);
      throw error;
    }
  }

  static async setResult(matchId, result, verifiedBy, txHash = null) {
    try {
      const match = await prisma.match.update({
        where: { match_id: parseInt(matchId) },
        data: {
          result: result,
          status: constants.MATCH_STATUS.FINISHED,
          updated_at: new Date()
        }
      });
      
      // Record result in results table (if you have one)
      // Note: You'll need to create a results table in Prisma schema
      // For now, we'll just update the match
      
      return match;
    } catch (error) {
      logger.error('Error setting match result:', error);
      throw error;
    }
  }

  static async getUpcomingMatches(limit = 10) {
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: {
            equals: constants.MATCH_STATUS.UPCOMING,
            mode: 'insensitive'
          }
        },
        orderBy: { match_date: 'asc' },
        take: parseInt(limit)
      });
      
      console.log(`✅ Found ${matches.length} upcoming matches in database`);
      if (matches.length > 0) {
        console.log('Sample match from DB:', {
          id: matches[0].match_id,
          teams: `${matches[0].team_a} vs ${matches[0].team_b}`,
          group: matches[0].group_name,
          status: matches[0].status
        });
      }
      
      return matches;
    } catch (error) {
      logger.error('Error getting upcoming matches:', error);
      throw error;
    }
  }

  static async getLiveMatches() {
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: constants.MATCH_STATUS.LIVE
        },
        orderBy: { match_date: 'asc' }
      });
      return matches;
    } catch (error) {
      logger.error('Error getting live matches:', error);
      throw error;
    }
  }

  static async getFinishedMatches(limit = 10) {
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: constants.MATCH_STATUS.FINISHED
        },
        orderBy: { match_date: 'desc' },
        take: parseInt(limit)
      });
      return matches;
    } catch (error) {
      logger.error('Error getting finished matches:', error);
      throw error;
    }
  }

  static async getMatchesByGroup(groupName) {
    try {
      const matches = await prisma.match.findMany({
        where: {
          group_name: groupName
        },
        orderBy: { match_date: 'asc' }
      });
      return matches;
    } catch (error) {
      logger.error('Error getting matches by group:', error);
      throw error;
    }
  }

  static async getMatchStats(matchId) {
    try {
      // FIXED: Added explicit column names to avoid ambiguity
      const rawQuery = `
        SELECT 
          m.id,
          m.match_id,
          m.team_a,
          m.team_b,
          m.match_date,
          m.venue,
          m.group_name,
          m.odds_team_a,
          m.odds_draw,
          m.odds_team_b,
          m.status,
          m.result,
          m.total_staked as match_total_staked,
          m.archived,
          m.created_at,
          m.updated_at,
          COUNT(b.id) as total_bets,
          COALESCE(SUM(b.amount), 0) as total_amount,
          COUNT(CASE WHEN b.outcome = 0 THEN 1 END) as bets_team_a,
          COUNT(CASE WHEN b.outcome = 1 THEN 1 END) as bets_draw,
          COUNT(CASE WHEN b.outcome = 2 THEN 1 END) as bets_team_b,
          COALESCE(SUM(CASE WHEN b.outcome = 0 THEN b.amount END), 0) as amount_team_a,
          COALESCE(SUM(CASE WHEN b.outcome = 1 THEN b.amount END), 0) as amount_draw,
          COALESCE(SUM(CASE WHEN b.outcome = 2 THEN b.amount END), 0) as amount_team_b
        FROM matches m
        LEFT JOIN bets b ON m.match_id = b.match_id
        WHERE m.match_id = $1
        GROUP BY m.id, m.match_id, m.team_a, m.team_b, m.match_date, m.venue, 
                 m.group_name, m.odds_team_a, m.odds_draw, m.odds_team_b, 
                 m.status, m.result, m.total_staked, m.archived, m.created_at, m.updated_at
      `;
      
      const stats = await prisma.$queryRawUnsafe(rawQuery, parseInt(matchId));
      return stats[0] || null;
    } catch (error) {
      logger.error('Error getting match stats:', error);
      throw error;
    }
  }

  static async getPopularMatches(limit = 5) {
    try {
      // FIXED: Added alias for SUM to avoid ambiguity
      const rawQuery = `
        SELECT 
          m.*,
          COUNT(b.id) as bet_count,
          COALESCE(SUM(b.amount), 0) as bet_total_staked
        FROM matches m
        LEFT JOIN bets b ON m.match_id = b.match_id
        WHERE m.status = $1
        GROUP BY m.id, m.match_id, m.team_a, m.team_b, m.match_date, m.venue, 
                 m.group_name, m.odds_team_a, m.odds_draw, m.odds_team_b, 
                 m.status, m.result, m.total_staked, m.archived, m.created_at, m.updated_at
        ORDER BY bet_total_staked DESC
        LIMIT $2
      `;
      
      const popularMatches = await prisma.$queryRawUnsafe(
        rawQuery, 
        constants.MATCH_STATUS.UPCOMING,
        parseInt(limit)
      );
      return popularMatches;
    } catch (error) {
      logger.error('Error getting popular matches:', error);
      throw error;
    }
  }

  static async getMatchWithScores(matchId) {
    try {
      // Since you don't have a results table yet, we'll just return the match
      // You can add a results table to your schema later
      const match = await prisma.match.findFirst({
        where: { match_id: parseInt(matchId) }
      });
      return match;
    } catch (error) {
      logger.error('Error getting match with scores:', error);
      throw error;
    }
  }

  static async getCountByStatus() {
    try {
      const counts = await prisma.match.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });
      
      return counts.map(item => ({
        status: item.status,
        count: item._count.id
      }));
    } catch (error) {
      logger.error('Error getting match count by status:', error);
      throw error;
    }
  }

  static async delete(matchId) {
    try {
      const match = await prisma.match.delete({
        where: { match_id: parseInt(matchId) }
      });
      return match;
    } catch (error) {
      logger.error('Error deleting match:', error);
      throw error;
    }
  }

  static async exists(matchId) {
    try {
      const count = await prisma.match.count({
        where: { match_id: parseInt(matchId) }
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking if match exists:', error);
      throw error;
    }
  }

  static async getTotalVolume() {
    try {
      const result = await prisma.match.aggregate({
        _sum: {
          total_staked: true
        },
        _count: {
          id: true
        }
      });
      
      return {
        total_volume: result._sum.total_staked || 0,
        total_matches: result._count.id
      };
    } catch (error) {
      logger.error('Error getting total volume:', error);
      throw error;
    }
  }

  // ADDITIONAL METHODS FOR COMPLETENESS
  
  static async getTodaysMatches() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const matches = await prisma.match.findMany({
        where: {
          match_date: {
            gte: today,
            lt: tomorrow
          }
        },
        orderBy: { match_date: 'asc' }
      });
      return matches;
    } catch (error) {
      logger.error('Error getting today\'s matches:', error);
      throw error;
    }
  }

  static async getMatchesByDate(date) {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      const matches = await prisma.match.findMany({
        where: {
          match_date: {
            gte: startDate,
            lt: endDate
          }
        },
        orderBy: { match_date: 'asc' }
      });
      return matches;
    } catch (error) {
      logger.error('Error getting matches by date:', error);
      throw error;
    }
  }

  static async getRecentMatches(limit = 20) {
    try {
      const matches = await prisma.match.findMany({
        orderBy: { created_at: 'desc' },
        take: parseInt(limit)
      });
      return matches;
    } catch (error) {
      logger.error('Error getting recent matches:', error);
      throw error;
    }
  }

  static async getMatchesWithoutResults() {
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: constants.MATCH_STATUS.FINISHED,
          result: null
        },
        orderBy: { match_date: 'desc' }
      });
      return matches;
    } catch (error) {
      logger.error('Error getting matches without results:', error);
      throw error;
    }
  }

  static async getMatchOdds(matchId) {
    try {
      const match = await prisma.match.findFirst({
        where: { match_id: parseInt(matchId) },
        select: {
          odds_team_a: true,
          odds_draw: true,
          odds_team_b: true
        }
      });
      return match;
    } catch (error) {
      logger.error('Error getting match odds:', error);
      throw error;
    }
  }

  static async updateOdds(matchId, odds) {
    try {
      const match = await prisma.match.update({
        where: { match_id: parseInt(matchId) },
        data: {
          odds_team_a: odds.team_a,
          odds_draw: odds.draw,
          odds_team_b: odds.team_b,
          updated_at: new Date()
        }
      });
      return match;
    } catch (error) {
      logger.error('Error updating match odds:', error);
      throw error;
    }
  }

  static async bulkCreateMatches(matchesData) {
    try {
      const matches = await prisma.match.createMany({
        data: matchesData.map(match => ({
          match_id: parseInt(match.match_id),
          team_a: match.team_a,
          team_b: match.team_b,
          match_date: new Date(match.match_date),
          venue: match.venue || null,
          group_name: match.group_name || null,
          odds_team_a: parseFloat(match.odds_team_a),
          odds_draw: parseFloat(match.odds_draw),
          odds_team_b: parseFloat(match.odds_team_b),
          status: match.status || constants.MATCH_STATUS.UPCOMING,
          total_staked: 0,
          created_at: new Date(),
          updated_at: new Date()
        })),
        skipDuplicates: true
      });
      return matches;
    } catch (error) {
      logger.error('Error bulk creating matches:', error);
      throw error;
    }
  }

  static async searchMatches(searchTerm, limit = 20) {
    try {
      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { team_a: { contains: searchTerm, mode: 'insensitive' } },
            { team_b: { contains: searchTerm, mode: 'insensitive' } },
            { venue: { contains: searchTerm, mode: 'insensitive' } },
            { group_name: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        orderBy: { match_date: 'asc' },
        take: parseInt(limit)
      });
      return matches;
    } catch (error) {
      logger.error('Error searching matches:', error);
      throw error;
    }
  }
}

module.exports = Match;