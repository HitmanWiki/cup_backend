// check-endpoints.js
const axios = require('axios');

const API_URL = 'https://cup-backend-red.vercel.app';

async function checkAvailableEndpoints() {
  console.log('🔍 Checking available endpoints...\n');
  
  const endpoints = [
    '/',
    '/api/health',
    '/api/debug/matches',
    '/api/v1/matches/upcoming',
    '/api/v1/matches',
    '/api/v1/auth',
    '/api/v1/bets'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`, {
        timeout: 5000,
        validateStatus: (status) => true // Accept all status codes
      });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      if (response.status === 200 && response.data) {
        console.log(`   Response keys:`, Object.keys(response.data).join(', '));
      }
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }
}

checkAvailableEndpoints();