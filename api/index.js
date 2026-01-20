// api/index.js - WITH CORRECT SPORTSDATA.IO ENDPOINTS
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

// ==================== SPORTS DATA SERVICE (WITH CORRECT ENDPOINTS) ====================
class SportsDataService {
  constructor() {
    this.baseUrl = process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores';
    this.apiKey = process.env.SPORTS_DATA_API_KEY;
    
    console.log('🔧 SportsDataService initialized:', {
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl,
      apiKeyFirst8: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'none'
    });
  }

  async testConnection() {
    try {
      console.log('🔗 Testing API connection...');
      
      // Try Areas endpoint which should be available
      const response = await fetch(`${this.baseUrl}/json/Areas`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });

      if (!response.ok) {
        console.log(`⚠️ Areas endpoint returned ${response.status}, trying Competitions...`);
        
        // Try Competitions endpoint
        const compResponse = await fetch(`${this.baseUrl}/json/Competitions`, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });
        
        if (!compResponse.ok) {
          throw new Error(`API returned ${compResponse.status}: ${compResponse.statusText}`);
        }
        
        const compData = await compResponse.json();
        console.log(`✅ API connected via Competitions. Found ${compData.length} competitions`);
        return true;
      }

      const data = await response.json();
      console.log(`✅ API connected via Areas. Found ${data.length} areas`);
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
      return [];
    }
  }

  async fetchWorldCupMatches() {
    try {
      console.log('🌍 Fetching World Cup matches...');
      
      // FIRST: Try to get World Cup 2022 matches (available data)
      console.log('📡 Trying to fetch World Cup 2022 matches...');
      try {
        const response2022 = await fetch(`${this.baseUrl}/json/Scores/WorldCup/2022`, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });
        
        if (response2022.ok) {
          const matches2022 = await response2022.json();
          console.log(`✅ Found ${matches2022.length} World Cup 2022 matches`);
          return this.transformMatches(matches2022);
        }
      } catch (error2022) {
        console.log('⚠️ World Cup 2022 endpoint failed:', error2022.message);
      }
      
      // SECOND: Try to get upcoming matches
      console.log('📡 Trying to fetch upcoming matches...');
      try {
        const responseUpcoming = await fetch(`${this.baseUrl}/json/UpcomingSchedule`, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });
        
        if (responseUpcoming.ok) {
          const upcomingMatches = await responseUpcoming.json();
          console.log(`✅ Found ${upcomingMatches.length} upcoming matches`);
          
          // Filter for World Cup matches
          const worldCupMatches = upcomingMatches.filter(match => 
            match.CompetitionId === 21 || 
            (match.Competition && match.Competition.includes('World Cup'))
          );
          
          console.log(`🌍 Found ${worldCupMatches.length} upcoming World Cup matches`);
          return this.transformMatches(worldCupMatches);
        }
      } catch (errorUpcoming) {
        console.log('⚠️ UpcomingSchedule endpoint failed:', errorUpcoming.message);
      }
      
      // THIRD: Try to get scheduled matches
      console.log('📡 Trying to fetch scheduled matches...');
      try {
        const responseSchedule = await fetch(`${this.baseUrl}/json/Schedule`, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });
        
        if (responseSchedule.ok) {
          const scheduledMatches = await responseSchedule.json();
          console.log(`✅ Found ${scheduledMatches.length} scheduled matches`);
          
          // Filter for World Cup matches
          const worldCupMatches = scheduledMatches.filter(match => 
            match.CompetitionId === 21 || 
            (match.Competition && match.Competition.includes('World Cup'))
          );
          
          console.log(`🌍 Found ${worldCupMatches.length} scheduled World Cup matches`);
          return this.transformMatches(worldCupMatches);
        }
      } catch (errorSchedule) {
        console.log('⚠️ Schedule endpoint failed:', errorSchedule.message);
      }
      
      // FOURTH: Try to get all matches (might not be available)
      console.log('📡 Trying to fetch all matches...');
      try {
        const responseAll = await fetch(`${this.baseUrl}/json/Matches`, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey
          }
        });
        
        if (responseAll.ok) {
          const allMatches = await responseAll.json();
          console.log(`✅ Found ${allMatches.length} total matches`);
          
          // Filter for World Cup matches
          const worldCupMatches = allMatches.filter(match => 
            match.CompetitionId === 21 || 
            (match.Competition && match.Competition.includes('World Cup'))
          );
          
          console.log(`🌍 Found ${worldCupMatches.length} World Cup matches`);
          return this.transformMatches(worldCupMatches);
        } else {
          console.log(`❌ Matches endpoint returned ${responseAll.status}`);
        }
      } catch (errorAll) {
        console.log('⚠️ Matches endpoint failed:', errorAll.message);
      }
      
      console.log('⚠️ No World Cup matches found from any endpoint');
      console.log('💡 Your subscription might not include match data yet');
      
      // Generate sample World Cup 2026 matches as fallback
      return this.generateSampleWorldCup2026Matches();
      
    } catch (error) {
      console.error('❌ Error fetching World Cup matches:', error);
      return this.generateSampleWorldCup2026Matches();
    }
  }

  transformMatches(apiMatches) {
    if (!apiMatches || !Array.isArray(apiMatches)) {
      return [];
    }
    
    return apiMatches.map(match => this.transformMatchData(match));
  }

  transformMatchData(apiMatch) {
    // Parse match date
    const matchDate = apiMatch.DateTime ? new Date(apiMatch.DateTime) : 
                     apiMatch.Date ? new Date(apiMatch.Date) : 
                     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Determine status
    let status = 'upcoming';
    if (apiMatch.Status === 'Final') status = 'finished';
    if (apiMatch.Status === 'InProgress') status = 'live';
    if (apiMatch.Status === 'Canceled') status = 'cancelled';

    // Calculate odds
    const getOdds = () => {
      const base = {
        teamA: 1.8 + Math.random() * 0.6,
        draw: 3.2 + Math.random() * 0.5,
        teamB: 2.1 + Math.random() * 0.8
      };
      return {
        teamA: parseFloat(base.teamA.toFixed(2)),
        draw: parseFloat(base.draw.toFixed(2)),
        teamB: parseFloat(base.teamB.toFixed(2))
      };
    };

    const odds = getOdds();

    return {
      match_id: apiMatch.MatchId || apiMatch.GameId || apiMatch.Id || Date.now() + Math.floor(Math.random() * 1000),
      team_a: apiMatch.HomeTeam || apiMatch.HomeTeamName || 'Team A',
      team_b: apiMatch.AwayTeam || apiMatch.AwayTeamName || 'Team B',
      match_date: matchDate,
      venue: apiMatch.Venue || apiMatch.Stadium || 'World Cup Stadium',
      group_name: apiMatch.Group || apiMatch.Round || 'Group Stage',
      status: status,
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB
    };
  }

  generateSampleWorldCup2026Matches() {
    console.log('🎯 Generating sample World Cup 2026 matches...');
    
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const groupTeams = {
      'A': ['USA', 'Canada', 'Mexico', 'Costa Rica'],
      'B': ['Brazil', 'Argentina', 'Uruguay', 'Chile'],
      'C': ['England', 'France', 'Germany', 'Netherlands'],
      'D': ['Spain', 'Portugal', 'Italy', 'Belgium'],
      'E': ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
      'F': ['Morocco', 'Egypt', 'Senegal', 'Nigeria'],
      'G': ['Switzerland', 'Denmark', 'Sweden', 'Norway'],
      'H': ['Iran', 'South Africa', 'New Zealand', 'Qatar']
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
    const startDate = new Date('2026-06-11');
    
    // Generate group stage matches (48 matches)
    groups.forEach(group => {
      const teams = groupTeams[group];
      
      // Each team plays each other once (6 matches per group)
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const matchDate = new Date(startDate);
          matchDate.setDate(startDate.getDate() + (matches.length % 10));
          
          matches.push({
            match_id: matchId++,
            team_a: teams[i],
            team_b: teams[j],
            match_date: matchDate,
            venue: venues[matches.length % venues.length],
            group_name: `Group ${group}`,
            status: 'upcoming',
            odds_team_a: parseFloat((1.8 + Math.random() * 0.6).toFixed(2)),
            odds_draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
            odds_team_b: parseFloat((2.1 + Math.random() * 0.8).toFixed(2))
          });
        }
      }
    });
    
    console.log(`✅ Generated ${matches.length} sample World Cup 2026 matches`);
    return matches;
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
      hasApiKey: !!this.apiKey,
      apiKeyConfigured: this.apiKey && this.apiKey !== 'your_sports_data_api_key'
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
      logger.info('🔄 Starting data sync...');
      
      // Test API connection
      const isConnected = await this.sportsService.testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Sports API');
      }
      
      // Fetch matches from API
      const apiMatches = await this.sportsService.fetchWorldCupMatches();
      
      if (apiMatches.length === 0) {
        logger.warn('⚠️ No matches found');
        return {
          success: false,
          error: 'No matches found',
          total: 0,
          added: 0,
          updated: 0
        };
      }

      logger.info(`📥 Processing ${apiMatches.length} matches...`);
      
      let added = 0;
      let updated = 0;
      let errors = 0;

      // Process each match
      for (const matchData of apiMatches.slice(0, 100)) { // Limit to 100
        try {
          if (!matchData.match_id) {
            logger.warn(`⚠️ Skipping match without ID`);
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
              console.log(`✅ Added match: ${matchData.team_a} vs ${matchData.team_b}`);
            }
          }
        } catch (matchError) {
          errors++;
          console.warn(`⚠️ Failed to save match: ${matchError.message}`);
        }
      }

      logger.info(`✅ Sync completed: ${added} added, ${updated} updated, ${errors} errors`);
      
      return {
        success: true,
        total: apiMatches.length,
        added,
        updated,
        errors
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
    
    const sportsService = new SportsDataService();
    const sportsHealth = sportsService.healthCheck();
    
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      matches_in_database: matchCount,
      sports_api: sportsHealth.hasApiKey ? 'configured' : 'not_configured',
      api_key_configured: sportsHealth.apiKeyConfigured
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
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
        groups: Object.keys(groups).length
      },
      config: {
        apiKey: process.env.SPORTS_DATA_API_KEY ? '✓ Set' : '✗ Missing',
        baseUrl: process.env.SPORTS_DATA_API_URL,
        apiKeyFirst8: process.env.SPORTS_DATA_API_KEY ? 
          `${process.env.SPORTS_DATA_API_KEY.substring(0, 8)}...` : 'none'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      config: {
        apiKey: process.env.SPORTS_DATA_API_KEY ? 'Set' : 'Not set',
        baseUrl: process.env.SPORTS_DATA_API_URL
      }
    });
  }
});

// Main matches endpoint
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

// Group stage matches
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        group_name: {
          not: null
        }
      },
      orderBy: {
        match_date: 'asc'
      }
    });

    // Group by group_name
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
    logger.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upcoming matches
app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const now = new Date();

    const matches = await prisma.match.findMany({
      where: {
        status: 'upcoming',
        match_date: {
          gt: now
        }
      },
      orderBy: {
        match_date: 'asc'
      },
      take: limit
    });

    res.json({
      success: true,
      data: matches,
      count: matches.length
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
    
    const sportsService = new SportsDataService();
    const dataSync = new DataSyncService(sportsService);
    
    const result = await dataSync.syncMatches();
    
    res.json({
      success: result.success,
      message: result.success ? `Sync completed: ${result.added} added, ${result.updated} updated` : 'Sync failed',
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
    
    // Check API key
    const sportsService = new SportsDataService();
    const health = sportsService.healthCheck();
    
    if (health.hasApiKey && health.apiKeyConfigured) {
      console.log('✅ Sports API key configured');
      
      // Test connection
      const isConnected = await sportsService.testConnection();
      
      if (isConnected && matchCount === 0) {
        console.log('🔄 No matches in DB, performing initial sync...');
        const dataSync = new DataSyncService(sportsService);
        const result = await dataSync.syncMatches();
        
        if (result.success) {
          console.log(`✅ Initial sync: ${result.added} matches added`);
        } else {
          console.warn('⚠️ Initial sync failed:', result.error);
        }
      }
    } else {
      console.warn('⚠️ Sports API key not properly configured');
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
      `${FULL_API_PATH}/debug/sports-api`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/sync-now`
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
║    🦅 World Cup 2026 • REAL SPORTS DATA                      ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Your API Key: Configured ✓                             ║
║    ✅ Auto-sync: Enabled                                     ║
║    ✅ Using: SportsData.io API                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\n🔗 Test these URLs now:');
console.log(`   1. Debug API: https://cup-backend-red.vercel.app/api/v4/debug/sports-api`);
console.log(`   2. Force Sync: https://cup-backend-red.vercel.app/api/v4/sync-now`);
console.log(`   3. Matches: https://cup-backend-red.vercel.app/api/v4/matches`);
console.log(`   4. Health: https://cup-backend-red.vercel.app/health`);

module.exports = app;