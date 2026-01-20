// api/index.js - WITH PROPER SPORTS API INTEGRATION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// ==================== SPORTS DATA SERVICE ====================
class SportsDataService {
  constructor() {
    this.baseUrl = process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores';
    this.apiKey = process.env.SPORTS_DATA_API_KEY;
    this.hasApiKey = this.apiKey && this.apiKey !== 'your_sports_data_api_key';
  }

  async testConnection() {
    if (!this.hasApiKey) {
      throw new Error('Sports API key not configured in .env file');
    }

    try {
      const response = await fetch(`${this.baseUrl}/json/Competitions`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        connected: true,
        competitions: data.length
      };
    } catch (error) {
      console.error('Sports API connection error:', error.message);
      throw new Error(`Failed to connect to Sports API: ${error.message}`);
    }
  }

  async fetchWorldCupMatches() {
    if (!this.hasApiKey) {
      console.warn('⚠️ No Sports API key configured, using fallback');
      return this.getFallbackMatches();
    }

    try {
      console.log('📡 Fetching matches from SportsData.io API...');
      
      const response = await fetch(`${this.baseUrl}/json/Matches`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const allMatches = await response.json();
      console.log(`📊 Received ${allMatches.length} matches from API`);
      
      // Filter for World Cup 2026 matches
      const worldCupMatches = allMatches.filter(match => {
        // Check if it's World Cup 2026
        return match.CompetitionId === 21 || // World Cup ID
               (match.Competition && match.Competition.includes('World Cup')) ||
               (match.Season && match.Season === 2026);
      });

      console.log(`🌍 Found ${worldCupMatches.length} World Cup 2026 matches`);
      return worldCupMatches;
    } catch (error) {
      console.error('❌ Failed to fetch from Sports API:', error.message);
      console.warn('⚠️ Using fallback matches');
      return this.getFallbackMatches();
    }
  }

  getFallbackMatches() {
    // Return empty array instead of test data
    console.log('⚠️ Using empty fallback (no test data)');
    return [];
  }

  healthCheck() {
    return {
      status: this.hasApiKey ? 'configured' : 'not_configured',
      hasApiKey: this.hasApiKey,
      baseUrl: this.baseUrl
    };
  }
}

// ==================== DATA SYNC SERVICE ====================
class DataSyncService {
  constructor(sportsService) {
    this.sportsService = sportsService;
  }

  async syncMatches() {
    try {
      console.log('🔄 Starting data sync...');
      
      // Fetch matches from Sports API
      const apiMatches = await this.sportsService.fetchWorldCupMatches();
      
      if (apiMatches.length === 0) {
        console.log('⚠️ No matches received from API');
        return {
          success: false,
          error: 'No matches received from API',
          added: 0,
          updated: 0,
          total: 0
        };
      }

      console.log(`📥 Processing ${apiMatches.length} matches...`);
      
      let added = 0;
      let updated = 0;
      let errors = 0;

      // Process each match
      for (const apiMatch of apiMatches.slice(0, 50)) { // Limit to 50 to avoid rate limits
        try {
          const matchData = this.transformMatchData(apiMatch);
          
          if (!matchData.match_id) {
            console.warn(`⚠️ Skipping match without ID`);
            continue;
          }

          // Save to database using Prisma
          const saved = await prisma.match.upsert({
            where: { match_id: matchData.match_id },
            update: matchData,
            create: matchData
          });

          if (saved) {
            // Check if this was a new record or update
            const existing = await prisma.match.findUnique({
              where: { match_id: matchData.match_id }
            });
            
            if (existing && existing.created_at.getTime() === saved.created_at.getTime()) {
              added++;
            } else {
              updated++;
            }
          }
        } catch (matchError) {
          errors++;
          console.warn(`⚠️ Failed to save match: ${matchError.message}`);
        }
      }

      console.log(`✅ Sync completed: ${added} added, ${updated} updated, ${errors} errors`);
      
      return {
        success: true,
        added,
        updated,
        errors,
        total: apiMatches.length
      };

    } catch (error) {
      console.error('❌ Data sync failed:', error);
      return {
        success: false,
        error: error.message,
        added: 0,
        updated: 0,
        total: 0
      };
    }
  }

  transformMatchData(apiMatch) {
    // Parse match date
    const matchDate = apiMatch.DateTime ? new Date(apiMatch.DateTime) : 
                     apiMatch.Date ? new Date(apiMatch.Date) : 
                     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days from now

    // Determine status
    let status = 'upcoming';
    if (apiMatch.Status === 'Final') status = 'finished';
    if (apiMatch.Status === 'InProgress') status = 'live';
    if (apiMatch.Status === 'Canceled') status = 'cancelled';

    // Generate some realistic odds based on team names
    const getOdds = (teamA, teamB) => {
      // Simple odds calculation for demonstration
      const baseOdds = {
        teamA: 1.8 + (Math.random() * 0.8),
        draw: 3.2 + (Math.random() * 0.6),
        teamB: 2.1 + (Math.random() * 1.0)
      };
      return baseOdds;
    };

    const odds = getOdds(apiMatch.HomeTeam, apiMatch.AwayTeam);

    return {
      match_id: apiMatch.MatchId || apiMatch.Id || Date.now() + Math.floor(Math.random() * 1000),
      team_a: apiMatch.HomeTeam || 'Team A',
      team_b: apiMatch.AwayTeam || 'Team B',
      match_date: matchDate,
      venue: apiMatch.Venue || apiMatch.Stadium || 'Unknown Stadium',
      group_name: apiMatch.Group || apiMatch.Round || 'Group Stage',
      status: status,
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB
    };
  }
}

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ==================== PRISMA MATCH MODEL ====================
class MatchModel {
  static async findAll(filters = {}, options = {}) {
    const limit = options.limit || 100;
    const page = options.page || 1;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.group_name) {
      where.group_name = filters.group_name;
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { match_date: 'asc' },
        skip,
        take: limit
      }),
      prisma.match.count({ where })
    ]);

    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getUpcomingMatches(limit = 20) {
    return await prisma.match.findMany({
      where: {
        status: 'upcoming',
        match_date: {
          gt: new Date()
        }
      },
      orderBy: { match_date: 'asc' },
      take: limit
    });
  }
}

// ==================== ENDPOINTS ====================

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const sportsService = new SportsDataService();
    const sportsHealth = sportsService.healthCheck();
    
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      matches_in_database: matchCount,
      sports_api: sportsHealth.status,
      has_api_key: sportsHealth.hasApiKey
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Main matches endpoint
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    
    const result = await MatchModel.findAll({}, { limit: limit, page: page });
    
    // If no matches in DB, try to sync from API
    if (result.data.length === 0) {
      console.log('🔄 No matches in DB, attempting API sync...');
      const sportsService = new SportsDataService();
      const dataSync = new DataSyncService(sportsService);
      
      const syncResult = await dataSync.syncMatches();
      
      if (syncResult.success && syncResult.added > 0) {
        // Refetch after sync
        const newResult = await MatchModel.findAll({}, { limit: limit, page: page });
        return res.json({
          success: true,
          data: newResult.data,
          total: newResult.pagination.total,
          synced: true,
          added: syncResult.added
        });
      }
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.pagination.total,
      synced: false
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Group stage matches
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const result = await MatchModel.findAll({});
    const matches = result.data;
    
    const groups = {};
    matches.forEach(match => {
      const group = match.group_name || 'Unknown';
      if (!groups[group]) {
        groups[group] = {
          matchCount: 0,
          firstMatch: match.match_date,
          lastMatch: match.match_date,
          matches: []
        };
      }
      
      groups[group].matchCount++;
      groups[group].firstMatch = new Date(Math.min(
        new Date(groups[group].firstMatch).getTime(),
        new Date(match.match_date).getTime()
      ));
      groups[group].lastMatch = new Date(Math.max(
        new Date(groups[group].lastMatch).getTime(),
        new Date(match.match_date).getTime()
      ));
      groups[group].matches.push(match);
    });
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force sync endpoint
app.get(`${FULL_API_PATH}/sync-now`, async (req, res) => {
  try {
    console.log('🔄 Manual sync requested');
    
    const sportsService = new SportsDataService();
    const dataSync = new DataSyncService(sportsService);
    
    const result = await dataSync.syncMatches();
    
    res.json({
      success: result.success,
      message: result.success ? 'Sync completed successfully' : 'Sync failed',
      result: result
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint
app.get(`${FULL_API_PATH}/debug`, async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    
    const matchCount = await prisma.match.count();
    const sportsHealth = sportsService.healthCheck();
    
    let apiTest = { connected: false, error: 'Not tested' };
    if (sportsHealth.hasApiKey) {
      try {
        apiTest = await sportsService.testConnection();
      } catch (error) {
        apiTest = { connected: false, error: error.message };
      }
    }
    
    res.json({
      status: 'ok',
      database: {
        connected: true,
        matches: matchCount
      },
      sports_api: {
        configured: sportsHealth.hasApiKey,
        ...apiTest
      },
      environment: {
        node_env: process.env.NODE_ENV,
        has_api_key: !!process.env.SPORTS_DATA_API_KEY,
        api_key_length: process.env.SPORTS_DATA_API_KEY ? process.env.SPORTS_DATA_API_KEY.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== INITIALIZATION ====================
async function initializeBackend() {
  try {
    console.log('🔄 Initializing backend...');
    
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Check existing matches
    const matchCount = await prisma.match.count();
    console.log(`📊 Database contains ${matchCount} matches`);
    
    // Initialize sports service
    const sportsService = new SportsDataService();
    const sportsHealth = sportsService.healthCheck();
    
    if (sportsHealth.hasApiKey) {
      console.log('✅ Sports API key configured');
      
      // Try to sync if no matches
      if (matchCount === 0) {
        console.log('🔄 No matches found, attempting API sync...');
        const dataSync = new DataSyncService(sportsService);
        const result = await dataSync.syncMatches();
        
        if (result.success) {
          console.log(`✅ Sync successful: ${result.added} matches added`);
        } else {
          console.warn('⚠️ Sync failed:', result.error);
        }
      }
    } else {
      console.warn('❌ Sports API key NOT configured');
      console.warn('   Add SPORTS_DATA_API_KEY to your Vercel environment variables');
    }
    
    console.log('✅ Backend initialization complete');
  } catch (error) {
    console.error('❌ Backend initialization failed:', error);
  }
}

// Start initialization
initializeBackend();

// ==================== ERROR HANDLING ====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    available_routes: [
      '/health',
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/sync-now`,
      `${FULL_API_PATH}/debug`
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform API                               ║
║    🦅 World Cup 2026 • REAL SPORTS API                       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Database: PostgreSQL with Prisma                       ║
║    ✅ Auto-sync: Enabled                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\n🔗 Test Endpoints:');
console.log(`   1. Health: https://cup-backend-red.vercel.app/health`);
console.log(`   2. Debug: https://cup-backend-red.vercel.app/api/v4/debug`);
console.log(`   3. Force Sync: https://cup-backend-red.vercel.app/api/v4/sync-now`);
console.log(`   4. Matches: https://cup-backend-red.vercel.app/api/v4/matches`);
console.log(`   5. Groups: https://cup-backend-red.vercel.app/api/v4/matches/groups`);

module.exports = app;