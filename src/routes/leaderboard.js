// src/routes/leaderboard.js
const express = require('express');
const router = express.Router();
const LeaderboardController = require('../controllers/leaderboardController');
const AuthMiddleware = require('../middleware/auth');

// Public routes
router.get('/', 
  LeaderboardController.getRankings
);

router.get('/top/winners', 
  LeaderboardController.getTopWinners
);

router.get('/top/win-rate', 
  LeaderboardController.getTopWinRate
);

router.get('/top/volume', 
  LeaderboardController.getTopVolume
);

router.get('/weekly', 
  LeaderboardController.getWeeklyLeaderboard
);

router.get('/monthly', 
  LeaderboardController.getMonthlyLeaderboard
);

router.get('/global-stats', 
  LeaderboardController.getGlobalStats
);

// User routes (require authentication)
router.get('/my/rank', 
  AuthMiddleware.verifyToken,
  LeaderboardController.getUserRank
);

router.get('/my/streak', 
  AuthMiddleware.verifyToken,
  LeaderboardController.getUserStreak
);

// Admin routes
router.post('/update-ranks', 
  AuthMiddleware.verifyAdmin,
  LeaderboardController.updateAllRanks
);

// ⚠️ THIS LINE IS CRITICAL - MUST BE router NOT {router} ⚠️
module.exports = router;