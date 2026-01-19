// api/index.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for API
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://your-frontend.vercel.app'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// Import your routes
const authRoutes = require('../src/routes/auth');
const matchRoutes = require('../src/routes/matches');
const betRoutes = require('../src/routes/bets');
const leaderboardRoutes = require('../src/routes/leaderboard');

// Use routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/bets', betRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const prisma = require('../src/config/database');
    const dbHealth = await prisma.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'clutch-backend',
      database: dbHealth.status
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CLUTCH Betting Platform API',
    version: 'v1',
    status: 'running',
    docs: '/api-docs'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Export for Vercel
module.exports = app;