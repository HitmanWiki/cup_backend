// src/services/dataSyncService.js
const Match = require('../models/Match');
const logger = require('../utils/logger');

class DataSyncService {
  constructor(sportsDataService) {
    this.sportsDataService = sportsDataService;
    this.lastSyncTime = null;
    this.syncInProgress = false;
  }

  async syncMatches() {
    if (this.syncInProgress) {
      logger.warn('Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    this.syncInProgress = true;
    const syncStart = Date.now();

    try {
      logger.info('🔄 Starting match data sync from external API...');
      
      // Fetch matches from API
      const apiMatches = await this.sportsDataService.fetchWorldCupMatches();
      
       if (!apiMatches || apiMatches.length === 0) {
      logger.info('Trying alternative match fetching method...');
      const alternativeMatches = await this.sportsDataService.fetchMatchesAlternative();
      
      if (!alternativeMatches || alternativeMatches.length === 0) {
        logger.warn('No matches received from API');
        return {
          success: true,
          message: 'No matches to sync - API may not have 2026 data yet',
          created: 0,
          updated: 0,
          total: 0
        };
      }
      
      apiMatches = alternativeMatches;
    }

      logger.info(`Processing ${apiMatches.length} matches from API...`);
      
      let created = 0;
      let updated = 0;
      let errors = 0;
      
      // Process each match
      for (const matchData of apiMatches) {
        try {
          // Check if match already exists
          const existingMatch = await Match.findById(matchData.match_id);
          
          if (existingMatch) {
            // Update existing match
            const updatedMatch = await Match.update(matchData.match_id, matchData);
            if (updatedMatch) {
              updated++;
              logger.debug(`Updated match ${matchData.match_id}: ${matchData.team_a} vs ${matchData.team_b}`);
            }
          } else {
            // Create new match
            const newMatch = await Match.create(matchData);
            if (newMatch) {
              created++;
              logger.info(`Created match ${matchData.match_id}: ${matchData.team_a} vs ${matchData.team_b}`);
            }
          }
        } catch (matchError) {
          errors++;
          logger.error(`Error processing match ${matchData.match_id}:`, matchError.message);
        }
      }
      
      const syncDuration = Date.now() - syncStart;
      this.lastSyncTime = new Date();
      
      logger.info(`✅ Sync completed in ${syncDuration}ms`, {
        created,
        updated,
        errors,
        total: apiMatches.length,
        duration: syncDuration
      });
      
      return {
        success: true,
        created,
        updated,
        errors,
        total: apiMatches.length,
        duration: syncDuration,
        lastSync: this.lastSyncTime
      };
      
    } catch (error) {
      logger.errorWithContext('DATA_SYNC', error);
      return {
        success: false,
        error: error.message,
        created: 0,
        updated: 0,
        total: 0
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncUpcomingMatches() {
    try {
      logger.info('🔄 Syncing upcoming matches...');
      const upcomingMatches = await this.sportsDataService.fetchUpcomingMatches(14); // Next 14 days
      
      let synced = 0;
      for (const match of upcomingMatches) {
        try {
          const existing = await Match.findById(match.match_id);
          if (!existing) {
            await Match.create(match);
            synced++;
          }
        } catch (error) {
          logger.error(`Error syncing match ${match.match_id}:`, error.message);
        }
      }
      
      logger.info(`Synced ${synced} upcoming matches`);
      return { success: true, synced };
      
    } catch (error) {
      logger.error('Upcoming matches sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getSyncStatus() {
    return {
      lastSync: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      serviceHealth: await this.sportsDataService.healthCheck()
    };
  }

  async forceSync() {
    logger.info('🔄 Force sync requested');
    return await this.syncMatches();
  }
}

module.exports = DataSyncService;