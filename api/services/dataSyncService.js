// api/services/dataSyncService.js - UPDATED
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
      logger.info('🔄 Starting REAL data sync from SportsData.io API...');
      
      // Test API connection first
      const health = await this.sportsDataService.healthCheck();
      if (!health.connected) {
        throw new Error(`API not connected: ${health.error}`);
      }
      
      // Fetch matches from API
      const apiMatches = await this.sportsDataService.fetchWorldCupMatches();
      
      if (!apiMatches || apiMatches.length === 0) {
        logger.warn('⚠️ No matches received from API');
        return {
          success: false,
          message: 'No matches received from SportsData.io API',
          created: 0,
          updated: 0,
          total: 0,
          apiStatus: health
        };
      }

      logger.info(`📥 Processing ${apiMatches.length} matches from API...`);
      
      // Import Prisma here to avoid circular dependencies
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      let created = 0;
      let updated = 0;
      let errors = 0;
      
      // Process each match
      for (const matchData of apiMatches.slice(0, 50)) { // Limit to 50 matches
        try {
          // Check if match already exists by match_id
          const existingMatch = await prisma.match.findUnique({
            where: { match_id: matchData.match_id }
          });
          
          if (existingMatch) {
            // Update existing match
            await prisma.match.update({
              where: { match_id: matchData.match_id },
              data: matchData
            });
            updated++;
            logger.debug(`Updated match ${matchData.match_id}: ${matchData.team_a} vs ${matchData.team_b}`);
          } else {
            // Create new match
            await prisma.match.create({
              data: matchData
            });
            created++;
            logger.info(`✅ Created match ${matchData.match_id}: ${matchData.team_a} vs ${matchData.team_b}`);
          }
        } catch (matchError) {
          errors++;
          logger.error(`Error processing match ${matchData.match_id}:`, matchError.message);
        }
      }
      
      await prisma.$disconnect();
      
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
        message: `Synced ${created} new matches, updated ${updated}`,
        created,
        updated,
        errors,
        total: apiMatches.length,
        duration: syncDuration,
        lastSync: this.lastSyncTime,
        apiStatus: health
      };
      
    } catch (error) {
      logger.error('❌ Data sync failed:', error);
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
}

module.exports = DataSyncService;