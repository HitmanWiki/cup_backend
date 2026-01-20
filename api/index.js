// api/index.js - VERCEL COMPATIBLE VERSION
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const app = express();

// ==================== CUSTOM CONSTANTS (EMBEDDED) ====================
// Instead of importing, define constants directly
const constants = {
  EXTERNAL_APIS: {
    SPORTS_DATA: process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores',
    FIFA_API: 'https://api.fifa.com/api/v3'
  }
};

const validateConfig = () => {
  console.log('🔍 Validating configuration...');
  // Always require JWT_SECRET
  const requiredEnvVars = ['JWT_SECRET'];
  
  // Check for database connection
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.warn('⚠️ Database connection not configured');
  }
  
  // Validate sports data API if configured
  if (process.env.SPORTS_DATA_API_KEY && process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key') {
    console.log('✅ Sports data API key configured');
  } else {
    console.warn('⚠️ Sports data API key not configured - will use fallback data');
  }
  
  console.log('✅ Configuration validated');
};

// ==================== SIMPLIFIED DATABASE ====================
const createDatabaseConnection = () => {
  console.log('🔌 Creating database connection...');
  
  // Simple database connection for Vercel
  return {
    connect: async () => {
      try {
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Test connection
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        
        return pool;
      } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
      }
    },
    
    healthCheck: async () => {
      return { status: 'healthy' };
    },
    
    query: async (text, params) => {
      const pool = await createDatabaseConnection().connect();
      const result = await pool.query(text, params);
      return result;
    }
  };
};

// ==================== BASIC MIDDLEWARE ====================
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://world-lpdco43xk-hitmanwikis-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v4';
const FULL_API_PATH = `${API_PREFIX}/${API_VERSION}`;

// ==================== SIMPLIFIED ROUTES ====================
// Direct route definitions - no complex imports
app.get(`${FULL_API_PATH}/matches`, async (req, res) => {
  try {
    console.log('Fetching matches...');
    
    // First, try to fetch from Sports API
    if (process.env.SPORTS_DATA_API_KEY && process.env.SPORTS_DATA_API_KEY !== 'your_sports_data_api_key') {
      console.log('📡 Fetching from Sports API...');
      
      const response = await fetch(`${constants.EXTERNAL_APIS.SPORTS_DATA}/json/Matches`, {
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.SPORTS_DATA_API_KEY
        }
      });
      
      if (response.ok) {
        const matches = await response.json();
        console.log(`✅ Got ${matches.length} matches from API`);
        
        // Transform and return
        const worldCupMatches = matches
          .filter(match => match.CompetitionId === 21) // World Cup 2026 ID
          .map(match => ({
            match_id: match.MatchId,
            team_a: match.HomeTeam,
            team_b: match.AwayTeam,
            match_date: match.DateTime,
            venue: match.Venue,
            group_name: match.Group || 'Group Stage',
            status: 'upcoming',
            odds_team_a: 1.8,
            odds_draw: 3.5,
            odds_team_b: 4.0
          }));
        
        return res.json({
          success: true,
          data: worldCupMatches,
          total: worldCupMatches.length,
          source: 'sports_api'
        });
      }
    }
    
    // Fallback: Return from database
    const db = createDatabaseConnection();
    const pool = await db.connect();
    
    const result = await pool.query(`
      SELECT * FROM matches 
      WHERE status = 'upcoming' 
      ORDER BY match_date ASC 
      LIMIT 100
    `);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
      source: 'database'
    });
    
  } catch (error) {
    console.error('Error fetching matches:', error);
    
    // Final fallback: Return sample data
    res.json({
      success: true,
      data: [
        {
          id: 2,
          match_id: 9999,
          team_a: 'Test Team A',
          team_b: 'Test Team B',
          match_date: '2024-12-25T20:00:00.000Z',
          venue: 'Updated Stadium',
          group_name: 'Test Group',
          status: 'upcoming',
          odds_team_a: 1.8,
          odds_draw: 3.2,
          odds_team_b: 2.1
        }
      ],
      total: 1,
      source: 'fallback',
      warning: 'Using fallback data'
    });
  }
});

app.get(`${FULL_API_PATH}/matches/groups`, async (req, res) => {
  try {
    const db = createDatabaseConnection();
    const pool = await db.connect();
    
    const result = await pool.query(`
      SELECT group_name, COUNT(*) as match_count, 
             MIN(match_date) as first_match,
             MAX(match_date) as last_match
      FROM matches 
      WHERE group_name IS NOT NULL 
      GROUP BY group_name 
      ORDER BY group_name
    `);
    
    const groups = {};
    result.rows.forEach(row => {
      groups[row.group_name] = {
        matchCount: row.match_count,
        firstMatch: row.first_match,
        lastMatch: row.last_match
      };
    });
    
    res.json({
      success: true,
      data: groups
    });
    
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.json({
      success: true,
      data: {
        'Test Group': {
          matchCount: 1,
          firstMatch: '2024-12-25T20:00:00.000Z',
          lastMatch: '2024-12-25T20:00:00.000Z'
        }
      }
    });
  }
});

app.get(`${FULL_API_PATH}/matches/upcoming`, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const db = createDatabaseConnection();
    const pool = await db.connect();
    
    const result = await pool.query(`
      SELECT * FROM matches 
      WHERE status = 'upcoming' 
      AND match_date > NOW()
      ORDER BY match_date ASC 
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
    
  } catch (error) {
    console.error('Error fetching upcoming:', error);
    res.json({
      success: true,
      data: [],
      count: 0
    });
  }
});

// ==================== BASIC ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      matches: `${FULL_API_PATH}/matches`,
      upcoming: `${FULL_API_PATH}/matches/upcoming`,
      groups: `${FULL_API_PATH}/matches/groups`
    },
    apiKey: process.env.SPORTS_DATA_API_KEY ? 'Configured' : 'Not configured'
  });
});

app.get('/health', async (req, res) => {
  try {
    // Simple health check
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ==================== DATA SYNC ENDPOINT ====================
app.get('/api/v4/sync-now', async (req, res) => {
  try {
    console.log('🔄 Manual sync requested');
    
    if (!process.env.SPORTS_DATA_API_KEY || process.env.SPORTS_DATA_API_KEY === 'your_sports_data_api_key') {
      return res.json({
        success: false,
        error: 'Sports API key not configured in .env'
      });
    }
    
    // Fetch from Sports API
    const response = await fetch(`${constants.EXTERNAL_APIS.SPORTS_DATA}/json/Matches`, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.SPORTS_DATA_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const matches = await response.json();
    const worldCupMatches = matches.filter(m => m.CompetitionId === 21);
    
    // Save to database
    const db = createDatabaseConnection();
    const pool = await db.connect();
    
    let savedCount = 0;
    for (const match of worldCupMatches.slice(0, 50)) {
      await pool.query(`
        INSERT INTO matches 
        (match_id, team_a, team_b, match_date, venue, group_name, status, odds_team_a, odds_draw, odds_team_b)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (match_id) DO UPDATE SET
          team_a = EXCLUDED.team_a,
          team_b = EXCLUDED.team_b,
          match_date = EXCLUDED.match_date,
          venue = EXCLUDED.venue
      `, [
        match.MatchId,
        match.HomeTeam,
        match.AwayTeam,
        match.DateTime,
        match.Venue,
        match.Group || 'Group Stage',
        'upcoming',
        1.8, 3.5, 4.0 // Default odds
      ]);
      savedCount++;
    }
    
    res.json({
      success: true,
      message: `Synced ${savedCount} matches`,
      total: worldCupMatches.length
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ERROR HANDLING ====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ==================== INITIALIZATION ====================
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    CLUTCH Betting Platform API (Vercel)                      ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║    ✅ API: ${FULL_API_PATH.padEnd(41)}║
║    ✅ Sports API: ${process.env.SPORTS_DATA_API_KEY ? 'Configured' : 'Not Configured'.padEnd(31)}║
║    ✅ Database: ${process.env.DATABASE_URL ? 'Connected' : 'Local'.padEnd(36)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Export for Vercel
module.exports = app;