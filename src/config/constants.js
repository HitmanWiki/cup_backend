// src/config/constants.js - CORRECTED VERSION

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
    SPORTS_DATA: process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v3/soccer/scores/json',
    FIFA_API: process.env.FIFA_API_URL || 'https://api.fifa.com/api/v3',
    BACKUP_SOURCES: ['ESPN', 'BBC', 'Reuters', 'Official FIFA Feed']
  },

  // Network configurations
  NETWORKS: {
    SEPOLIA: {
      chainId: 11155111,
      name: 'Sepolia',
      rpcUrl: process.env.RPC_URL_SEPOLIA,
      explorer: 'https://sepolia.etherscan.io'
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

// Validate environment variables
const validateConfig = () => {
  // Only require these for PostgreSQL
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // For production with PostgreSQL
    const requiredEnvVars = [
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'JWT_SECRET',
      'RPC_URL_SEPOLIA',
      'PRIVATE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      console.error('Please check your .env file');
      process.exit(1);
    }
  } else {
    // For development with SQLite
    const requiredEnvVars = [
      'JWT_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
      console.warn('Using default values for development');
      // Don't exit, just use defaults for development
    }
  }

  // Validate fee percentages - FIXED PARSING
  const platformFee = parseInt(constants.FEES.PLATFORM);
  const oracleFee = parseInt(constants.FEES.ORACLE);
  const winnersFee = parseInt(constants.FEES.WINNERS);
  const totalFees = platformFee + oracleFee + winnersFee;
  
  console.log(`Fee breakdown: Platform=${platformFee}%, Oracle=${oracleFee}%, Winners=${winnersFee}%, Total=${totalFees}%`);
  
  if (totalFees !== 100) {
    console.error(`Fee percentages must sum to 100%. Current sum: ${totalFees}%`);
    console.error(`Check your .env file: PLATFORM_FEE_PERCENTAGE, ORACLE_FEE_PERCENTAGE, WINNERS_PERCENTAGE`);
    process.exit(1);
  }

  // Validate betting limits
  if (constants.BETTING_LIMITS.MIN_AMOUNT >= constants.BETTING_LIMITS.MAX_AMOUNT) {
    console.error('MIN_BET_AMOUNT must be less than MAX_BET_AMOUNT');
    process.exit(1);
  }

  if (constants.BETTING_LIMITS.MIN_ODDS >= constants.BETTING_LIMITS.MAX_ODDS) {
    console.error('MIN_ODDS must be less than MAX_ODDS');
    process.exit(1);
  }

  console.log('Configuration validated successfully');
};

module.exports = {
  constants,
  validateConfig
};