// src/utils/validators.js
const { constants } = require('../config/constants');
const web3Service = require('../services/web3Service');

class Validators {
  // Validate wallet address
  static validateWalletAddress(address) {
    if (!address) return false;
    
    // Check if it's a valid Ethereum address
    const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(address);
    
    // Additional checks can be added here
    // For example, checksum validation
    try {
      return isValidFormat && web3Service.web3.isAddress(address);
    } catch {
      return isValidFormat;
    }
  }

  // Validate amount for betting
  static validateBetAmount(amount) {
    const minAmount = constants.BETTING_LIMITS.MIN_AMOUNT;
    const maxAmount = constants.BETTING_LIMITS.MAX_AMOUNT;
    
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { isValid: false, error: 'Amount must be a number' };
    }
    
    if (amount < minAmount) {
      return { 
        isValid: false, 
        error: `Minimum bet amount is ${minAmount} CLUTCH` 
      };
    }
    
    if (amount > maxAmount) {
      return { 
        isValid: false, 
        error: `Maximum bet amount is ${maxAmount} CLUTCH` 
      };
    }
    
    return { isValid: true };
  }

  // Validate odds
  static validateOdds(odds) {
    const minOdds = constants.BETTING_LIMITS.MIN_ODDS;
    const maxOdds = constants.BETTING_LIMITS.MAX_ODDS;
    
    if (typeof odds !== 'number' || isNaN(odds)) {
      return { isValid: false, error: 'Odds must be a number' };
    }
    
    if (odds < minOdds) {
      return { 
        isValid: false, 
        error: `Minimum odds are ${minOdds}` 
      };
    }
    
    if (odds > maxOdds) {
      return { 
        isValid: false, 
        error: `Maximum odds are ${maxOdds}` 
      };
    }
    
    return { isValid: true };
  }

  // Validate match outcome
  static validateOutcome(outcome) {
    const validOutcomes = Object.values(constants.OUTCOMES);
    
    if (!validOutcomes.includes(parseInt(outcome))) {
      return { 
        isValid: false, 
        error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  // Validate match status
  static validateMatchStatus(status) {
    const validStatuses = Object.values(constants.MATCH_STATUS);
    
    if (!validStatuses.includes(status)) {
      return { 
        isValid: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  // Validate bet status
  static validateBetStatus(status) {
    const validStatuses = Object.values(constants.BET_STATUS);
    
    if (!validStatuses.includes(status)) {
      return { 
        isValid: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  // Validate email format
  static validateEmail(email) {
    if (!email) return { isValid: true }; // Email is optional
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    
    return { isValid: true };
  }

  // Validate username
  static validateUsername(username) {
    if (!username) return { isValid: true }; // Username is optional
    
    if (username.length < 3) {
      return { isValid: false, error: 'Username must be at least 3 characters' };
    }
    
    if (username.length > 50) {
      return { isValid: false, error: 'Username must be less than 50 characters' };
    }
    
    // Alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    
    if (!usernameRegex.test(username)) {
      return { 
        isValid: false, 
        error: 'Username can only contain letters, numbers, and underscores' 
      };
    }
    
    return { isValid: true };
  }

  // Validate date is in the future
  static validateFutureDate(date) {
    const inputDate = new Date(date);
    const now = new Date();
    
    if (isNaN(inputDate.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }
    
    if (inputDate <= now) {
      return { isValid: false, error: 'Date must be in the future' };
    }
    
    return { isValid: true };
  }

  // Validate pagination parameters
  static validatePagination(page, limit) {
    const maxLimit = constants.PAGINATION.MAX_LIMIT;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || constants.PAGINATION.DEFAULT_LIMIT;
    
    if (pageNum < 1) {
      return { 
        isValid: false, 
        error: 'Page must be greater than 0' 
      };
    }
    
    if (limitNum < 1) {
      return { 
        isValid: false, 
        error: 'Limit must be greater than 0' 
      };
    }
    
    if (limitNum > maxLimit) {
      return { 
        isValid: false, 
        error: `Limit cannot exceed ${maxLimit}` 
      };
    }
    
    return { 
      isValid: true, 
      page: pageNum, 
      limit: limitNum 
    };
  }

  // Validate sort parameters
  static validateSort(sortBy, sortOrder, validSortColumns) {
    const normalizedSortBy = sortBy || 'created_at';
    const normalizedSortOrder = (sortOrder || 'desc').toLowerCase();
    
    if (!validSortColumns.includes(normalizedSortBy)) {
      return { 
        isValid: false, 
        error: `Invalid sort column. Must be one of: ${validSortColumns.join(', ')}` 
      };
    }
    
    if (!['asc', 'desc'].includes(normalizedSortOrder)) {
      return { 
        isValid: false, 
        error: 'Invalid sort order. Must be "asc" or "desc"' 
      };
    }
    
    return { 
      isValid: true, 
      sortBy: normalizedSortBy, 
      sortOrder: normalizedSortOrder 
    };
  }

  // Validate transaction hash
  static validateTxHash(txHash) {
    if (!txHash) return { isValid: false, error: 'Transaction hash is required' };
    
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    
    if (!txHashRegex.test(txHash)) {
      return { isValid: false, error: 'Invalid transaction hash format' };
    }
    
    return { isValid: true };
  }

  // Validate team names
  static validateTeamNames(teamA, teamB) {
    if (!teamA || !teamB) {
      return { isValid: false, error: 'Both team names are required' };
    }
    
    if (teamA.length < 2 || teamB.length < 2) {
      return { isValid: false, error: 'Team names must be at least 2 characters' };
    }
    
    if (teamA.length > 100 || teamB.length > 100) {
      return { isValid: false, error: 'Team names must be less than 100 characters' };
    }
    
    return { isValid: true };
  }

  // Validate group name
  static validateGroupName(groupName) {
    if (!groupName) return { isValid: true }; // Group name is optional
    
    if (groupName.length > 10) {
      return { isValid: false, error: 'Group name must be less than 10 characters' };
    }
    
    // Allow letters, numbers, and spaces
    const groupNameRegex = /^[a-zA-Z0-9\s]+$/;
    
    if (!groupNameRegex.test(groupName)) {
      return { 
        isValid: false, 
        error: 'Group name can only contain letters, numbers, and spaces' 
      };
    }
    
    return { isValid: true };
  }

  // Validate venue
  static validateVenue(venue) {
    if (!venue) return { isValid: true }; // Venue is optional
    
    if (venue.length > 200) {
      return { isValid: false, error: 'Venue must be less than 200 characters' };
    }
    
    return { isValid: true };
  }

  // Validate password (if implementing traditional auth)
  static validatePassword(password) {
    if (!password) {
      return { isValid: false, error: 'Password is required' };
    }
    
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters' };
    }
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one uppercase letter' 
      };
    }
    
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one lowercase letter' 
      };
    }
    
    // Check for at least one number
    if (!/\d/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one number' 
      };
    }
    
    return { isValid: true };
  }

  // Validate API key
  static validateApiKey(apiKey) {
    if (!apiKey) {
      return { isValid: false, error: 'API key is required' };
    }
    
    // Basic validation - adjust as needed
    if (apiKey.length !== 32) {
      return { isValid: false, error: 'Invalid API key format' };
    }
    
    return { isValid: true };
  }
}

module.exports = Validators;