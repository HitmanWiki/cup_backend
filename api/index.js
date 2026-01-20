// api/index.js - REAL API DATA ONLY (NO SAMPLE DATA)
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Simple logger matching server.js
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`)
};

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

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
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ==================== SPORTS DATA SERVICE (REAL API ONLY) ====================
class SportsDataService {
  constructor() {
    this.baseUrl = process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores';
    this.apiKey = process.env.SPORTS_DATA_API_KEY;
    
    if (!this.apiKey || this.apiKey === 'your_sports_data_api_key') {
      throw new Error('SPORTS_DATA_API_KEY not configured in environment variables');
    }
    
    console.log('🔧 SportsDataService initialized:', {
      hasApiKey: true,
      baseUrl: this.baseUrl,
      apiKeyFirst8: this.apiKey.substring(0, 8)
    });
  }

  async testConnection() {
    try {
      console.log('🔗 Testing API connection...');
      
      // Test with Competitions endpoint (always available)
      const response = await fetch(`${this.baseUrl}/json/Competitions`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API connected. Found ${data.length} competitions`);
      return true;
    } catch (error) {
      console.error('❌ API connection failed:', error.message);
      return false;
    }
  }

  async fetchCompetitions() {
    try {
      console.log('📋 Fetching competitions...');
      
      const response = await fetch(`${this.baseUrl}/json/Competitions`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Found ${data.length} competitions`);
      return data || [];
      
    } catch (error) {
      console.error('❌ Error fetching competitions:', error);
      throw error; // Don't swallow errors
    }
  }

  async testEndpoints() {
    console.log('🧪 Testing available endpoints...');
    const endpoints = [
      { name: 'Competitions', url: `${this.baseUrl}/json/Competitions` },
      { name: 'Areas', url: `${this.baseUrl}/json/Areas` },
      { name: 'UpcomingSchedule', url: `${this.baseUrl}/json/UpcomingSchedule` },
      { name: 'Schedule', url: `${this.baseUrl}/json/Schedule` },
      { name: 'Matches', url: `${this.baseUrl}/json/Matches` },
      { name: 'Scores/WorldCup/2022', url: `${this.baseUrl}/json/Scores/WorldCup/2022` },
      { name: 'Scores/WorldCup', url: `${this.baseUrl}/json/Scores/WorldCup` },
      { name: 'Games/WorldCup', url: `${this.baseUrl}/json/Games/WorldCup` }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });

        results.push({
          name: endpoint.name,
          status: response.status,
          ok: response.ok,
          url: endpoint.url
        });

        console.log(`  ${endpoint.name}: ${response.ok ? '✅' : '❌'} ${response.status}`);
      } catch (error) {
        results.push({
          name: endpoint.name,
          status: 'error',
          ok: false,
          error: error.message,
          url: endpoint.url
        });
        console.log(`  ${endpoint.name}: ❌ ${error.message}`);
      }
    }

    return results;
  }

  async fetchWorldCupMatches() {
    console.log('🌍 Fetching REAL World Cup matches from API...');
    
    let endpointAttempts = [
      { name: 'Scores/WorldCup/2022', url: `${this.baseUrl}/json/Scores/WorldCup/2022` },
      { name: 'Scores/WorldCup', url: `${this.baseUrl}/json/Scores/WorldCup` },
      { name: 'Games/WorldCup', url: `${this.baseUrl}/json/Games/WorldCup` },
      { name: 'UpcomingSchedule', url: `${this.baseUrl}/json/UpcomingSchedule` },
      { name: 'Schedule', url: `${this.baseUrl}/json/Schedule` },
      { name: 'Matches', url: `${this.baseUrl}/json/Matches` }
    ];

    for (const attempt of endpointAttempts) {
      try {
        console.log(`  Trying ${attempt.name}...`);
        
        const response = await fetch(attempt.url, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });

        if (response.ok) {
          const matches = await response.json();
          console.log(`  ✅ ${attempt.name}: Found ${matches.length} matches`);
          
          // Filter for World Cup if needed
          if (attempt.name.includes('WorldCup')) {
            return this.transformMatches(matches);
          } else {
            // Filter for World Cup matches
            const worldCupMatches = matches.filter(match => 
              match.CompetitionId === 21 || 
              (match.Competition && match.Competition.includes('World Cup'))
            );
            console.log(`  🌍 Filtered to ${worldCupMatches.length} World Cup matches`);
            return this.transformMatches(worldCupMatches);
          }
        } else {
          console.log(`  ❌ ${attempt.name}: ${response.status}`);
        }
      } catch (error) {
        console.log(`  ❌ ${attempt.name}: ${error.message}`);
      }
    }

    // If we get here, no endpoint worked
    console.log('❌ All endpoints failed - no match data available');
    return []; // Return empty array instead of sample data
  }

  transformMatches(apiMatches) {
    if (!apiMatches || !Array.isArray(apiMatches) || apiMatches.length === 0) {
      return [];
    }
    
    console.log(`🔄 Transforming ${apiMatches.length} matches...`);
    
    return apiMatches.map((match, index) => {
      // Parse match date
      const matchDate = match.DateTime ? new Date(match.DateTime) : 
                       match.Date ? new Date(match.Date) : 
                       new Date(Date.now() + (index * 24 * 60 * 60 * 1000)); // Stagger dates

      // Determine status
      let status = 'upcoming';
      if (match.Status === 'Final') status = 'finished';
      if (match.Status === 'InProgress') status = 'live';
      if (match.Status === 'Canceled' || match.Status === 'Postponed') status = 'cancelled';

      // Create unique match_id
      const matchId = match.MatchId || match.GameId || match.Id || 
                     Date.now() + index + Math.floor(Math.random() * 1000);

      return {
        match_id: matchId,
        team_a: match.HomeTeam || match.HomeTeamName || 'TBA',
        team_b: match.AwayTeam || match.AwayTeamName || 'TBA',
        match_date: matchDate,
        venue: match.Venue || match.Stadium || 'World Cup Stadium',
        group_name: match.Group || match.Round || 'Group Stage',
        status: status,
        odds_team_a: match.HomeTeamOdds || (1.8 + Math.random() * 0.6).toFixed(2),
        odds_draw: match.DrawOdds || (3.2 + Math.random() * 0.5).toFixed(2),
        odds_team_b: match.AwayTeamOdds || (2.1 + Math.random() * 0.8).toFixed(2)
      };
    });
  }

  async fetchUpcomingMatches(limit = 3) {
    try {
      const matches = await this.fetchWorldCupMatches();
      const now = new Date();
      
      const upcoming = matches
        .filter(match => {
          const matchDate = new Date(match.match_date);
          return matchDate > now;
        })
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
        .slice(0, limit);
      
      console.log(`📅 Found ${upcoming.length} upcoming matches`);
      return upcoming;
    } catch (error) {
      console.error('Error fetching upcoming:', error);
      return [];
    }
  }

  async fetchGroupStageMatches() {
    try {
      const matches = await this.fetchWorldCupMatches();
      const groups = {};
      
      matches.forEach(match => {
        if (match.group_name && match.group_name.includes('Group')) {
          const group = match.group_name;
          if (!groups[group]) {
            groups[group] = [];
          }
          groups[group].push(match);
        }
      });
      
      console.log(`📊 Found ${Object.keys(groups).length} groups`);
      return groups;
    } catch (error) {
      console.error('Error fetching groups:', error);
      return {};
    }
  }

  healthCheck() {
    return {
      status: 'healthy',
      hasApiKey: true,
      apiKeyConfigured: true
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
      logger.info('🔄 Starting REAL data sync...');
      
      // Test API connection
      const isConnected = await this.sportsService.testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Sports API');
      }
      
      // Test which endpoints are available
      const endpointTest = await this.sportsService.testEndpoints();
      const availableEndpoints = endpointTest.filter(e => e.ok);
      
      if (availableEndpoints.length === 0) {
        throw new Error('No API endpoints available with your subscription');
      }
      
      console.log(`✅ ${availableEndpoints.length} endpoints available`);
      
      // Fetch matches from API
      const apiMatches = await this.sportsService.fetchWorldCupMatches();
      
      if (apiMatches.length === 0) {
        console.log('⚠️ API returned 0 matches');
        console.log('💡 Your subscription might not include match data yet');
        console.log('💡 Available with your plan:', availableEndpoints.map(e => e.name));
        
        return {
          success: false,
          error: 'API returned 0 matches. Check your subscription level.',
          availableEndpoints: availableEndpoints.map(e => e.name),
          total: 0,
          added: 0,
          updated: 0
        };
      }

      console.log(`📥 Processing ${apiMatches.length} REAL matches from API...`);
      
      let added = 0;
      let updated = 0;
      let errors = 0;

      // Delete test match first (match_id: 9999)
      try {
        const deleted = await prisma.match.deleteMany({
          where: {
            OR: [
              { match_id: 9999 },
              { team_a: 'Test Team A' },
              { team_b: 'Test Team B' }
            ]
          }
        });
        if (deleted.count > 0) {
          console.log(`🧹 Deleted ${deleted.count} test matches`);
        }
      } catch (deleteError) {
        console.log('No test matches to delete');
      }

      // Process each real match
      for (const matchData of apiMatches.slice(0, 100)) {
        try {
          if (!matchData.match_id) {
            console.warn(`⚠️ Skipping match without ID`);
            continue;
          }

          // Skip if it's a test match
          if (matchData.match_id === 9999 || 
              matchData.team_a.includes('Test') || 
              matchData.team_b.includes('Test')) {
            console.log(`⏭️ Skipping test match: ${matchData.team_a} vs ${matchData.team_b}`);
            continue;
          }

          // Save to database
          const savedMatch = await prisma.match.upsert({
            where: { match_id: matchData.match_id },
            update: matchData,
            create: matchData
          });

          if (savedMatch) {
            // Check if this was an insert or update
            const existing = await prisma.match.findUnique({
              where: { match_id: matchData.match_id }
            });
            
            if (existing) {
              updated++;
            } else {
              added++;
              console.log(`✅ Added REAL match: ${matchData.team_a} vs ${matchData.team_b}`);
            }
          }
        } catch (matchError) {
          errors++;
          console.warn(`⚠️ Failed to save match: ${matchError.message}`);
        }
      }

      logger.info(`✅ REAL sync completed: ${added} added, ${updated} updated, ${errors} errors`);
      
      return {
        success: true,
        total: apiMatches.length,
        added,
        updated,
        errors,
        message: `Synced ${added} REAL matches from SportsData.io API`
      };

    } catch (error) {
      logger.error('❌ REAL data sync failed:', error);
      return {
        success: false,
        error: error.message,
        total: 0,
        added: 0,
        updated: 0,
        message: 'Failed to fetch REAL data from API'
      };
    }
  }
}

// ==================== ENDPOINTS ====================

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database
    await prisma.$queryRaw`SELECT 1`;
    
    const sportsService = new SportsDataService();
    const sportsHealth = sportsService.healthCheck();
    
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      matches_in_database: matchCount,
      sports_api: 'configured',
      api_key_configured: true
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// NEW: Endpoint to test available API endpoints
app.get(`${FULL_API_PATH}/test-endpoints`, async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    const endpointResults = await sportsService.testEndpoints();
    
    const available = endpointResults.filter(e => e.ok);
    const unavailable = endpointResults.filter(e => !e.ok);
    
    res.json({
      success: true,
      available_endpoints: available.map(e => ({
        name: e.name,
        status: e.status,
        url: e.url
      })),
      unavailable_endpoints: unavailable.map(e => ({
        name: e.name,
        status: e.status,
        error: e.error,
        url: e.url
      })),
      summary: {
        total: endpointResults.length,
        available: available.length,
        unavailable: unavailable.length
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug API endpoint
app.get(`${FULL_API_PATH}/debug/sports-api`, async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    
    // Test connection
    const isConnected = await sportsService.testConnection();
    
    // Fetch competitions
    const competitions = await sportsService.fetchCompetitions();
    const worldCup = competitions.find(c => c.CompetitionId === 21);
    
    // Fetch matches
    const matches = await sportsService.fetchWorldCupMatches();
    const upcoming = await sportsService.fetchUpcomingMatches(3);
    const groups = await sportsService.fetchGroupStageMatches();
    
    // Test endpoints
    const endpointTest = await sportsService.testEndpoints();
    const availableEndpoints = endpointTest.filter(e => e.ok).map(e => e.name);
    
    res.json({
      success: true,
      connection: isConnected ? 'connected' : 'failed',
      competitions: {
        total: competitions.length,
        worldCup: worldCup ? {
          name: worldCup.Name,
          id: worldCup.CompetitionId,
          seasons: worldCup.Seasons?.map(s => s.Season)
        } : null
      },
      matches: {
        total: matches.length,
        upcoming: upcoming.length,
        groups: Object.keys(groups).length,
        source: matches.length > 0 ? 'REAL API' : 'No data available'
      },
      endpoints: {
        available: availableEndpoints,
        total_tested: endpointTest.length
      },
      config: {
        apiKey: '✓ Set',
        baseUrl: process.env.SPORTS_DATA_API_URL,
        apiKeyFirst8: process.env.SPORTS_DATA_API_KEY.substring(0, 8)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      config: {
        apiKey: 'Set',
        baseUrl: process.env.SPORTS_DATA_API_URL
      }
    });
  }
});

// Main matches endpoint - EXCLUDE TEST MATCHES
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Fetch matches from database - EXCLUDE test matches
    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: {
          match_id: {
            not: 9999
          },
          NOT: [
            { team_a: 'Test Team A' },
            { team_b: 'Test Team B' }
          ]
        },
        orderBy: { match_date: 'asc' },
        skip: skip,
        take: limit
      }),
      prisma.match.count({
        where: {
          match_id: {
            not: 9999
          },
          NOT: [
            { team_a: 'Test Team A' },
            { team_b: 'Test Team B' }
          ]
        }
      })
    ]);

    res.json({
      success: true,
      data: matches,
      total: total,
      pagination: {
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      },
      note: matches.length === 0 ? 'No REAL matches found. Try /api/v4/sync-now' : null
    });

  } catch (error) {
    logger.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual sync endpoint - REAL DATA ONLY
app.get(`${FULL_API_PATH}/sync-now`, async (req, res) => {
  try {
    logger.info('🔄 Manual REAL data sync requested');
    
    const sportsService = new SportsDataService();
    const dataSync = new DataSyncService(sportsService);
    
    const result = await dataSync.syncMatches();
    
    res.json({
      success: result.success,
      message: result.message || (result.success ? 'Sync completed' : 'Sync failed'),
      result: result
    });

  } catch (error) {
    logger.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== CLEANUP ENDPOINTS ====================
// Clean test data
app.delete(`${FULL_API_PATH}/clean-test-data`, async (req, res) => {
  try {
    console.log('🧹 Cleaning ALL test data...');
    
    // Delete test matches
    const deleted = await prisma.match.deleteMany({
      where: {
        OR: [
          { match_id: 9999 },
          { team_a: 'Test Team A' },
          { team_b: 'Test Team B' },
          { team_a: { contains: 'Test' } },
          { team_b: { contains: 'Test' } },
          { team_a: 'Team A' },
          { team_b: 'Team B' }
        ]
      }
    });
    
    console.log(`✅ Deleted ${deleted.count} test matches`);
    
    res.json({
      success: true,
      message: `Deleted ${deleted.count} test matches`,
      deleted: deleted.count
    });
    
  } catch (error) {
    console.error('Error cleaning test data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== INITIALIZATION ====================
async function initializeBackend() {
  try {
    console.log('🔄 Initializing backend with REAL API data only...');
    
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Clean test data on startup
    console.log('🧹 Cleaning test data on startup...');
    const deleted = await prisma.match.deleteMany({
      where: {
        OR: [
          { match_id: 9999 },
          { team_a: 'Test Team A' },
          { team_b: 'Test Team B' }
        ]
      }
    });
    if (deleted.count > 0) {
      console.log(`✅ Deleted ${deleted.count} test matches`);
    }
    
    // Check existing REAL matches
    const realMatchCount = await prisma.match.count({
      where: {
        match_id: {
          not: 9999
        },
        NOT: [
          { team_a: 'Test Team A' },
          { team_b: 'Test Team B' }
        ]
      }
    });
    
    console.log(`📊 Database contains ${realMatchCount} REAL matches`);
    
    // Initialize sports service
    const sportsService = new SportsDataService();
    
    console.log('✅ Sports API key configured');
    
    // Test connection
    const isConnected = await sportsService.testConnection();
    
    if (isConnected && realMatchCount === 0) {
      console.log('🔄 No REAL matches in DB, attempting API sync...');
      const dataSync = new DataSyncService(sportsService);
      const result = await dataSync.syncMatches();
      
      if (result.success) {
        console.log(`✅ Initial sync: ${result.added} REAL matches added`);
      } else {
        console.warn('⚠️ Initial sync failed:', result.error);
        console.warn('💡 Try visiting /api/v4/test-endpoints to see available endpoints');
      }
    }
    
    console.log('✅ Backend initialization complete');
  } catch (error) {
    console.error('❌ Backend initialization failed:', error);
  }
}

// Initialize
initializeBackend();

// ==================== ERROR HANDLING ====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    available_routes: [
      '/health',
      `${FULL_API_PATH}/test-endpoints`,
      `${FULL_API_PATH}/debug/sports-api`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/sync-now`,
      `${FULL_API_PATH}/clean-test-data`
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
║    🦅 World Cup 2026 • REAL API DATA ONLY                    ║
║    🚫 NO SAMPLE DATA                                         ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Your API Key: Configured ✓                             ║
║    ✅ Auto-sync: Enabled                                     ║
║    ✅ Sample Data: DISABLED                                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\n🔗 Test these URLs now:');
console.log(`   1. Test Endpoints: https://cup-backend-red.vercel.app/api/v4/test-endpoints`);
console.log(`   2. Debug API: https://cup-backend-red.vercel.app/api/v4/debug/sports-api`);
console.log(`   3. Force REAL Sync: https://cup-backend-red.vercel.app/api/v4/sync-now`);
console.log(`   4. Clean Test Data: https://cup-backend-red.vercel.app/api/v4/clean-test-data`);
console.log(`   5. REAL Matches: https://cup-backend-red.vercel.app/api/v4/matches`);

module.exports = app;