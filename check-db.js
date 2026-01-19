// check-vercel.js
const axios = require('axios');

async function checkEndpoints() {
  const baseUrl = 'https://cup-backend-9hzvg2rr9-hitmanwikis-projects.vercel.app';
  const endpoints = [
    '/',
    '/health',
    '/api/debug/matches',
    '/api/v4/matches/upcoming',
    '/api/v4/matches/all',
    '/api/v4/auth/status',
    '/api/v4/matches/groups',
    '/api/v4/leaderboard/top'
  ];

  console.log(`🔍 Testing Vercel deployment at ${baseUrl}\n`);
  console.log('='.repeat(60));

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`📡 Testing: ${endpoint}`);
    
    try {
      const response = await axios.get(url, {
        timeout: 15000, // 15 second timeout for cold starts
        headers: {
          'User-Agent': 'CLUTCH-Tester/1.0'
        }
      });
      
      console.log(`✅ Status: ${response.status} ${response.statusText}`);
      
      // Show response summary
      if (response.data) {
        if (response.data.success !== undefined) {
          console.log(`   Success: ${response.data.success}`);
        }
        
        if (response.data.status) {
          console.log(`   Status: ${response.data.status}`);
        }
        
        if (response.data.message) {
          console.log(`   Message: ${response.data.message}`);
        }
        
        if (response.data.total !== undefined) {
          console.log(`   Total: ${response.data.total}`);
        }
        
        if (response.data.data && Array.isArray(response.data.data)) {
          console.log(`   Items: ${response.data.data.length}`);
          // Show first item if available
          if (response.data.data.length > 0) {
            const firstItem = response.data.data[0];
            if (firstItem.teamA_name && firstItem.teamB_name) {
              console.log(`   Sample: ${firstItem.teamA_name} vs ${firstItem.teamB_name}`);
            }
          }
        }
      }
      
    } catch (error) {
      if (error.response) {
        // Server responded with error
        console.log(`❌ Error: ${error.response.status} ${error.response.statusText}`);
        if (error.response.data && error.response.data.error) {
          console.log(`   Details: ${error.response.data.error}`);
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.log('❌ Connection refused');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.log('❌ Timeout - Vercel function may be cold starting');
        console.log('   Tip: Try refreshing the endpoint to warm up the server');
      } else if (error.code === 'ENOTFOUND') {
        console.log('❌ DNS lookup failed - check the URL');
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
      
      // Show the full URL that failed
      console.log(`   URL: ${url}`);
    }
    
    console.log('='.repeat(60));
  }
  
  console.log('\n📋 Quick Test Commands:');
  console.log(`curl ${baseUrl}/health`);
  console.log(`curl ${baseUrl}/api/v4/matches/upcoming`);
  console.log(`curl ${baseUrl}/api/debug/matches`);
}

checkEndpoints();