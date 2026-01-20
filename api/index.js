// api/index.js - COMPATIBLE WITH YOUR DATABASE SCHEMA
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

// ==================== CORS CONFIG ====================
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ==================== MATCH GENERATOR (COMPATIBLE) ====================
function generateMatches() {
  console.log('🎯 Generating World Cup matches...');
  
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
    'Hard Rock Stadium, Florida'
  ];
  
  const matches = [];
  let matchId = 1000;
  const startDate = new Date('2026-06-11');
  
  Object.entries(groups).forEach(([groupName, teams]) => {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchDate = new Date(startDate);
        matchDate.setDate(startDate.getDate() + (matches.length % 20));
        matchDate.setHours(10 + (matches.length % 4) * 4);
        matchDate.setMinutes(0);
        
        // Create match data that matches your schema
        matches.push({
          match_id: matchId++, // This is Int? in schema but we'll provide it
          team_a: teams[i],
          team_b: teams[j],
          match_date: matchDate,
          venue: venues[Math.floor(Math.random() * venues.length)],
          group_name: groupName,
          status: 'scheduled', // Your schema default
          odds_team_a: parseFloat((1.8 + Math.random() * 0.6).toFixed(2)),
          odds_draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
          odds_team_b: parseFloat((2.1 + Math.random() * 0.8).toFixed(2)),
          total_staked: 0, // Your schema default
          archived: 0 // Your schema default
        });
      }
    }
  });
  
  console.log(`✅ Generated ${matches.length} matches (${Object.keys(groups).length} groups)`);
  return matches;
}

// ==================== ENDPOINTS ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'World Cup 2026 API',
    version: '2.0.0',
    compatible: true,
    database_schema: 'matches (with match_id, team_a, team_b, group_name)',
    endpoints: [
      '/health',
      '/api/v4/matches',
      '/api/v4/matches/groups',
      '/api/v4/init-db',
      '/api/v4/debug',
      '/api/v4/schema-check'
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
      database: 'connected',
      matches: matchCount,
      timestamp: new Date().toISOString(),
      schema: 'prisma/schema.prisma'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Schema check endpoint
app.get(`${FULL_API_PATH}/schema-check`, async (req, res) => {
  try {
    // Check if we can query the match table with all expected fields
    const sampleMatch = await prisma.match.findFirst({
      select: {
        id: true,
        match_id: true,
        team_a: true,
        team_b: true,
        match_date: true,
        venue: true,
        group_name: true,
        status: true,
        odds_team_a: true,
        odds_draw: true,
        odds_team_b: true
      }
    });
    
    // Check table structure
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'matches'
      ORDER BY ordinal_position;
    `;
    
    res.json({
      success: true,
      schema_compatible: true,
      sample_match: sampleMatch,
      table_columns: tableInfo,
      expected_fields: [
        'match_id (Int?)',
        'team_a (String)',
        'team_b (String)',
        'match_date (DateTime)',
        'group_name (String?)',
        'odds_team_a (Float)',
        'odds_draw (Float)',
        'odds_team_b (Float)',
        'status (String?)'
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Check database connection and table structure'
    });
  }
});

// Debug endpoint
app.get(`${FULL_API_PATH}/debug`, async (req, res) => {
  try {
    const matchCount = await prisma.match.count();
    const sampleMatches = await prisma.match.findMany({
      take: 5,
      orderBy: { match_date: 'asc' }
    });
    
    // Check for null group_name
    const nullGroupCount = await prisma.match.count({
      where: { group_name: null }
    });
    
    res.json({
      success: true,
      total_matches: matchCount,
      matches_without_group: nullGroupCount,
      sample_matches: sampleMatches,
      database_state: 'OK'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
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
        take: limit,
        select: {
          id: true,
          match_id: true,
          team_a: true,
          team_b: true,
          match_date: true,
          venue: true,
          group_name: true,
          status: true,
          odds_team_a: true,
          odds_draw: true,
          odds_team_b: true
        }
      }),
      prisma.match.count()
    ]);

    res.json({
      success: true,
      data: matches,
      total: total,
      page: page,
      limit: limit,
      has_data: total > 0
    });
  } catch (error) {
    console.error('Error in /matches:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Check database connection'
    });
  }
});

// Groups endpoint (FIXED FOR YOUR SCHEMA)
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    console.log('📊 Fetching groups for frontend...');
    
    // Get matches that have a group_name
    const matches = await prisma.match.findMany({
      where: {
        group_name: {
          not: null
        }
      },
      orderBy: { match_date: 'asc' },
      select: {
        id: true,
        match_id: true,
        team_a: true,
        team_b: true,
        match_date: true,
        venue: true,
        group_name: true,
        status: true,
        odds_team_a: true,
        odds_draw: true,
        odds_team_b: true
      }
    });
    
    console.log(`Found ${matches.length} matches with group names`);
    
    if (matches.length === 0) {
      return res.json({
        success: true,
        data: [],
        total_groups: 0,
        total_matches: 0,
        note: 'No matches with group names found. Run /api/v4/init-db first.'
      });
    }
    
    // Group matches by group_name
    const groups = {};
    
    matches.forEach(match => {
      const groupName = match.group_name;
      
      if (!groups[groupName]) {
        groups[groupName] = {
          group_name: groupName,
          matches: []
        };
      }
      
      groups[groupName].matches.push(match);
    });
    
    // Convert to array and sort
    const groupsArray = Object.values(groups);
    groupsArray.sort((a, b) => a.group_name.localeCompare(b.group_name));
    
    console.log(`Grouped into ${groupsArray.length} groups`);
    
    res.json({
      success: true,
      data: groupsArray,
      total_groups: groupsArray.length,
      total_matches: matches.length
    });
    
  } catch (error) {
    console.error('❌ Error in /matches/groups:', error);
    console.error('Full error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      note: 'This endpoint requires matches with group_name field'
    });
  }
});

// Initialize database (COMPATIBLE)
app.get(`${FULL_API_PATH}/init-db`, async (req, res) => {
  try {
    console.log('🧹 Starting database initialization...');
    
    // First check current state
    const beforeCount = await prisma.match.count();
    console.log(`Current matches: ${beforeCount}`);
    
    // Generate matches compatible with your schema
    const matches = generateMatches();
    console.log(`Generated ${matches.length} matches`);
    
    // Clear existing matches (optional)
    const clear = req.query.clear !== 'false';
    if (clear && beforeCount > 0) {
      console.log('Clearing existing matches...');
      await prisma.match.deleteMany({});
    }
    
    // Insert matches in batches
    const batchSize = 20;
    let added = 0;
    let errors = [];
    
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize);
      
      for (const match of batch) {
        try {
          // Use upsert to handle duplicate match_id
          await prisma.match.upsert({
            where: { match_id: match.match_id },
            update: match,
            create: match
          });
          added++;
        } catch (error) {
          errors.push(`Match ${match.match_id}: ${error.message}`);
          // Try without match_id constraint
          try {
            const { match_id, ...matchWithoutId } = match;
            await prisma.match.create({
              data: matchWithoutId
            });
            added++;
          } catch (secondError) {
            errors.push(`Second try failed: ${secondError.message}`);
          }
        }
      }
    }
    
    const afterCount = await prisma.match.count();
    
    console.log(`✅ Initialization complete. Added ${added} matches. Total: ${afterCount}`);
    
    res.json({
      success: true,
      message: `Database initialized with ${added} matches`,
      stats: {
        before: beforeCount,
        added: added,
        after: afterCount,
        errors: errors.length
      },
      sample_match: matches[0],
      errors: errors.slice(0, 5) // Show first 5 errors only
    });
    
  } catch (error) {
    console.error('❌ Error in /init-db:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Quick reset endpoint
app.get(`${FULL_API_PATH}/reset`, async (req, res) => {
  try {
    await prisma.match.deleteMany({});
    const matches = generateMatches();
    
    let added = 0;
    for (const match of matches) {
      await prisma.match.create({ data: match });
      added++;
    }
    
    res.json({
      success: true,
      message: `Reset complete. Added ${added} matches.`
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
    console.log('🔄 Initializing World Cup API...');
    console.log('📋 Checking database schema compatibility...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Check current matches
    const matchCount = await prisma.match.count();
    console.log(`📊 Found ${matchCount} existing matches`);
    
    // Check if we have matches with group names
    if (matchCount > 0) {
      const groupsCount = await prisma.match.count({
        where: { group_name: { not: null } }
      });
      console.log(`📈 Matches with group names: ${groupsCount}`);
      
      if (groupsCount === 0) {
        console.log('⚠️ No matches have group names. Frontend may not work properly.');
        console.log('💡 Run /api/v4/init-db to generate proper matches');
      }
    } else {
      console.log('🎯 No matches found. Generating initial data...');
      
      // Generate and insert a few matches
      const matches = generateMatches().slice(0, 12); // Start with 12 matches
      
      for (const match of matches) {
        try {
          await prisma.match.create({ data: match });
          console.log(`➕ Added: ${match.team_a} vs ${match.team_b} (${match.group_name})`);
        } catch (error) {
          console.log(`⚠️ Skipped: ${error.message}`);
        }
      }
      
      console.log('✅ Initial matches created');
    }
    
    console.log('🚀 API Ready!');
    console.log('📍 Important URLs:');
    console.log(`   1. Schema Check: https://cup-backend-red.vercel.app/api/v4/schema-check`);
    console.log(`   2. Initialize DB: https://cup-backend-red.vercel.app/api/v4/init-db`);
    console.log(`   3. Groups Endpoint: https://cup-backend-red.vercel.app/api/v4/matches/groups`);
    console.log(`   4. Health Check: https://cup-backend-red.vercel.app/health`);
    
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.error('Error details:', error);
  }
}

// Start initialization
initializeApp();

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  console.error('Error stack:', err.stack);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    note: 'Check server logs for details'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    requested: req.originalUrl,
    available_endpoints: [
      '/',
      '/health',
      `${FULL_API_PATH}/schema-check`,
      `${FULL_API_PATH}/debug`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/init-db`,
      `${FULL_API_PATH}/reset`
    ]
  });
});

module.exports = app;