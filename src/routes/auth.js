// src/routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const AuthMiddleware = require('../middleware/auth');

// Public routes
router.post('/connect', 
  AuthMiddleware.verifyWallet, 
  AuthController.connectWallet
);

router.get('/health', 
  AuthController.healthCheck
);

router.get('/users/search', 
  AuthController.searchUsers
);

router.get('/users/top', 
  AuthController.getTopUsers
);

// Protected routes (require authentication)
router.get('/profile', 
  AuthMiddleware.verifyToken, 
  AuthController.getProfile
);

router.put('/profile', 
  AuthMiddleware.verifyToken, 
  AuthController.updateProfile
);

router.get('/stats', 
  AuthMiddleware.verifyToken, 
  AuthController.getUserStats
);

router.get('/activity', 
  AuthMiddleware.verifyToken, 
  AuthController.getUserActivity
);

module.exports = router;