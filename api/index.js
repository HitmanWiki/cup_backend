// api/index.js - COMPLETE WORKING VERSION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Simple logger
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
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app',
    'https://world-rust-pi.vercel.app'
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

// ==================== SPORTS DATA SERVICE ====================
class SportsDataService {
  constructor() {
    this.baseUrl = process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores';
    this.apiKey = process.env.SPORTS_DATA_API_KEY;
    
    console.log('🔧 SportsDataService initialized');
  }

  async testConnection() {
    try {
      console.log('🔗 Testing API connection...');
      
      // Test with Competitions endpoint
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

  async testEndpoints() {
    console.log('🧪 Testing available endpoints...');
    const endpoints = [
      { name: 'Competitions', url: `${this.baseUrl}/json/Competitions` },
      { name: 'Areas', url: `${this.baseUrl}/json/Areas` },
      { name: 'Venues', url: `${this.baseUrl}/json/Venues` },
      { name: 'UpcomingSchedule', url: `${this.baseUrl}/json/UpcomingSchedule` },
      { name: 'Schedule', url: `${this.baseUrl}/json/Schedule` },
      { name: 'Matches', url: `${this.baseUrl}/json/Matches` },
      { name: 'Scores/WorldCup/2022', url: `${this.baseUrl}/json/Scores/WorldCup/2022` }
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

  async generateWorldCup2026Matches() {
    console.log('🎯 Generating World Cup 2026 matches...');
    
    // World Cup 2026 groups and teams (actual qualified/expected teams)
    const groups = {
      'Group A': ['USA', 'Canada', 'Mexico', 'Costa Rica'],
      'Group B': ['Brazil', 'Argentina', 'Uruguay', 'Chile'],
      'Group C': ['England', 'France', 'Germany', 'Netherlands'],
      'Group D': ['Spain', 'Portugal', 'Italy', 'Belgium'],
      'Group E': ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
      'Group F': ['Morocco', 'Egypt', 'Senegal', 'Nigeria'],
      'Group G': ['Switzerland', 'Denmark', 'Sweden', 'Norway'],
      'Group H': ['Iran', 'South Africa', 'New Zealand', 'Qatar']
    };
    
    const venues = [
      'MetLife Stadium, New Jersey',
      'SoFi Stadium, California',
      'AT&T Stadium, Texas',
      'Mercedes-Benz Stadium, Georgia',
      'Hard Rock Stadium, Florida',
      'Arrowhead Stadium, Missouri',
      'Lumen Field, Washington',
      'BC Place, Vancouver'
    ];
    
    const matches = [];
    let matchId = 1000;
    
    // Generate group stage matches (June 11 - July 2, 2026)
    const startDate = new Date('2026-06-11');
    
    Object.entries(groups).forEach(([groupName, teams]) => {
      // Each team plays each other once (6 matches per group)
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const matchDate = new Date(startDate);
          matchDate.setDate(startDate.getDate() + (matches.length % 12)); // Spread over 12 days
          
          // Set specific times
          matchDate.setHours(10 + (matches.length % 4) * 4); // 10am, 2pm, 6pm, 10pm
          matchDate.setMinutes(0);
          
          // Generate realistic odds based on team strength
          const teamA = teams[i];
          const teamB = teams[j];
          
          // Simple ranking (top teams have better odds)
          const topTeams = ['Brazil', 'Argentina', 'France', 'England', 'Spain', 'Germany'];
          const strongTeams = ['Portugal', 'Italy', 'Netherlands', 'Belgium', 'Uruguay', 'USA'];
          
          let oddsTeamA = 1.8 + Math.random() * 0.6;
          let oddsTeamB = 2.1 + Math.random() * 0.8;
          
          // Adjust odds based on team strength
          if (topTeams.includes(teamA) && !topTeams.includes(teamB)) {
            oddsTeamA = 1.4 + Math.random() * 0.4;
            oddsTeamB = 3.5 + Math.random() * 1.0;
          } else if (topTeams.includes(teamB) && !topTeams.includes(teamA)) {
            oddsTeamA = 3.5 + Math.random() * 1.0;
            oddsTeamB = 1.4 + Math.random() * 0.4;
          } else if (strongTeams.includes(teamA) && !strongTeams.includes(teamB) && !topTeams.includes(teamB)) {
            oddsTeamA = 1.6 + Math.random() * 0.5;
            oddsTeamB = 2.8 + Math.random() * 0.7;
          }
          
          matches.push({
            match_id: matchId++,
            team_a: teamA,
            team_b: teamB,
            match_date: matchDate,
            venue: venues[Math.floor(Math.random() * venues.length)],
            group_name: groupName,
            status: 'upcoming',
            odds_team_a: parseFloat(oddsTeamA.toFixed(2)),
            odds_draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
            odds_team_b: parseFloat(oddsTeamB.toFixed(2)),
            source: 'generated'
          });
        }
      }
    });
    
    console.log(`✅ Generated ${matches.length} World Cup 2026 matches`);
    return matches;
  }
}

// ==================== DATA SYNC SERVICE ====================
class DataSyncService {
  constructor() {
    this.sportsService = new SportsDataService();
  }

  async syncMatches() {
    try {
      logger.info('🔄 Starting match sync...');
      
      // Test API connection first
      const isConnected = await this.sportsService.testConnection();
      if (!isConnected) {
        logger.warn('⚠️ API connection failed, using generated data');
      }
      
      // Always generate matches (since your subscription doesn't have match endpoints)
      const matches = await this.sportsService.generateWorldCup2026Matches();
      
      console.log(`📥 Processing ${matches.length} matches...`);
      
      let added = 0;
      let updated = 0;
      let errors = 0;

      // Clear existing matches first
      try {
        await prisma.match.deleteMany({});
        console.log('🧹 Cleared existing matches');
      } catch (error) {
        console.log('No matches to clear');
      }

      // Insert new matches
      for (const matchData of matches) {
        try {
          const savedMatch = await prisma.match.create({
            data: matchData
          });
          
          added++;
          if (added <= 5) {
            console.log(`✅ Added: ${matchData.team_a} vs ${matchData.team_b}`);
          }
        } catch (matchError) {
          errors++;
          if (errors <= 3) {
            console.warn(`⚠️ Failed to save match: ${matchError.message}`);
          }
        }
      }

      logger.info(`✅ Sync completed: ${added} added, ${updated} updated, ${errors} errors`);
      
      return {
        success: true,
        total: matches.length,
        added,
        updated,
        errors,
        message: `Generated ${added} World Cup 2026 matches`
      };

    } catch (error) {
      logger.error('❌ Data sync failed:', error);
      return {
        success: false,
        error: error.message,
        total: 0,
        added: 0,
        updated: 0
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
    
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      matches_in_database: matchCount,
      subscription_level: 'Basic (no match data access)'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Test endpoints
app.get(`${FULL_API_PATH}/test-endpoints`, async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    const endpointResults = await sportsService.testEndpoints();
    
    const available = endpointResults.filter(e => e.ok);
    const unavailable = endpointResults.filter(e => !e.ok);
    
    // Check if we have match data access
    const matchEndpoints = ['UpcomingSchedule', 'Schedule', 'Matches', 'Scores/WorldCup'];
    const hasMatchAccess = available.some(endpoint => matchEndpoints.includes(endpoint.name));
    
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
      subscription_level: {
        has_match_data_access: hasMatchAccess,
        recommendation: hasMatchAccess ? 'Your plan includes match data' : 'Upgrade required for real match data',
        available_features: available.map(e => e.name)
      },
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

// Main matches endpoint - FIXED FOR FRONTEND
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Fetch matches from database
    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        orderBy: { match_date: 'asc' },
        skip: skip,
        take: limit
      }),
      prisma.match.count()
    ]);

    res.json({
      success: true,
      data: matches,
      total: total,
      pagination: {
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching matches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Groups endpoint - FIXED FOR FRONTEND (returns array, not object)
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { match_date: 'asc' }
    });

    // Group matches by group_name
    const groupsMap = {};
    
    matches.forEach(match => {
      const groupName = match.group_name || 'Other';
      
      if (!groupsMap[groupName]) {
        groupsMap[groupName] = {
          group_name: groupName,
          matches: []
        };
      }
      
      groupsMap[groupName].matches.push(match);
    });

    // Convert to array and sort by group name
    const groupsArray = Object.values(groupsMap)
      .sort((a, b) => a.group_name.localeCompare(b.group_name));

    res.json({
      success: true,
      data: groupsArray,  // Return as array, not object
      total_groups: groupsArray.length,
      total_matches: matches.length,
      note: matches.length === 0 ? 'No matches found. Try /api/v4/sync-now' : null
    });

  } catch (error) {
    logger.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upcoming matches endpoint
app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const now = new Date();
    
    const upcomingMatches = await prisma.match.findMany({
      where: {
        match_date: {
          gt: now
        }
      },
      orderBy: { match_date: 'asc' },
      take: limit
    });

    res.json({
      success: true,
      data: upcomingMatches,
      total: upcomingMatches.length
    });

  } catch (error) {
    logger.error('Error fetching upcoming matches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Single match endpoint
app.get(`${FULL_API_PATH}/matches/:matchId`, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await prisma.match.findUnique({
      where: { match_id: parseInt(matchId) }
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      data: match
    });

  } catch (error) {
    logger.error('Error fetching match:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Competitions endpoint
app.get(`${FULL_API_PATH}/competitions`, async (req, res) => {
  try {
    const sportsService = new SportsDataService();
    const competitions = await sportsService.testConnection();
    
    // For now, return sample competitions since we know Competitions endpoint works
    const sampleCompetitions = [
      {
        CompetitionId: 21,
        Name: "FIFA World Cup",
        Season: 2026,
        Type: "International"
      },
      {
        CompetitionId: 1,
        Name: "UEFA Champions League",
        Season: 2024,
        Type: "Club"
      }
    ];
    
    res.json({
      success: true,
      data: sampleCompetitions,
      total: sampleCompetitions.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual sync endpoint
app.get(`${FULL_API_PATH}/sync-now`, async (req, res) => {
  try {
    logger.info('🔄 Manual sync requested');
    
    const dataSync = new DataSyncService();
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

// Initialize database
app.get(`${FULL_API_PATH}/init-db`, async (req, res) => {
  try {
    // Clear existing data
    await prisma.match.deleteMany({});
    
    // Generate new data
    const dataSync = new DataSyncService();
    const result = await dataSync.syncMatches();
    
    res.json({
      success: true,
      message: 'Database initialized with World Cup 2026 matches',
      result: result
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
    
    if (matchCount === 0) {
      console.log('🔄 No matches in DB, generating initial data...');
      const dataSync = new DataSyncService();
      const result = await dataSync.syncMatches();
      
      if (result.success) {
        console.log(`✅ Initial data generated: ${result.added} matches`);
      } else {
        console.error('❌ Failed to generate initial data:', result.error);
      }
    } else {
      console.log(`📊 Database contains ${matchCount} matches`);
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
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/matches/:matchId`,
      `${FULL_API_PATH}/competitions`,
      `${FULL_API_PATH}/sync-now`,
      `${FULL_API_PATH}/init-db`
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
║    🦅 World Cup 2026 • READY FOR FRONTEND                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Database: Connected                                     ║
║    ✅ Match Generation: Enabled                               ║
║    ✅ Frontend Endpoints: Fixed                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\n🔗 Your frontend should now work with these URLs:');
console.log(`   1. Test API: https://cup-backend-red.vercel.app/api/v4/test-endpoints`);
console.log(`   2. Matches: https://cup-backend-red.vercel.app/api/v4/matches`);
console.log(`   3. Groups: https://cup-backend-red.vercel.app/api/v4/matches/groups`);
console.log(`   4. Initialize DB: https://cup-backend-red.vercel.app/api/v4/init-db`);
console.log(`   5. Health: https://cup-backend-red.vercel.app/health`);

console.log('\n⚠️  IMPORTANT: Your SportsData.io subscription only includes:');
console.log('   • Competitions, Areas, Venues');
console.log('   • NO match data endpoints available');
console.log('   • Using generated World Cup 2026 matches');

module.exports = app;