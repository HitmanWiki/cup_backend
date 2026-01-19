// Create a file: test-sports-api.js
const axios = require('axios');

const API_KEY = '872fc84a38ee4fe2afe93075df830972';
const BASE_URL = 'https://api.sportsdata.io/v4/soccer/scores/json';

async function testEndpoints() {
  console.log('🔍 Testing SportsData.io API endpoints...\n');
  
  const endpoints = [
    // Basic endpoints that should work
    '/Areas',
    '/Competitions',
    '/Competitions/21', // World Cup
    '/Competitions/21/2026', // World Cup 2026
    '/Teams',
    '/TeamsByCompetition/21',
    
    // Match-related endpoints
    '/Games',
    '/GamesByDate/2024-12-30', // Today's date
    '/GamesByCompetition/21',
    '/Schedule/2026',
    '/Schedule/WorldCup',
    '/Schedule/WorldCup/2026',
    
    // Other endpoints
    '/Standings/21/2026',
    '/PlayersByTeam/1',
    '/BoxScores/1000' // Example game ID
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}${endpoint}`;
      console.log(`Testing: ${endpoint}`);
      
      const response = await axios.get(url, {
        params: { key: API_KEY },
        timeout: 3000
      });
      
      if (Array.isArray(response.data)) {
        console.log(`  ✅ Success - ${response.data.length} items`);
        if (response.data.length > 0) {
          console.log(`  📊 First item:`, JSON.stringify(response.data[0], null, 2).substring(0, 200) + '...');
        }
      } else {
        console.log(`  ✅ Success - Object received`);
        console.log(`  📊 Keys:`, Object.keys(response.data));
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`  ❌ ${error.response.status}: ${error.response.statusText}`);
      } else {
        console.log(`  ❌ ${error.code || error.message}`);
      }
    }
    console.log();
  }
}

testEndpoints();