// src/routes/admin.js
const express = require('express');
const router = express.Router();
const AdminController = require('../../api/controllers/adminController');
const AuthMiddleware = require('../middleware/auth');

// All admin routes require admin authentication
router.use(AuthMiddleware.verifyAdmin);

// Dashboard statistics
router.get('/dashboard', 
  AdminController.getDashboardStats
);

// User management
router.get('/users', 
  AdminController.getAllUsers
);

router.get('/users/:userId', 
  AdminController.getUserDetails
);

router.put('/users/:userId', 
  AdminController.updateUser
);

router.delete('/users/:userId', 
  AdminController.deleteUser
);

// Match management
router.get('/matches/pending', 
  AdminController.getPendingMatches
);

router.get('/matches/needs-result', 
  AdminController.getMatchesNeedingResult
);

// Bet management
router.get('/bets/pending', 
  AdminController.getPendingBets
);

router.get('/bets/large', 
  AdminController.getLargeBets
);

// Financial operations
router.get('/financial/overview', 
  AdminController.getFinancialOverview
);

router.get('/financial/transactions', 
  AdminController.getRecentTransactions
);

// System operations
router.get('/system/health', 
  AdminController.getSystemHealth
);

router.post('/system/sync-chain', 
  AdminController.syncWithBlockchain
);

router.post('/system/update-fees', 
  AdminController.updateFeeStructure
);

// Analytics
router.get('/analytics/users', 
  AdminController.getUserAnalytics
);

router.get('/analytics/bets', 
  AdminController.getBetAnalytics
);

router.get('/analytics/revenue', 
  AdminController.getRevenueAnalytics
);

// Reports
router.get('/reports/daily', 
  AdminController.getDailyReport
);

router.get('/reports/weekly', 
  AdminController.getWeeklyReport
);

router.get('/reports/monthly', 
  AdminController.getMonthlyReport
);

module.exports = router;