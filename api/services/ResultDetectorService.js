// src/services/ResultDetectorService.js
const Match = require('../models/Match');
const web3Service = require('./web3Service');
const SportsDataService = require('/SportsDataService');
const { constants } = require('../config/constants');
const logger = require('../utils/logger');

class ResultDetectorService {
  constructor() {
    this.sportsDataService = new SportsDataService();
    this.lastCheckTime = null;
  }

  // Main method to check and process finished matches
  async checkFinishedMatches() {
    try {
      logger.info('🔍 Checking for finished matches...');
      
      // 1. Get live matches from database
      const liveMatches = await Match.getLiveMatches();
      
      if (liveMatches.length === 0) {
        logger.info('📭 No live matches to check');
        return { checked: 0, finished: 0, errors: 0 };
      }

      logger.info(`📊 Found ${liveMatches.length} live matches to check`);
      
      let finishedCount = 0;
      let errorCount = 0;

      // 2. Process each live match
      for (const match of liveMatches) {
        try {
          const matchFinished = await this.processMatch(match);
          if (matchFinished) {
            finishedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error processing match ${match.match_id}:`, error.message);
        }
      }

      this.lastCheckTime = new Date();
      
      logger.info(`✅ Check completed: ${finishedCount} matches finished, ${errorCount} errors`);
      
      return {
        checked: liveMatches.length,
        finished: finishedCount,
        errors: errorCount,
        lastCheck: this.lastCheckTime
      };

    } catch (error) {
      logger.error('❌ Error in checkFinishedMatches:', error);
      throw error;
    }
  }

  // Process individual match
  async processMatch(match) {
    try {
      const { match_id, external_id, team_a, team_b } = match;
      
      logger.info(`Processing match ${match_id}: ${team_a} vs ${team_b}`);
      
      // 1. Try to get actual result from external API
      let apiResult = null;
      if (external_id) {
        try {
          apiResult = await this.getMatchResultFromAPI(external_id);
        } catch (apiError) {
          logger.warn(`API result not available for match ${match_id}:`, apiError.message);
        }
      }

      // 2. If no API result, check if match should be finished based on time
      const isMatchOver = await this.isMatchOver(match, apiResult);
      
      if (!isMatchOver) {
        logger.debug(`Match ${match_id} is still in progress`);
        return false;
      }

      // 3. Calculate outcome (0=teamA, 1=draw, 2=teamB)
      const outcome = this.calculateOutcome(apiResult);
      
      logger.info(`Match ${match_id} finished. Outcome: ${outcome} (${this.getOutcomeText(outcome, team_a, team_b)})`);

      // 4. Set result on blockchain
      const chainResult = await web3Service.setMatchResultOnChain(match_id, outcome);
      
      // 5. Update database
      await Match.setResult(
        match_id, 
        outcome, 
        'auto_oracle', 
        chainResult.txHash
      );

      // 6. Store actual score if available from API
      if (apiResult && apiResult.score) {
        await this.storeMatchScore(match_id, apiResult.score);
      }

      logger.info(`✅ Match ${match_id} result processed successfully`);
      return true;

    } catch (error) {
      logger.error(`Failed to process match ${match.match_id}:`, error);
      throw error;
    }
  }

  async getMatchResultFromAPI(externalId) {
  try {
    // Example with SportsData.io
    const response = await axios.get(`${this.sportsDataService.baseUrl}/json/Game/${externalId}`, {
      params: { key: this.sportsDataService.apiKey },
      timeout: 5000
    });

    const game = response.data;
    
    return {
      status: game.Status,
      score: {
        home: game.HomeTeamScore,
        away: game.AwayTeamScore
      },
      winner: game.HomeTeamScore > game.AwayTeamScore ? 'home' : 
              game.HomeTeamScore < game.AwayTeamScore ? 'away' : 'draw',
      minute: game.Minute,
      period: game.Period
    };
  } catch (error) {
    throw new Error(`API result fetch failed: ${error.message}`);
  }
}

  // Check if match should be finished based on time
  async isMatchOver(match, apiResult) {
    const matchDate = new Date(match.match_date);
    const now = new Date();
    
    // If API says it's finished, trust the API
    if (apiResult && apiResult.status === 'finished') {
      return true;
    }
    
    // Otherwise check time (football match is ~2 hours + extra time)
    const matchEndTime = new Date(matchDate.getTime() + (2 * 60 * 60 * 1000) + (30 * 60 * 1000)); // 2.5 hours
    
    return now > matchEndTime;
  }

  // Calculate outcome based on score
  calculateOutcome(apiResult) {
    if (!apiResult || !apiResult.score) {
      // If no score, randomly determine outcome for simulation
      const random = Math.random();
      return random > 0.66 ? 0 : random > 0.33 ? 1 : 2;
    }

    const { home, away } = apiResult.score;
    
    if (home > away) return 0; // Team A wins
    if (home < away) return 2; // Team B wins
    return 1; // Draw
  }

  // Store match score in database
  async storeMatchScore(matchId, score) {
    try {
      await Match.update(matchId, {
        final_score_home: score.home,
        final_score_away: score.away
      });
      logger.debug(`Score stored for match ${matchId}: ${score.home}-${score.away}`);
    } catch (error) {
      logger.warn(`Failed to store score for match ${matchId}:`, error.message);
    }
  }

  // Helper to get outcome text
  getOutcomeText(outcome, teamA, teamB) {
    switch (outcome) {
      case 0: return `${teamA} wins`;
      case 1: return 'Draw';
      case 2: return `${teamB} wins`;
      default: return 'Unknown';
    }
  }

  // Manual trigger for testing
  async manuallyFinishMatch(matchId, outcome) {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status === constants.MATCH_STATUS.FINISHED) {
        throw new Error('Match already finished');
      }

      logger.info(`Manually finishing match ${matchId} with outcome ${outcome}`);

      // Update blockchain
      const chainResult = await web3Service.setMatchResultOnChain(matchId, outcome);
      
      // Update database
      await Match.setResult(
        matchId, 
        outcome, 
        'manual_admin', 
        chainResult.txHash
      );

      return {
        success: true,
        matchId,
        outcome,
        txHash: chainResult.txHash
      };

    } catch (error) {
      logger.error('Manual finish failed:', error);
      throw error;
    }
  }

  // Get service status
  async getStatus() {
    return {
      lastCheck: this.lastCheckTime,
      service: 'result_detector',
      status: 'running'
    };
  }
}

module.exports = ResultDetectorService;