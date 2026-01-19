// test-match-unique.js
const Match = require('./src/models/Match');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMatchWithUniqueId() {
  console.log('🧪 Testing Match model with UNIQUE ID...\n');
  
  const timestamp = Date.now();
  const testMatchId = timestamp % 1000000; // Unique but smaller ID
  
  try {
    // 1. Check if match already exists
    const existing = await Match.exists(testMatchId);
    if (existing) {
      console.log('⚠️  Match already exists, deleting...');
      await Match.delete(testMatchId);
    }
    
    // 2. Create a match
    const matchData = {
      match_id: testMatchId,
      team_a: 'Test Team A',
      team_b: 'Test Team B',
      match_date: new Date('2024-12-25T20:00:00Z'),
      venue: 'Test Stadium',
      group_name: 'Test Group',
      odds_team_a: 1.8,
      odds_draw: 3.2,
      odds_team_b: 2.1,
      status: 'upcoming'
    };
    
    const match = await Match.create(matchData);
    console.log('✅ Created match with ID:', match.match_id);
    
    // 3. Test the problematic methods
    console.log('\n📋 Testing fixed methods:');
    
    // Test getPopularMatches
    console.log('1. Testing getPopularMatches...');
    try {
      const popular = await Match.getPopularMatches(3);
      console.log('   ✅ SUCCESS: Works!');
      console.log('   Found:', popular.length, 'matches');
    } catch (error) {
      console.log('   ❌ FAILED:', error.message);
    }
    
    // Test getMatchStats
    console.log('\n2. Testing getMatchStats...');
    try {
      const stats = await Match.getMatchStats(testMatchId);
      console.log('   ✅ SUCCESS:', stats ? 'Works!' : 'No stats');
      if (stats) {
        console.log('   Total bets:', stats.total_bets || 0);
      }
    } catch (error) {
      console.log('   ❌ FAILED:', error.message);
    }
    
    // Cleanup
    await Match.delete(testMatchId);
    console.log('\n✅ Deleted test match');
    
    console.log('\n🎉 Match model tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testMatchWithUniqueId();