// fix-matches.js
const db = require('./src/config/database');

async function fixMatches() {
  try {
    console.log('🔧 Fixing match statuses and dates...');
    
    // Update status from 'finished' to 'upcoming'
    const updateStatus = await db.query(
      "UPDATE matches SET status = 'upcoming' WHERE status = 'finished'"
    );
    console.log(`✅ Updated ${updateStatus.rowCount} matches to 'upcoming'`);
    
    // Update dates from 2025 to 2026
    const updateDates = await db.query(
      "UPDATE matches SET match_date = REPLACE(match_date, '2025', '2026') WHERE match_date LIKE '%2025%'"
    );
    console.log(`✅ Updated ${updateDates.rowCount} match dates to 2026`);
    
    // Verify changes
    const sample = await db.query("SELECT * FROM matches LIMIT 3");
    console.log('📋 Sample matches after fix:');
    sample.rows.forEach(match => {
      console.log(`  ${match.match_id}: ${match.team_a} vs ${match.team_b} | Status: ${match.status} | Date: ${match.match_date}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixMatches();