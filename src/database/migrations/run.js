// src/database/migrations/run.js - SQLite version
console.log('🚀 Starting SQLite database setup...');
console.log('📊 Database will be created at: database/clutch.db');

// Import and initialize the database
try {
  // Just require the database file - it initializes automatically
  const db = require('../../config/database.js');
  
  console.log('✅ Database initialized successfully');
  console.log('🌱 Sample data has been seeded');
  console.log('🎉 Migration completed!');
  console.log('\n🚀 Next steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Test the API: curl http://localhost:5000/health');
  console.log('3. View matches: curl http://localhost:5000/api/v1/matches');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
}