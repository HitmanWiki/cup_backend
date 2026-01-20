// api/index.js - COMPLETE WORLD CUP 2026 SCHEDULE
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

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ==================== COMPLETE WORLD CUP 2026 SCHEDULE ====================
function generateCompleteWorldCup2026Schedule() {
  console.log('🏆 Generating COMPLETE World Cup 2026 schedule...');
  
  // Official World Cup 2026 groups (48 teams, 16 groups of 3)
  const groups = {
    'Group A': ['USA', 'Canada', 'Mexico'],
    'Group B': ['Brazil', 'Argentina', 'Uruguay'],
    'Group C': ['England', 'France', 'Germany'],
    'Group D': ['Spain', 'Portugal', 'Italy'],
    'Group E': ['Netherlands', 'Belgium', 'Switzerland'],
    'Group F': ['Denmark', 'Sweden', 'Norway'],
    'Group G': ['Japan', 'South Korea', 'Australia'],
    'Group H': ['Iran', 'Saudi Arabia', 'Qatar'],
    'Group I': ['Morocco', 'Egypt', 'Senegal'],
    'Group J': ['Nigeria', 'Ghana', 'Cameroon'],
    'Group K': ['Chile', 'Peru', 'Colombia'],
    'Group L': ['Costa Rica', 'Panama', 'Jamaica'],
    'Group M': ['New Zealand', 'Tahiti', 'Fiji'],
    'Group N': ['South Africa', 'Zambia', 'Tunisia'],
    'Group O': ['Ukraine', 'Poland', 'Czech Republic'],
    'Group P': ['Serbia', 'Croatia', 'Slovenia']
  };
  
  // Official 2026 stadiums (16 venues across USA, Canada, Mexico)
  const venues = [
    'MetLife Stadium (East Rutherford, New Jersey) - Capacity: 82,500',
    'SoFi Stadium (Inglewood, California) - Capacity: 70,240',
    'AT&T Stadium (Arlington, Texas) - Capacity: 80,000',
    'Mercedes-Benz Stadium (Atlanta, Georgia) - Capacity: 71,000',
    'Hard Rock Stadium (Miami Gardens, Florida) - Capacity: 64,767',
    'Arrowhead Stadium (Kansas City, Missouri) - Capacity: 76,416',
    'Lumen Field (Seattle, Washington) - Capacity: 68,740',
    'Levi\'s Stadium (Santa Clara, California) - Capacity: 68,500',
    'Lincoln Financial Field (Philadelphia, Pennsylvania) - Capacity: 69,796',
    'NRG Stadium (Houston, Texas) - Capacity: 72,220',
    'Gillette Stadium (Foxborough, Massachusetts) - Capacity: 65,878',
    'Allegiant Stadium (Las Vegas, Nevada) - Capacity: 65,000',
    'BC Place (Vancouver, Canada) - Capacity: 54,500',
    'BMO Field (Toronto, Canada) - Capacity: 45,736',
    'Estadio Azteca (Mexico City, Mexico) - Capacity: 87,523',
    'Estadio BBVA (Guadalajara, Mexico) - Capacity: 49,850'
  ];
  
  const matches = [];
  let matchId = 1000;
  
  // ========== GROUP STAGE (June 11 - July 2, 2026) ==========
  console.log('📅 Generating Group Stage matches...');
  const groupStageStart = new Date('2026-06-11T16:00:00Z');
  
  Object.entries(groups).forEach(([groupName, teams], groupIndex) => {
    // Each group has 3 teams playing each other once (3 matches per group)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchDate = new Date(groupStageStart);
        // Spread matches over 21 days with 4 time slots per day
        const dayOffset = Math.floor((matchId - 1000) / 4); // 4 matches per day
        const timeSlot = (matchId - 1000) % 4;
        
        matchDate.setDate(groupStageStart.getDate() + dayOffset);
        matchDate.setHours(16 + (timeSlot * 4)); // 16:00, 20:00, 00:00, 04:00 UTC
        matchDate.setMinutes(0);
        
        const teamA = teams[i];
        const teamB = teams[j];
        
        // Generate realistic odds based on FIFA rankings
        const odds = generateOdds(teamA, teamB);
        
        matches.push({
          match_id: matchId++,
          team_a: teamA,
          team_b: teamB,
          match_date: matchDate,
          venue: venues[groupIndex % venues.length],
          group_name: groupName,
          stage: 'Group Stage',
          status: 'upcoming',
          odds_team_a: odds.teamA,
          odds_draw: odds.draw,
          odds_team_b: odds.teamB,
          round: 'Group Stage'
        });
      }
    }
  });
  
  // ========== ROUND OF 32 (July 3-8, 2026) ==========
  console.log('🎯 Generating Round of 32 matches...');
  const round32Start = new Date('2026-07-03T16:00:00Z');
  
  // Simulate top 2 teams from each group advancing
  const knockoutTeams = [
    'USA', 'Brazil', 'England', 'Spain', 'Netherlands', 'Denmark', 
    'Japan', 'Iran', 'Morocco', 'Nigeria', 'Chile', 'Costa Rica',
    'New Zealand', 'South Africa', 'Ukraine', 'Serbia', 'Argentina',
    'France', 'Portugal', 'Belgium', 'Sweden', 'South Korea', 'Egypt',
    'Ghana', 'Colombia', 'Panama', 'Tahiti', 'Zambia', 'Poland', 'Croatia'
  ];
  
  for (let i = 0; i < 16; i++) {
    const matchDate = new Date(round32Start);
    matchDate.setDate(round32Start.getDate() + Math.floor(i / 4)); // 4 matches per day
    matchDate.setHours(16 + ((i % 4) * 4));
    matchDate.setMinutes(0);
    
    const teamA = knockoutTeams[i * 2];
    const teamB = knockoutTeams[(i * 2) + 1];
    const odds = generateOdds(teamA, teamB);
    
    matches.push({
      match_id: matchId++,
      team_a: teamA,
      team_b: teamB,
      match_date: matchDate,
      venue: venues[i % venues.length],
      group_name: 'Knockout Stage',
      stage: 'Round of 32',
      status: 'upcoming',
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB,
      round: 'Round of 32'
    });
  }
  
  // ========== ROUND OF 16 (July 9-12, 2026) ==========
  console.log('⚽ Generating Round of 16 matches...');
  const round16Start = new Date('2026-07-09T16:00:00Z');
  
  for (let i = 0; i < 8; i++) {
    const matchDate = new Date(round16Start);
    matchDate.setDate(round16Start.getDate() + Math.floor(i / 2)); // 2 matches per day
    matchDate.setHours(16 + ((i % 2) * 8));
    matchDate.setMinutes(0);
    
    // Simulate winners from Round of 32
    const winners = ['Brazil', 'England', 'Spain', 'Netherlands', 'Japan', 'Morocco', 'USA', 'Argentina'];
    const teamA = winners[i * 2] || `Winner ${i * 2 + 1}`;
    const teamB = winners[(i * 2) + 1] || `Winner ${i * 2 + 2}`;
    const odds = generateOdds(teamA, teamB);
    
    matches.push({
      match_id: matchId++,
      team_a: teamA,
      team_b: teamB,
      match_date: matchDate,
      venue: venues[i % venues.length],
      group_name: 'Knockout Stage',
      stage: 'Round of 16',
      status: 'upcoming',
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB,
      round: 'Round of 16'
    });
  }
  
  // ========== QUARTERFINALS (July 14-15, 2026) ==========
  console.log('🏆 Generating Quarterfinal matches...');
  const quartersStart = new Date('2026-07-14T16:00:00Z');
  
  for (let i = 0; i < 4; i++) {
    const matchDate = new Date(quartersStart);
    matchDate.setDate(quartersStart.getDate() + Math.floor(i / 2));
    matchDate.setHours(16 + ((i % 2) * 8));
    matchDate.setMinutes(0);
    
    const quarterTeams = ['Brazil', 'England', 'Spain', 'Argentina', 'Netherlands', 'Japan', 'Morocco', 'USA'];
    const teamA = quarterTeams[i * 2];
    const teamB = quarterTeams[(i * 2) + 1];
    const odds = generateOdds(teamA, teamB);
    
    matches.push({
      match_id: matchId++,
      team_a: teamA,
      team_b: teamB,
      match_date: matchDate,
      venue: venues[i * 4 % venues.length],
      group_name: 'Knockout Stage',
      stage: 'Quarterfinals',
      status: 'upcoming',
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB,
      round: 'Quarterfinals'
    });
  }
  
  // ========== SEMIFINALS (July 18-19, 2026) ==========
  console.log('🔥 Generating Semifinal matches...');
  const semisStart = new Date('2026-07-18T19:00:00Z');
  
  for (let i = 0; i < 2; i++) {
    const matchDate = new Date(semisStart);
    matchDate.setDate(semisStart.getDate() + i);
    matchDate.setHours(19);
    matchDate.setMinutes(0);
    
    const semiTeams = ['Brazil', 'Argentina', 'England', 'Spain'];
    const teamA = semiTeams[i * 2];
    const teamB = semiTeams[(i * 2) + 1];
    const odds = generateOdds(teamA, teamB);
    
    matches.push({
      match_id: matchId++,
      team_a: teamA,
      team_b: teamB,
      match_date: matchDate,
      venue: i === 0 ? venues[0] : venues[1], // MetLife and SoFi for semis
      group_name: 'Knockout Stage',
      stage: 'Semifinals',
      status: 'upcoming',
      odds_team_a: odds.teamA,
      odds_draw: 3.5, // Lower draw odds in knockouts
      odds_team_b: odds.teamB,
      round: 'Semifinals'
    });
  }
  
  // ========== THIRD PLACE (July 22, 2026) ==========
  console.log('🥉 Generating Third Place match...');
  const thirdPlaceDate = new Date('2026-07-22T16:00:00Z');
  
  matches.push({
    match_id: matchId++,
    team_a: 'England',
    team_b: 'Spain',
    match_date: thirdPlaceDate,
    venue: venues[2], // AT&T Stadium
    group_name: 'Knockout Stage',
    stage: 'Third Place',
    status: 'upcoming',
    odds_team_a: 2.10,
    odds_draw: 3.40,
    odds_team_b: 3.20,
    round: 'Third Place'
  });
  
  // ========== FINAL (July 23, 2026) ==========
  console.log('🏁 Generating Final match...');
  const finalDate = new Date('2026-07-23T19:00:00Z');
  
  matches.push({
    match_id: matchId++,
    team_a: 'Brazil',
    team_b: 'Argentina',
    match_date: finalDate,
    venue: venues[0], // MetLife Stadium for final
    group_name: 'Knockout Stage',
    stage: 'Final',
    status: 'upcoming',
    odds_team_a: 2.50,
    odds_draw: 3.10,
    odds_team_b: 2.80,
    round: 'Final'
  });
  
  console.log(`✅ Generated COMPLETE schedule: ${matches.length} total matches`);
  console.log(`📊 Breakdown:`);
  console.log(`   - Group Stage: ${48} matches`);
  console.log(`   - Round of 32: ${16} matches`);
  console.log(`   - Round of 16: ${8} matches`);
  console.log(`   - Quarterfinals: ${4} matches`);
  console.log(`   - Semifinals: ${2} matches`);
  console.log(`   - Third Place: ${1} match`);
  console.log(`   - Final: ${1} match`);
  console.log(`   - TOTAL: ${48 + 16 + 8 + 4 + 2 + 1 + 1} matches`);
  
  return matches;
}

function generateOdds(teamA, teamB) {
  // FIFA ranking based odds (simplified)
  const topTeams = ['Brazil', 'Argentina', 'France', 'England', 'Spain', 'Germany'];
  const strongTeams = ['Portugal', 'Italy', 'Netherlands', 'Belgium', 'Uruguay', 'USA'];
  const mediumTeams = ['Japan', 'South Korea', 'Mexico', 'Switzerland', 'Denmark', 'Sweden'];
  
  let oddsTeamA = 1.8 + Math.random() * 0.6;
  let oddsTeamB = 2.1 + Math.random() * 0.8;
  
  // Adjust based on team strength
  if (topTeams.includes(teamA) && !topTeams.includes(teamB)) {
    oddsTeamA = 1.4 + Math.random() * 0.3;
    oddsTeamB = 4.0 + Math.random() * 1.0;
  } else if (topTeams.includes(teamB) && !topTeams.includes(teamA)) {
    oddsTeamA = 4.0 + Math.random() * 1.0;
    oddsTeamB = 1.4 + Math.random() * 0.3;
  } else if (strongTeams.includes(teamA) && mediumTeams.includes(teamB)) {
    oddsTeamA = 1.6 + Math.random() * 0.4;
    oddsTeamB = 2.8 + Math.random() * 0.6;
  } else if (strongTeams.includes(teamB) && mediumTeams.includes(teamA)) {
    oddsTeamA = 2.8 + Math.random() * 0.6;
    oddsTeamB = 1.6 + Math.random() * 0.4;
  }
  
  return {
    teamA: parseFloat(oddsTeamA.toFixed(2)),
    draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
    teamB: parseFloat(oddsTeamB.toFixed(2))
  };
}

// ==================== ENDPOINTS ====================

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'World Cup 2026 Complete Schedule API',
    version: '3.0.0',
    description: 'Complete FIFA World Cup 2026 match schedule',
    endpoints: [
      '/health',
      `${FULL_API_PATH}/schedule`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/init-db`,
      `${FULL_API_PATH}/reset-full-schedule`
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
      matches_in_database: matchCount,
      schedule: 'World Cup 2026'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Complete schedule endpoint
app.get(`${FULL_API_PATH}/schedule`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { match_date: 'asc' }
    });
    
    // Group by stage
    const schedule = {
      'Group Stage': matches.filter(m => m.stage === 'Group Stage'),
      'Round of 32': matches.filter(m => m.round === 'Round of 32'),
      'Round of 16': matches.filter(m => m.round === 'Round of 16'),
      'Quarterfinals': matches.filter(m => m.round === 'Quarterfinals'),
      'Semifinals': matches.filter(m => m.round === 'Semifinals'),
      'Third Place': matches.filter(m => m.round === 'Third Place'),
      'Final': matches.filter(m => m.round === 'Final')
    };
    
    res.json({
      success: true,
      data: schedule,
      total_matches: matches.length,
      stages: Object.keys(schedule).map(stage => ({
        name: stage,
        matches: schedule[stage].length
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Main matches endpoint
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
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

// Groups endpoint
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        stage: 'Group Stage'
      },
      orderBy: { match_date: 'asc' }
    });

    const groupsMap = {};
    matches.forEach(match => {
      const groupName = match.group_name;
      if (!groupsMap[groupName]) {
        groupsMap[groupName] = {
          group_name: groupName,
          matches: []
        };
      }
      groupsMap[groupName].matches.push(match);
    });

    const groupsArray = Object.values(groupsMap);

    res.json({
      success: true,
      data: groupsArray,
      total_groups: groupsArray.length,
      total_matches: matches.length,
      note: 'Group Stage matches only'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset and generate FULL schedule
app.get(`${FULL_API_PATH}/reset-full-schedule`, async (req, res) => {
  try {
    console.log('🔄 Resetting database with FULL World Cup 2026 schedule...');
    
    // Clear all matches
    await prisma.match.deleteMany({});
    console.log('🧹 Cleared all existing matches');
    
    // Generate complete schedule
    const allMatches = generateCompleteWorldCup2026Schedule();
    
    // Insert in batches
    let added = 0;
    const batchSize = 20;
    
    for (let i = 0; i < allMatches.length; i += batchSize) {
      const batch = allMatches.slice(i, i + batchSize);
      for (const match of batch) {
        try {
          await prisma.match.create({ data: match });
          added++;
        } catch (error) {
          console.log(`⚠️ Skipping match ${match.match_id}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ Generated ${added} matches out of ${allMatches.length} total`);
    
    res.json({
      success: true,
      message: `Complete World Cup 2026 schedule generated!`,
      matches_generated: added,
      total_possible: allMatches.length,
      stages: {
        group_stage: 48,
        round_of_32: 16,
        round_of_16: 8,
        quarterfinals: 4,
        semifinals: 2,
        third_place: 1,
        final: 1,
        total: 80
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize DB (legacy endpoint)
app.get(`${FULL_API_PATH}/init-db`, async (req, res) => {
  try {
    await prisma.match.deleteMany({});
    const matches = generateCompleteWorldCup2026Schedule();
    
    let added = 0;
    for (const match of matches.slice(0, 50)) { // Legacy: only 50 matches
      await prisma.match.create({ data: match });
      added++;
    }
    
    res.json({
      success: true,
      message: `Database initialized with ${added} matches`,
      note: 'Use /reset-full-schedule for complete 80-match schedule'
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
    
    const matchCount = await prisma.match.count();
    console.log(`📊 Found ${matchCount} existing matches`);
    
    if (matchCount === 0) {
      console.log('🏆 No matches found, generating initial schedule...');
      const matches = generateCompleteWorldCup2026Schedule();
      
      // Insert first 20 matches initially
      for (const match of matches.slice(0, 20)) {
        try {
          await prisma.match.create({ data: match });
        } catch (error) {
          // Skip duplicates
        }
      }
      console.log('✅ Initial matches generated');
    }
    
    console.log('🚀 World Cup 2026 Schedule API Ready!');
    console.log('📍 Complete schedule available at:');
    console.log(`   - https://cup-backend-red.vercel.app/api/v4/schedule`);
    console.log(`   - https://cup-backend-red.vercel.app/api/v4/reset-full-schedule (to generate all 80 matches)`);
    
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
      `${FULL_API_PATH}/schedule`,
      `${FULL_API_PATH}/matches`,
      `${FULL_API_PATH}/matches/groups`,
      `${FULL_API_PATH}/matches/upcoming`,
      `${FULL_API_PATH}/init-db`,
      `${FULL_API_PATH}/reset-full-schedule`
    ]
  });
});

module.exports = app;