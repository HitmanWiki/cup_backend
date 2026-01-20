// api/index.js - SINGLE FILE COMPLETE SOLUTION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

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
  origin: ['*'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ==================== MATCH GENERATOR ====================
function generateWorldCup2026Matches() {
  console.log('🎯 Generating World Cup 2026 matches...');
  
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
  const startDate = new Date('2026-06-11');
  
  Object.entries(groups).forEach(([groupName, teams]) => {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchDate = new Date(startDate);
        matchDate.setDate(startDate.getDate() + (matches.length % 12));
        matchDate.setHours(10 + (matches.length % 4) * 4);
        matchDate.setMinutes(0);
        
        const teamA = teams[i];
        const teamB = teams[j];
        
        // Generate odds
        const oddsTeamA = parseFloat((1.8 + Math.random() * 0.6).toFixed(2));
        const oddsDraw = parseFloat((3.2 + Math.random() * 0.5).toFixed(2));
        const oddsTeamB = parseFloat((2.1 + Math.random() * 0.8).toFixed(2));
        
        matches.push({
          match_id: matchId++,
          team_a: teamA,
          team_b: teamB,
          match_date: matchDate,
          venue: venues[Math.floor(Math.random() * venues.length)],
          group_name: groupName,
          status: 'upcoming',
          odds_team_a: oddsTeamA,
          odds_draw: oddsDraw,
          odds_team_b: oddsTeamB
        });
      }
    }
  });
  
  console.log(`✅ Generated ${matches.length} World Cup 2026 matches`);
  return matches;
}

// ==================== ENDPOINTS ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: '1.0.0',
    endpoints: [
      '/health',
      `${FULL_API_PATH}/test-endpoints`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/init-db`,
      `${FULL_API_PATH}/sync-now`
    ]
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      matches_in_database: matchCount
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Test API endpoints
app.get(`${FULL_API_PATH}/test-endpoints`, async (req, res) => {
  res.json({
    success: true,
    subscription_level: {
      has_match_data_access: false,
      recommendation: 'Using generated World Cup 2026 data',
      note: 'Your subscription only includes Competitions, Areas, Venues endpoints'
    },
    available_endpoints: [
      'Competitions',
      'Areas', 
      'Venues'
    ]
  });
});

// Main matches endpoint
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Groups endpoint (FIXED FOR FRONTEND)
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { match_date: 'asc' }
    });

    // Group matches properly
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

    // Convert to array
    const groupsArray = Object.values(groupsMap);

    res.json({
      success: true,
      data: groupsArray,  // Array format for frontend
      total_groups: groupsArray.length,
      total_matches: matches.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upcoming matches
app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const now = new Date();
    
    const matches = await prisma.match.findMany({
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
      data: matches,
      total: matches.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize database (NEW ENDPOINT)
app.get(`${FULL_API_PATH}/init-db`, async (req, res) => {
  try {
    console.log('🧹 Clearing existing matches...');
    await prisma.match.deleteMany({});
    
    console.log('🎯 Generating new matches...');
    const matches = generateWorldCup2026Matches();
    
    let added = 0;
    for (const match of matches) {
      await prisma.match.create({
        data: match
      });
      added++;
    }
    
    res.json({
      success: true,
      message: `Database initialized with ${added} World Cup 2026 matches`,
      matches_added: added
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync endpoint (for compatibility)
app.get(`${FULL_API_PATH}/sync-now`, async (req, res) => {
  try {
    console.log('🔄 Syncing matches...');
    
    // Clear and regenerate
    await prisma.match.deleteMany({});
    const matches = generateWorldCup2026Matches();
    
    let added = 0;
    for (const match of matches) {
      await prisma.match.create({
        data: match
      });
      added++;
    }
    
    res.json({
      success: true,
      message: `Synced ${added} matches`,
      matches_added: added
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== INITIALIZATION ====================
async function initializeApp() {
  try {
    console.log('🔄 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Check if we have matches
    const matchCount = await prisma.match.count();
    console.log(`📊 Found ${matchCount} existing matches`);
    
    if (matchCount === 0) {
      console.log('🎯 Generating initial match data...');
      const matches = generateWorldCup2026Matches();
      
      for (const match of matches.slice(0, 10)) {
        try {
          await prisma.match.create({
            data: match
          });
        } catch (error) {
          console.log(`⚠️ Skipping match ${match.match_id}: ${error.message}`);
        }
      }
      
      console.log('✅ Initial matches generated');
    }
    
    console.log('🚀 API is ready!');
    console.log(`📍 Base URL: https://cup-backend-red.vercel.app`);
    console.log(`📍 API Path: ${FULL_API_PATH}`);
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
}

// Start initialization
initializeApp();

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    available_routes: [
      '/',
      '/health',
      `${FULL_API_PATH}/test-endpoints`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/init-db`,
      `${FULL_API_PATH}/sync-now`
    ]
  });
});

// Export for Vercel
module.exports = app;