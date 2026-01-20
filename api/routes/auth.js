// src/routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../../api/controllers/authController');
const AuthMiddleware = require('../middleware/auth');

// Wallet login/signup - use walletLogin method
router.post('/login', AuthController.walletLogin);

// Alternative wallet connection endpoint
router.post('/connect', AuthController.connectWallet);

// Get user profile
router.get('/me', AuthMiddleware.verifyToken, AuthController.getProfile);

// Update user profile
router.put('/profile', AuthMiddleware.verifyToken, AuthController.updateProfile);

// Get user stats
router.get('/stats', AuthMiddleware.verifyToken, AuthController.getUserStats);

// Get user activity
router.get('/activity', AuthMiddleware.verifyToken, AuthController.getUserActivity);

// Search users (public)
router.get('/search', AuthController.searchUsers);

// Get top users (public)
router.get('/top', AuthController.getTopUsers);

// Logout (client-side token invalidation)
router.post('/logout', AuthMiddleware.verifyToken, (req, res) => {
  logger.info(`User logged out: ${req.user.walletAddress}`);
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;