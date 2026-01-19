// src/config/constants.js - UPDATED FOR NEON POSTGRESQL
require('dotenv').config();

const constants = {
  // Platform fees (in percentage)
  FEES: {
    PLATFORM: parseInt(process.env.PLATFORM_FEE_PERCENTAGE) || 2,
    ORACLE: parseInt(process.env.ORACLE_FEE_PERCENTAGE) || 1,
    WINNERS: parseInt(process.env.WINNERS_PERCENTAGE) || 97
  },

  // Betting limits
  BETTING_LIMITS: {
    MIN_AMOUNT: parseFloat(process.env.MIN_BET_AMOUNT) || 1,
    MAX_AMOUNT: parseFloat(process.env.MAX_BET_AMOUNT) || 10000,
    MAX_ODDS: parseFloat(process.env.MAX_ODDS) || 100,
    MIN_ODDS: parseFloat(process.env.MIN_ODDS) || 1.01
  },

  // Match status
  MATCH_STATUS: {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    FINISHED: 'finished',
    CANCELLED: 'cancelled'
  },

  // Bet status
  BET_STATUS: {
    PENDING: 'pending',
    WON: 'won',
    LOST: 'lost',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled'
  },

  // Bet outcomes
  OUTCOMES: {
    TEAM_A_WIN: 0,
    DRAW: 1,
    TEAM_B_WIN: 2
  },

  // Verification
  VERIFICATION: {
    REQUIRED_CONFIRMATIONS: parseInt(process.env.REQUIRED_CONFIRMATIONS) || 2,
    DISPUTE_PERIOD_DAYS: parseInt(process.env.DISPUTE_PERIOD_DAYS) || 7,
    CLAIM_WINDOW_DAYS: parseInt(process.env.CLAIM_WINDOW_DAYS) || 30
  },

  // Time constants (in milliseconds)
  TIME: {
    ONE_MINUTE: 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
    ONE_WEEK: 7 * 24 * 60 * 60 * 1000
  },

  // Cache TTL (in seconds)
  CACHE_TTL: {
    MATCHES: 60, // 1 minute
    LEADERBOARD: 300, // 5 minutes
    ODDS: 30, // 30 seconds
    STATS: 120 // 2 minutes
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // API endpoints for external data
  EXTERNAL_APIS: {
    SPORTS_DATA: process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores',
    FIFA_API: process.env.FIFA_API_URL || 'https://api.fifa.com/api/v3',
    BACKUP_SOURCES: ['ESPN', 'BBC', 'Reuters', 'Official FIFA Feed']
  },

  // Network configurations
  NETWORKS: {
    BASE: {
      chainId: 8453,
      name: 'base',
      rpcUrl: process.env.RPC_URL_BASE,
      explorer: 'https://basescan.org'
    },
    MAINNET: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: process.env.RPC_URL_MAINNET,
      explorer: 'https://etherscan.io'
    }
  },

  // Contract ABI paths
  CONTRACT_PATHS: {
    ABI: './contracts/artifacts/ClutchBetting.json'
  },

  // Security
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
    PASSWORD_MIN_LENGTH: 8,
    API_KEY_LENGTH: 32
  },

  // Notification types
  NOTIFICATION_TYPES: {
    BET_PLACED: 'bet_placed',
    BET_WON: 'bet_won',
    BET_LOST: 'bet_lost',
    MATCH_STARTED: 'match_started',
    MATCH_RESULT: 'match_result',
    WITHDRAWAL: 'withdrawal',
    DEPOSIT: 'deposit'
  }
};

// Validate environment variables for Vercel deployment
const validateConfig = () => {
  console.log('🔍 Validating configuration...');
  
  // Check if we're on Vercel (using DATABASE_URL) or local (using separate DB vars)
  const isVercel = !!process.env.VERCEL;
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasSeparateDbVars = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;
  
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Is Vercel: ${isVercel}`);
  console.log(`Has DATABASE_URL: ${hasDatabaseUrl}`);
  console.log(`Has separate DB vars: ${hasSeparateDbVars}`);
  
  // Always require JWT_SECRET
  const requiredEnvVars = ['JWT_SECRET'];
  
  // For Vercel/Neon PostgreSQL, require DATABASE_URL
  if (isVercel || hasDatabaseUrl) {
    requiredEnvVars.push('DATABASE_URL');
    console.log('✅ Using DATABASE_URL connection string');
  } 
  // For local development with separate DB variables
  else if (process.env.NODE_ENV === 'production') {
    requiredEnvVars.push('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
    console.log('✅ Using separate database variables');
  }
  // For local development, we can be more lenient
  else {
    console.log('⚠️ Development mode - using defaults for missing variables');
  }
  
  // Check required variables
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file');
    
    // For production, exit; for development, warn but continue
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️ Continuing in development mode with missing variables...');
    }
  }
  
  // Validate blockchain variables if configured
  if (process.env.RPC_URL_BASE) {
    console.log('✅ Blockchain RPC URL configured');
  } else {
    console.warn('⚠️ Blockchain RPC URL not configured - running in read-only mode');
  }
  
  // Validate sports data API if configured
  if (process.env.SPORTS_DATA_API_KEY) {
    console.log('✅ Sports data API key configured');
  } else {
    console.warn('⚠️ Sports data API key not configured - using generated data');
  }
  
  // Validate fee percentages
  const platformFee = parseInt(constants.FEES.PLATFORM);
  const oracleFee = parseInt(constants.FEES.ORACLE);
  const winnersFee = parseInt(constants.FEES.WINNERS);
  const totalFees = platformFee + oracleFee + winnersFee;
  
  console.log(`📊 Fee breakdown: Platform=${platformFee}%, Oracle=${oracleFee}%, Winners=${winnersFee}%, Total=${totalFees}%`);
  
  if (totalFees !== 100) {
    console.error(`❌ Fee percentages must sum to 100%. Current sum: ${totalFees}%`);
    console.error(`Check your .env file: PLATFORM_FEE_PERCENTAGE, ORACLE_FEE_PERCENTAGE, WINNERS_PERCENTAGE`);
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️ Continuing with invalid fee percentages in development...');
    }
  }
  
  console.log('✅ Configuration validated successfully');
};

module.exports = {
  constants,
  validateConfig
};