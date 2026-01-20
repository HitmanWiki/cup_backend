// api/index.js - ONE-CLICK FULL SCHEDULE
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// ==================== FULL WORLD CUP 2026 SCHEDULE ====================
function generateFullWorldCupSchedule() {
  console.log('🏆 Generating FULL World Cup 2026 schedule...');
  
  // Official 2026 groups (48 teams, 16 groups of 3)
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
  const startDate = new Date('2026-06-11T16:00:00Z');
  
  // Generate ALL group stage matches (3 matches per group × 16 groups = 48 matches)
  Object.entries(groups).forEach(([groupName, teams], groupIndex) => {
    // Each group of 3 teams: A vs B, A vs C, B vs C
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchDate = new Date(startDate);
        // Spread matches over 15 days (June 11-25)
        const dayOffset = Math.floor(matches.length / 3);
        const timeSlot = matches.length % 3;
        
        matchDate.setDate(startDate.getDate() + dayOffset);
        matchDate.setHours(16 + (timeSlot * 4)); // 16:00, 20:00, 00:00 UTC
        matchDate.setMinutes(0);
        
        matches.push({
          match_id: matchId++,
          team_a: teams[i],
          team_b: teams[j],
          match_date: matchDate,
          venue: venues[groupIndex % venues.length],
          group_name: groupName,
          status: 'scheduled',
          odds_team_a: parseFloat((1.5 + Math.random() * 1.0).toFixed(2)),
          odds_draw: parseFloat((3.0 + Math.random() * 1.0).toFixed(2)),
          odds_team_b: parseFloat((2.0 + Math.random() * 1.0).toFixed(2)),
          total_staked: 0,
          archived: 0
        });
      }
    }
  });
  
  console.log(`✅ Generated ${matches.length} group stage matches`);
  return matches;
}

// ==================== ENDPOINTS ====================

// Get ALL matches with pagination
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
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
      has_more: total > (skip + limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get groups for frontend
app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: { group_name: { not: null } },
      orderBy: { match_date: 'asc' }
    });

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

    const groupsArray = Object.values(groups);
    groupsArray.sort((a, b) => a.group_name.localeCompare(b.group_name));

    res.json({
      success: true,
      data: groupsArray,
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

// ========== ONE-CLICK SOLUTION TO GET ALL MATCHES ==========

// Endpoint to generate ALL 48 World Cup matches
app.get(`${FULL_API_PATH}/generate-full-schedule`, async (req, res) => {
  try {
    console.log('🚀 Generating FULL World Cup 2026 schedule...');
    
    // Clear existing matches
    await prisma.match.deleteMany({});
    console.log('🧹 Cleared existing matches');
    
    // Generate all 48 matches
    const allMatches = generateFullWorldCupSchedule();
    
    // Insert all matches
    let added = 0;
    for (const match of allMatches) {
      try {
        await prisma.match.create({ data: match });
        added++;
      } catch (error) {
        console.log(`⚠️ Skipping match ${match.match_id}: ${error.message}`);
      }
    }
    
    // Verify
    const finalCount = await prisma.match.count();
    const groupCount = await prisma.match.groupBy({
      by: ['group_name'],
      _count: true
    });
    
    res.json({
      success: true,
      message: `🎉 FULL World Cup 2026 schedule generated!`,
      stats: {
        matches_generated: added,
        total_in_database: finalCount,
        groups_created: groupCount.length,
        expected: '48 matches across 16 groups'
      },
      groups: groupCount.map(g => ({
        group: g.group_name,
        matches: g._count
      })),
      next_steps: [
        'Visit /api/v4/matches to see all matches',
        'Visit /api/v4/matches/groups to see grouped matches',
        'Your frontend will now show ALL World Cup matches!'
      ]
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Quick endpoint to add more matches
app.get(`${FULL_API_PATH}/add-more-matches`, async (req, res) => {
  try {
    const currentCount = await prisma.match.count();
    
    if (currentCount >= 48) {
      return res.json({
        success: true,
        message: 'Already have 48+ matches. Use /generate-full-schedule to regenerate.'
      });
    }
    
    // Generate additional matches
    const newMatches = generateFullWorldCupSchedule().slice(currentCount, 48);
    
    let added = 0;
    for (const match of newMatches) {
      try {
        await prisma.match.create({ data: match });
        added++;
      } catch (error) {
        // Skip duplicates
      }
    }
    
    const newTotal = await prisma.match.count();
    
    res.json({
      success: true,
      message: `Added ${added} more matches. Total: ${newTotal}`,
      added: added,
      total: newTotal,
      needed: 48 - newTotal
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dashboard endpoint
app.get(`${FULL_API_PATH}/dashboard`, async (req, res) => {
  try {
    const totalMatches = await prisma.match.count();
    const groups = await prisma.match.groupBy({
      by: ['group_name'],
      _count: true,
      where: { group_name: { not: null } }
    });
    
    const upcoming = await prisma.match.count({
      where: {
        match_date: { gt: new Date() },
        status: 'scheduled'
      }
    });
    
    res.json({
      success: true,
      dashboard: {
        total_matches: totalMatches,
        total_groups: groups.length,
        upcoming_matches: upcoming,
        groups: groups.map(g => ({
          name: g.group_name,
          match_count: g._count
        })),
        completion: `${Math.round((totalMatches / 48) * 100)}% of World Cup schedule`
      },
      actions: {
        get_all_matches: `${FULL_API_PATH}/generate-full-schedule`,
        view_matches: `${FULL_API_PATH}/matches`,
        view_groups: `${FULL_API_PATH}/matches/groups`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const matchCount = await prisma.match.count();
    
    res.json({
      status: 'healthy',
      matches: matchCount,
      world_cup_2026: 'ready',
      action: `Visit ${FULL_API_PATH}/generate-full-schedule for all matches`
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Initialize
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    const matchCount = await prisma.match.count();
    console.log(`📊 Current matches: ${matchCount}`);
    
    if (matchCount < 48) {
      console.log(`⚠️ Only ${matchCount}/48 matches. Run: ${FULL_API_PATH}/generate-full-schedule`);
    }
    
    console.log('🚀 World Cup 2026 API Ready!');
    console.log('📍 ONE-CLICK SOLUTION:');
    console.log(`   ${FULL_API_PATH}/generate-full-schedule`);
    
  } catch (error) {
    console.error('❌ Startup error:', error);
  }
}

start();

// Export
module.exports = app;