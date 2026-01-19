// src/services/web3Service.js
const web3Config = require('../config/web3');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');
const Match = require('../models/Match');
const Bet = require('../models/Bet');
const User = require('../models/User');

class Web3Service {
  constructor() {
    this.web3 = web3Config;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.isInitialized) {
        await this.web3.initialize();
        this.isInitialized = true;
        logger.info('Web3Service initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize Web3Service:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  convertToNumber(value) {
    if (typeof value === 'bigint') {
      return Number(value);
    } else if (value && typeof value === 'object') {
      // Web3.js v1.x BigNumber
      if (value.toNumber && typeof value.toNumber === 'function') {
        return value.toNumber();
      }
      // Ethers.js BigNumber
      else if (value._isBigNumber) {
        return value.toNumber();
      }
      // BN.js or similar
      else if (value.toNumber) {
        return value.toNumber();
      }
      // Object with toString
      else if (value.toString && typeof value.toString === 'function') {
        return parseInt(value.toString(), 10);
      }
      // Direct numeric property
      else if (typeof value === 'object') {
        // Try to find a numeric value in the object
        const strValue = String(value);
        const num = parseInt(strValue, 10);
        if (!isNaN(num)) {
          return num;
        }
      }
    } else if (typeof value === 'string') {
      return parseInt(value, 10);
    } else if (typeof value === 'number') {
      return value;
    }
    
    logger.error(`Cannot convert value to number. Type: ${typeof value}, Value:`, value);
    throw new Error(`Cannot convert value to number: ${typeof value} ${value}`);
  }

  // ========== CONTRACT OPERATIONS ==========

  async createMatchOnChain(matchData) {
    try {
      await this.initialize();

      // Convert odds to contract format (multiply by 100)
      const oddsTeamA = Math.floor(matchData.odds_team_a * 100);
      const oddsDraw = Math.floor(matchData.odds_draw * 100);
      const oddsTeamB = Math.floor(matchData.odds_team_b * 100);

      // Convert timestamp to UNIX
      const timestamp = Math.floor(new Date(matchData.match_date).getTime() / 1000);

      // Call contract
      const result = await this.web3.callContract('createMatch', [
        matchData.team_a,
        matchData.team_b,
        timestamp,
        oddsTeamA,
        oddsDraw,
        oddsTeamB
      ]);

      if (!result.success) {
        throw new Error('Failed to create match on chain');
      }

      // Extract match ID from event
      const matchId = await this.extractMatchIdFromEvent(result.receipt);

      return {
        success: true,
        matchId,
        txHash: result.txHash,
        receipt: result.receipt
      };
    } catch (error) {
      logger.error('Error creating match on chain:', error);
      throw error;
    }
  }

  async extractMatchIdFromEvent(receipt) {
    try {
      // Parse logs to find MatchCreated event
      const eventSignature = 'MatchCreated(uint256,string,string,uint256,uint256,uint256,uint256)';
      const eventTopic = this.web3.web3.utils.keccak256(eventSignature);

      for (const log of receipt.logs) {
        if (log.topics[0] === eventTopic) {
          // Decode the log data
          const decoded = this.web3.contract.interface.parseLog(log);
          return this.convertToNumber(decoded.args.matchId);
        }
      }

      throw new Error('MatchCreated event not found in receipt');
    } catch (error) {
      logger.error('Error extracting match ID from event:', error);
      throw error;
    }
  }

  async placeBetOnChain(userAddress, matchId, outcome, amount) {
    try {
      await this.initialize();

      // Validate amount
      const minAmount = constants.BETTING_LIMITS.MIN_AMOUNT;
      const maxAmount = constants.BETTING_LIMITS.MAX_AMOUNT;

      if (amount < minAmount) {
        throw new Error(`Minimum bet amount is ${minAmount} CLUTCH`);
      }

      if (amount > maxAmount) {
        throw new Error(`Maximum bet amount is ${maxAmount} CLUTCH`);
      }

      // Get match to verify odds
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== constants.MATCH_STATUS.UPCOMING) {
        throw new Error('Match is not bettable');
      }

      // Convert amount to wei
      const amountInWei = this.web3.parseEther(amount.toString());

      // Call contract
      const result = await this.web3.callContract('placeBet', [
        matchId,
        outcome
      ], {
        value: amount
      });

      if (!result.success) {
        throw new Error('Failed to place bet on chain');
      }

      // Extract bet ID from event
      const betId = await this.extractBetIdFromEvent(result.receipt);

      // Calculate potential win
      let odds;
      if (outcome === constants.OUTCOMES.TEAM_A_WIN) {
        odds = match.odds_team_a;
      } else if (outcome === constants.OUTCOMES.DRAW) {
        odds = match.odds_draw;
      } else {
        odds = match.odds_team_b;
      }

      const potentialWin = amount * odds;

      return {
        success: true,
        betId,
        txHash: result.txHash,
        amount,
        potentialWin,
        odds
      };
    } catch (error) {
      logger.error('Error placing bet on chain:', error);
      throw error;
    }
  }

  async extractBetIdFromEvent(receipt) {
    try {
      const eventSignature = 'BetPlaced(uint256,address,uint256,uint8,uint256,uint256)';
      const eventTopic = this.web3.web3.utils.keccak256(eventSignature);

      for (const log of receipt.logs) {
        if (log.topics[0] === eventTopic) {
          const decoded = this.web3.contract.interface.parseLog(log);
          return this.convertToNumber(decoded.args.betId);
        }
      }

      throw new Error('BetPlaced event not found in receipt');
    } catch (error) {
      logger.error('Error extracting bet ID from event:', error);
      throw error;
    }
  }

  async setMatchResultOnChain(matchId, result) {
    try {
      await this.initialize();

      // Verify match exists and is finished
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== constants.MATCH_STATUS.FINISHED) {
        throw new Error('Match must be finished to set result');
      }

      // Call contract
      const contractResult = await this.web3.callContract('setMatchResult', [
        matchId,
        result
      ]);

      if (!contractResult.success) {
        throw new Error('Failed to set match result on chain');
      }

      // Update database
      await Match.setResult(matchId, result, this.web3.getSignerAddress(), contractResult.txHash);

      // Update bet statuses
      await Bet.updateStatusForMatch(matchId, result);

      // Update user stats and leaderboard
      await this.updateUserStatsAfterMatch(matchId, result);

      return {
        success: true,
        txHash: contractResult.txHash,
        matchId,
        result
      };
    } catch (error) {
      logger.error('Error setting match result on chain:', error);
      throw error;
    }
  }

  async updateUserStatsAfterMatch(matchId, result) {
    try {
      // Get all winning bets for this match
      const winningBets = await Bet.findByMatch(matchId, {
        outcome: result,
        status: constants.BET_STATUS.WON
      });

      for (const bet of winningBets.data) {
        // Update user stats
        await User.updateStats(bet.user_address, {
          total_won: bet.potential_win
        });

        // Update leaderboard
        // This would be handled by a separate service or cron job
      }
    } catch (error) {
      logger.error('Error updating user stats after match:', error);
      // Don't throw error, continue with other operations
    }
  }

  async claimWinningsOnChain(betId, userAddress) {
    try {
      await this.initialize();

      // Verify bet exists and belongs to user
      const bet = await Bet.findById(betId);
      if (!bet) {
        throw new Error('Bet not found');
      }

      if (bet.user_address.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('Bet does not belong to user');
      }

      if (bet.status !== constants.BET_STATUS.WON) {
        throw new Error('Bet did not win');
      }

      if (bet.claimed) {
        throw new Error('Bet already claimed');
      }

      // Call contract
      const result = await this.web3.callContract('claimBetWinnings', [betId]);

      if (!result.success) {
        throw new Error('Failed to claim winnings on chain');
      }

      // Update database
      await Bet.claim(betId, userAddress);

      return {
        success: true,
        txHash: result.txHash,
        betId,
        amount: bet.potential_win
      };
    } catch (error) {
      logger.error('Error claiming winnings on chain:', error);
      throw error;
    }
  }

  // ========== READ OPERATIONS ==========

  async getContractBalance() {
    try {
      await this.initialize();
      
      const balance = await this.web3.callContract('getContractBalance', [], { readOnly: true });
      return this.web3.formatEther(balance);
    } catch (error) {
      logger.error('Error getting contract balance:', error);
      throw error;
    }
  }

  async getTotalPool() {
    try {
      await this.initialize();
      
      const totalPool = await this.web3.callContract('totalPool', [], { readOnly: true });
      return this.web3.formatEther(totalPool);
    } catch (error) {
      logger.error('Error getting total pool:', error);
      throw error;
    }
  }

  async getMatchFromChain(matchId) {
    try {
      await this.initialize();
      
      const match = await this.web3.callContract('getMatch', [matchId], { readOnly: true });
      
      return {
        teamA: match.teamA,
        teamB: match.teamB,
        timestamp: new Date(this.convertToNumber(match.timestamp) * 1000),
        oddsTeamA: this.convertToNumber(match.oddsTeamA) / 100,
        oddsDraw: this.convertToNumber(match.oddsDraw) / 100,
        oddsTeamB: this.convertToNumber(match.oddsTeamB) / 100,
        status: this.mapChainStatus(match.status),
        totalStaked: this.web3.formatEther(match.totalStaked),
        resultVerified: match.resultVerified
      };
    } catch (error) {
      logger.error('Error getting match from chain:', error);
      throw error;
    }
  }

  async getBetFromChain(betId) {
    try {
      await this.initialize();
      
      const bet = await this.web3.callContract('getBet', [betId], { readOnly: true });
      
      return {
        matchId: this.convertToNumber(bet.matchId),
        bettor: bet.bettor,
        predicted: bet.predicted,
        amount: this.web3.formatEther(bet.amount),
        potentialWin: this.web3.formatEther(bet.potentialWin),
        status: this.mapBetStatus(bet.status),
        claimed: bet.claimed,
        timestamp: new Date(this.convertToNumber(bet.timestamp) * 1000)
      };
    } catch (error) {
      logger.error('Error getting bet from chain:', error);
      throw error;
    }
  }

  async getUserActiveBetsFromChain(userAddress) {
    try {
      await this.initialize();
      
      const betIds = await this.web3.callContract('getUserActiveBets', [userAddress], { readOnly: true });
      
      const bets = [];
      for (const betId of betIds) {
        try {
          const betIdNumber = this.convertToNumber(betId);
          const bet = await this.getBetFromChain(betIdNumber);
          bets.push(bet);
        } catch (error) {
          logger.warn(`Error fetching bet ${betId}:`, error);
        }
      }
      
      return bets;
    } catch (error) {
      logger.error('Error getting user active bets from chain:', error);
      throw error;
    }
  }

  async getTotalActiveBetsFromChain() {
    try {
      await this.initialize();
      
      const count = await this.web3.callContract('getTotalActiveBets', [], { readOnly: true });
      return this.convertToNumber(count);
    } catch (error) {
      logger.error('Error getting total active bets from chain:', error);
      throw error;
    }
  }

  // ========== UTILITY FUNCTIONS ==========

  mapChainStatus(chainStatus) {
    const statusNum = this.convertToNumber(chainStatus);
    const statusMap = {
      0: constants.MATCH_STATUS.UPCOMING,
      1: constants.MATCH_STATUS.LIVE,
      2: constants.MATCH_STATUS.FINISHED,
      3: constants.MATCH_STATUS.CANCELLED
    };
    
    return statusMap[statusNum] || constants.MATCH_STATUS.UPCOMING;
  }

  mapBetStatus(chainStatus) {
    const statusNum = this.convertToNumber(chainStatus);
    const statusMap = {
      0: constants.BET_STATUS.PENDING,
      1: constants.BET_STATUS.WON,
      2: constants.BET_STATUS.LOST,
      3: constants.BET_STATUS.REFUNDED,
      4: constants.BET_STATUS.CANCELLED
    };
    
    return statusMap[statusNum] || constants.BET_STATUS.PENDING;
  }

  async syncChainWithDatabase() {
    try {
      await this.initialize();
      
      logger.info('Starting chain-database sync...');
      
      // Sync matches
      await this.syncMatches();
      
      // Sync bets
      await this.syncBets();
      
      logger.info('Chain-database sync completed');
    } catch (error) {
      logger.error('Error during chain-database sync:', error);
      throw error;
    }
  }

  async syncMatches() {
    try {
      // Get match counter from chain
      const matchCounter = await this.web3.callContract('matchCounter', [], { readOnly: true });
      
      // Log for debugging
      logger.debug(`matchCounter raw value: ${matchCounter}, type: ${typeof matchCounter}`);
      
      const totalMatches = this.convertToNumber(matchCounter);
      
      logger.info(`Found ${totalMatches} matches on chain`);
      
      // If no matches, return early
      if (totalMatches <= 0) {
        logger.info('No matches found on chain to sync');
        return;
      }
      
      // Sync each match
      for (let i = 1; i <= totalMatches; i++) {
        try {
          const chainMatch = await this.getMatchFromChain(i);
          const dbMatch = await Match.findById(i);
          
          if (!dbMatch) {
            // Create match in database
            await Match.create({
              match_id: i,
              team_a: chainMatch.teamA,
              team_b: chainMatch.teamB,
              match_date: chainMatch.timestamp,
              odds_team_a: chainMatch.oddsTeamA,
              odds_draw: chainMatch.oddsDraw,
              odds_team_b: chainMatch.oddsTeamB,
              status: chainMatch.status,
              total_staked: parseFloat(chainMatch.totalStaked)
            });
            
            logger.debug(`Created match ${i} in database`);
          } else {
            // Update match if needed
            const updates = {};
            
            if (dbMatch.status !== chainMatch.status) {
              updates.status = chainMatch.status;
            }
            
            if (parseFloat(dbMatch.total_staked) !== parseFloat(chainMatch.totalStaked)) {
              updates.total_staked = parseFloat(chainMatch.totalStaked);
            }
            
            if (Object.keys(updates).length > 0) {
              await Match.update(i, updates);
              logger.debug(`Updated match ${i} in database`);
            }
          }
        } catch (error) {
          logger.warn(`Error syncing match ${i}:`, error);
          // Continue with next match
        }
      }
    } catch (error) {
      logger.error('Error syncing matches:', error);
      throw error;
    }
  }

  async syncBets() {
    try {
      // Get bet counter from chain
      const betCounter = await this.web3.callContract('betCounter', [], { readOnly: true });
      
      // Log for debugging
      logger.debug(`betCounter raw value: ${betCounter}, type: ${typeof betCounter}`);
      
      const totalBets = this.convertToNumber(betCounter);
      
      logger.info(`Found ${totalBets} bets on chain`);
      
      // If no bets, return early
      if (totalBets <= 0) {
        logger.info('No bets found on chain to sync');
        return;
      }
      
      // Sync each bet
      for (let i = 1; i <= totalBets; i++) {
        try {
          const chainBet = await this.getBetFromChain(i);
          const dbBet = await Bet.findById(i);
          
          if (!dbBet) {
            // Create bet in database
            await Bet.create({
              bet_id: i,
              user_address: chainBet.bettor,
              match_id: chainBet.matchId,
              outcome: chainBet.predicted,
              amount: parseFloat(chainBet.amount),
              potential_win: parseFloat(chainBet.potentialWin),
              odds: this.calculateOddsFromChainBet(chainBet),
              status: chainBet.status,
              claimed: chainBet.claimed
            });
            
            logger.debug(`Created bet ${i} in database`);
          } else {
            // Update bet if needed
            const updates = {};
            
            if (dbBet.status !== chainBet.status) {
              updates.status = chainBet.status;
            }
            
            if (dbBet.claimed !== chainBet.claimed) {
              updates.claimed = chainBet.claimed;
              if (chainBet.claimed) {
                updates.claimed_at = new Date();
              }
            }
            
            if (Object.keys(updates).length > 0) {
              await Bet.update(i, updates);
              logger.debug(`Updated bet ${i} in database`);
            }
          }
        } catch (error) {
          logger.warn(`Error syncing bet ${i}:`, error);
          // Continue with next bet
        }
      }
    } catch (error) {
      logger.error('Error syncing bets:', error);
      throw error;
    }
  }

  calculateOddsFromChainBet(chainBet) {
    // Calculate odds from amount and potential win
    const amount = parseFloat(chainBet.amount);
    const potentialWin = parseFloat(chainBet.potentialWin);
    
    if (amount > 0) {
      return potentialWin / amount;
    }
    return 1;
  }

  async healthCheck() {
    try {
      await this.initialize();
      
      const chainHealth = await this.web3.healthCheck();
      const dbHealth = await require('../config/database').healthCheck();
      
      return {
        chain: chainHealth,
        database: dbHealth,
        contractLoaded: !!this.web3.contract,
        isInitialized: this.isInitialized
      };
    } catch (error) {
      return {
        chain: { status: 'unhealthy', error: error.message },
        database: { status: 'unknown' },
        contractLoaded: false,
        isInitialized: false
      };
    }
  }
}

// Create singleton instance
const web3Service = new Web3Service();

module.exports = web3Service;