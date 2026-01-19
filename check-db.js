// check-production.js
const axios = require('axios');

async function checkProduction() {
  const baseUrl = 'https://cup-backend-red.vercel.app';
  
  console.log('🔍 Checking production deployment...\n');
  
  const endpoints = [
    '/',
    '/api',
    '/api/v4',
    '/api/v4/matches',
    '/api/v1/matches',
    '/api/v4/matches/upcoming',
    '/api/debug/matches',
    '/health'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(baseUrl + endpoint, {
        timeout: 10000,
        validateStatus: null // Don't throw on any status
      });
      
      console.log(`${endpoint}: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
      }
      
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
    console.log('---');
  }
}

checkProduction();