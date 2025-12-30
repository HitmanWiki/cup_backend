// debug-routes.js
console.log('DEBUG: Checking route exports...\n');

const routes = [
  { name: 'auth', path: './src/routes/auth' },
  { name: 'matches', path: './src/routes/matches' },
  { name: 'bets', path: './src/routes/bets' },
  { name: 'leaderboard', path: './src/routes/leaderboard' },
  { name: 'admin', path: './src/routes/admin' }
];

routes.forEach(({ name, path }) => {
  try {
    const route = require(path);
    console.log(`✓ ${name}.js loaded`);
    console.log(`  Type: ${typeof route}`);
    console.log(`  Is function: ${typeof route === 'function'}`);
    
    if (typeof route === 'object') {
      console.log(`  Keys: ${Object.keys(route).join(', ')}`);
      console.log(`  Has stack property: ${!!route.stack}`);
      console.log(`  Is router-like: ${route.stack && typeof route.stack === 'function' ? 'yes' : 'no'}`);
    }
    
    // Check if it's actually a router
    if (route && typeof route === 'function') {
      // Check for router properties
      const proto = Object.getPrototypeOf(route);
      console.log(`  Function name: ${route.name || 'anonymous'}`);
      console.log(`  Has use method: ${!!route.use}`);
    }
    
    console.log('---\n');
  } catch (error) {
    console.log(`✗ ${name}.js ERROR: ${error.message}`);
    console.log('---\n');
  }
});