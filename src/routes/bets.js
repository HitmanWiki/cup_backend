// src/routes/bets.js
const express = require('express');
const router = express.Router();
const BetController = require('../controllers/betController');
const AuthMiddleware = require('../middleware/auth');

// Public routes
router.get('/recent', 
  BetController.getRecentBets
);

router.get('/largest', 
  BetController.getLargestBets
);

// ADD THIS ROUTE - Your frontend is calling this
router.get('/user/:userAddress',
  BetController.getUserBetsByAddress  // No auth required (or optional)
);

// User routes (require authentication)
router.post('/', 
  AuthMiddleware.verifyToken,
  BetController.placeBet
);

router.get('/my', 
  AuthMiddleware.verifyToken,
  BetController.getUserBets
);

router.get('/my/active', 
  AuthMiddleware.verifyToken,
  BetController.getUserActiveBets
);

router.get('/my/winning', 
  AuthMiddleware.verifyToken,
  BetController.getUserWinningBets
);

router.get('/my/stats', 
  AuthMiddleware.verifyToken,
  BetController.getUserBetStats
);

router.get('/:betId', 
  AuthMiddleware.verifyToken,
  BetController.getBetById
);

router.post('/:betId/claim', 
  AuthMiddleware.verifyToken,
  BetController.claimBetWinnings
);

// Admin routes
router.get('/stats/total', 
  AuthMiddleware.verifyAdmin,
  BetController.getTotalBetStats
);

router.put('/:betId/cancel', 
  AuthMiddleware.verifyAdmin,
  BetController.cancelBet
);

router.delete('/:betId', 
  AuthMiddleware.verifyAdmin,
  BetController.deleteBet
);

module.exports = router;