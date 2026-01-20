// api/index.js - FIXED CORS ISSUE
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

// ==================== FIXED CORS CONFIGURATION ====================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://world-lpdco43xk-hitmanwikis-projects.vercel.app',
  'https://world-rust-pi.vercel.app',
  'https://world-rust-pi.vercel.app/', // Try with trailing slash
  '*.vercel.app' // Allow all Vercel subdomains
];

// Configure CORS with proper options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list OR is a Vercel subdomain
    if (allowedOrigins.includes(origin) || 
        origin.endsWith('.vercel.app') ||
        allowedOrigins.some(allowed => allowed.includes(origin))) {
      return callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Other middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
  
  // Add CORS headers to every response
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
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
        
        matches.push({
          match_id: matchId++,
          team_a: teams[i],
          team_b: teams[j],
          match_date: matchDate,
          venue: venues[Math.floor(Math.random() * venues.length)],
          group_name: groupName,
          status: 'upcoming',
          odds_team_a: parseFloat((1.8 + Math.random() * 0.6).toFixed(2)),
          odds_draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
          odds_team_b: parseFloat((2.1 + Math.random() * 0.8).toFixed(2))
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
    version: '2.0.0',
    cors: 'enabled',
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

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    headers: req.headers,
    timestamp: new Date().toISOString()
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
      cors: {
        enabled: true,
        allowed_origins: allowedOrigins,
        current_origin: req.headers.origin
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Test API endpoints
app.get(`${FULL_API_PATH}/test-endpoints`, (req, res) => {
  res.json({
    success: true,
    subscription_level: {
      has_match_data_access: false,
      recommendation: 'Using generated World Cup 2026 data'
    },
    cors: {
      origin: req.headers.origin,
      allowed: true
    }
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
      cors: {
        origin: req.headers.origin,
        allowed: true
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
      orderBy: { match_date: 'asc' }
    });

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

    const groupsArray = Object.values(groupsMap);

    res.json({
      success: true,
      data: groupsArray,
      total_groups: groupsArray.length,
      total_matches: matches.length,
      cors: {
        origin: req.headers.origin,
        allowed: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize database
app.get(`${FULL_API_PATH}/init-db`, async (req, res) => {
  try {
    console.log('🧹 Clearing existing matches...');
    await prisma.match.deleteMany({});
    
    console.log('🎯 Generating new matches...');
    const matches = generateWorldCup2026Matches();
    
    let added = 0;
    for (const match of matches) {
      await prisma.match.create({ data: match });
      added++;
    }
    
    res.json({
      success: true,
      message: `Database initialized with ${added} World Cup 2026 matches`,
      matches_added: added,
      cors: {
        origin: req.headers.origin,
        allowed: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync endpoint
app.get(`${FULL_API_PATH}/sync-now`, async (req, res) => {
  try {
    await prisma.match.deleteMany({});
    const matches = generateWorldCup2026Matches();
    
    let added = 0;
    for (const match of matches) {
      await prisma.match.create({ data: match });
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
    
    const matchCount = await prisma.match.count();
    console.log(`📊 Found ${matchCount} existing matches`);
    
    if (matchCount === 0) {
      console.log('🎯 Generating initial match data...');
      const matches = generateWorldCup2026Matches();
      
      for (const match of matches.slice(0, 20)) {
        try {
          await prisma.match.create({ data: match });
        } catch (error) {
          // Ignore duplicates
        }
      }
      console.log('✅ Initial matches generated');
    }
    
    console.log('🚀 API is ready!');
    console.log('🌐 CORS configured for:');
    allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
}

// Start initialization
initializeApp();

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS Error: Origin not allowed',
      requested_origin: req.headers.origin,
      allowed_origins: allowedOrigins
    });
  }
  
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
    requested_url: req.originalUrl,
    available_routes: [
      '/',
      '/health',
      '/cors-test',
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