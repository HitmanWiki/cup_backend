// test-routes.js
console.log('Testing route imports...\n');

try {
  console.log('1. Testing authRoutes import...');
  const authRoutes = require('./src/routes/auth');
  console.log('✅ authRoutes imported successfully');
  console.log('   Type:', typeof authRoutes);
  console.log('   Is router:', authRoutes.name || 'unknown');
} catch (error) {
  console.log('❌ authRoutes import failed:', error.message);
}

console.log('\n2. Testing matchRoutes import...');
try {
  const matchRoutes = require('./src/routes/matches');
  console.log('✅ matchRoutes imported successfully');
  console.log('   Type:', typeof matchRoutes);
} catch (error) {
  console.log('❌ matchRoutes import failed:', error.message);
}

console.log('\n3. Checking file structure...');
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
console.log('Routes directory:', routesDir);
console.log('Exists:', fs.existsSync(routesDir));

if (fs.existsSync(routesDir)) {
  const files = fs.readdirSync(routesDir);
  console.log('Files in routes directory:', files);
}