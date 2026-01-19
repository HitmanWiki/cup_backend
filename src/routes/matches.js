// src/routes/matches.js
const express = require('express');
const router = express.Router();
const MatchController = require('../controllers/matchController');
const AuthMiddleware = require('../middleware/auth');

// Public routes
router.get('/', 
  MatchController.getMatches
);

router.get('/upcoming', 
  MatchController.getUpcomingMatches
);

router.get('/live', 
  MatchController.getLiveMatches
);
router.get('/groups', 
  MatchController.getGroups
);
router.get('/finished', 
  MatchController.getFinishedMatches
);

router.get('/popular', 
  MatchController.getPopularMatches
);

router.get('/group/:groupName', 
  MatchController.getMatchesByGroup
);

router.get('/:matchId', 
  MatchController.getMatchById
);

router.get('/:matchId/bets', 
  MatchController.getMatchBets
);

router.get('/:matchId/stats', 
  MatchController.getMatchStats
);

// Admin routes
router.post('/', 
  AuthMiddleware.verifyAdmin,
  MatchController.createMatch
);

router.put('/:matchId', 
  AuthMiddleware.verifyAdmin,
  MatchController.updateMatch
);

router.put('/:matchId/status', 
  AuthMiddleware.verifyAdmin,
  MatchController.updateMatchStatus
);

router.post('/:matchId/result', 
  AuthMiddleware.verifyAdmin,
  MatchController.setMatchResult
);

router.delete('/:matchId', 
  AuthMiddleware.verifyAdmin,
  MatchController.deleteMatch
);

module.exports = router;