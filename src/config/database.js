// src/config/database.js - SQLite Version
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'clutch.db');
console.log('📊 SQLite Database:', dbPath);

// Create database connection
const db = new Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  console.log('🔄 Initializing database tables...');
  
  db.exec(`
    -- Enable foreign keys and WAL mode for better performance
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    
    -- Create migrations table
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      username TEXT,
      email TEXT,
      total_bets INTEGER DEFAULT 0,
      total_won REAL DEFAULT 0,
      total_staked REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create matches table
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER UNIQUE,
      team_a TEXT NOT NULL,
      team_b TEXT NOT NULL,
      match_date TIMESTAMP NOT NULL,
      venue TEXT,
      group_name TEXT,
      odds_team_a REAL NOT NULL,
      odds_draw REAL NOT NULL,
      odds_team_b REAL NOT NULL,
      status TEXT DEFAULT 'upcoming',
      result TEXT,
      total_staked REAL DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create bets table
    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bet_id INTEGER UNIQUE,
      user_address TEXT NOT NULL,
      match_id INTEGER NOT NULL,
      outcome INTEGER NOT NULL,
      amount REAL NOT NULL,
      potential_win REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      claimed INTEGER DEFAULT 0,
      odds REAL NOT NULL,
      placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      result_set_at TIMESTAMP,
      claimed_at TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );
    
    -- Create ultimate_bets table
    CREATE TABLE IF NOT EXISTS ultimate_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_address TEXT UNIQUE NOT NULL,
      team_id INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      amount REAL NOT NULL,
      potential_win REAL NOT NULL,
      odds REAL NOT NULL,
      active INTEGER DEFAULT 1,
      claimed INTEGER DEFAULT 0,
      placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create leaderboard table
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_address TEXT UNIQUE NOT NULL,
      total_winnings REAL DEFAULT 0,
      total_bets INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      streak INTEGER DEFAULT 0,
      rank INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_matches_id ON matches(match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_address);
    CREATE INDEX IF NOT EXISTS idx_bets_match ON bets(match_id);
  `);
  
  console.log('✅ Database tables created');
}

// Run initialization
initializeDatabase();

// Insert sample data if tables are empty
function seedSampleData() {
  try {
    console.log('🌱 Checking for sample data...');
    
    // Check if matches table is empty
    const matchCount = db.prepare('SELECT COUNT(*) as count FROM matches').get().count;
    
    if (matchCount === 0) {
      console.log('🌱 Seeding sample matches...');
      
      db.exec(`
        INSERT INTO matches 
        (match_id, team_a, team_b, match_date, venue, group_name, odds_team_a, odds_draw, odds_team_b, status) 
        VALUES
          (1, 'Mexico', 'South Africa', '2026-06-11 13:00:00', 'Estadio Azteca, Mexico City', 'Group A', 1.9, 3.4, 4.2, 'upcoming'),
          (2, 'United States', 'Paraguay', '2026-06-12 19:00:00', 'Levi''s Stadium, Santa Clara', 'Group D', 2.0, 3.3, 3.8, 'upcoming'),
          (3, 'Argentina', 'Algeria', '2026-06-13 16:00:00', 'MetLife Stadium, New York/New Jersey', 'Group J', 1.8, 3.4, 4.6, 'upcoming'),
          (4, 'Brazil', 'Morocco', '2026-06-14 18:00:00', 'Mercedes-Benz Stadium, Atlanta', 'Group C', 2.1, 3.2, 3.4, 'upcoming'),
          (5, 'Germany', 'Curacao', '2026-06-15 15:00:00', 'SoFi Stadium, Los Angeles', 'Group E', 1.5, 4.0, 6.0, 'upcoming')
      `);
      
      console.log('✅ Inserted 5 sample matches');
    } else {
      console.log(`📊 Found ${matchCount} existing matches`);
    }
    
    // Check if users table is empty
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    if (userCount === 0) {
      console.log('🌱 Seeding sample users...');
      
      db.exec(`
        INSERT INTO users (wallet_address, username, total_bets, total_won, total_staked) 
        VALUES 
          ('0x7a3f8e2a1b9c4d5e6f7a8b9c0d1e2f3a4b5c6d7', 'EagleEye', 24, 12450, 8000),
          ('0x4b2c9d1e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3', 'StarsAndStripes', 19, 9870, 6500),
          ('0x1f9a4b6c8d7e2f3a5b4c6d8e9f0a1b2c3d4e5f6', 'CLUTCHMaster', 16, 8120, 5500)
      `);
      
      console.log('✅ Inserted 3 sample users');
    }
    
    console.log('🌱 Sample data check completed');
  } catch (error) {
    console.error('❌ Error seeding sample data:', error.message);
  }
}

// Seed sample data
seedSampleData();

// Database service wrapper
class DatabaseService {
  async query(sql, params = []) {
    try {
      // Remove trailing semicolon if present
      sql = sql.trim().replace(/;+$/, '');
      
      if (sql.toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        return { 
          rows: [], 
          rowCount: result.changes,
          lastID: result.lastInsertRowid
        };
      }
    } catch (error) {
      console.error('❌ Database query error:', { 
        sql, 
        params, 
        error: error.message 
      });
      throw error;
    }
  }

  async connect() {
    console.log('✅ SQLite database connected');
    return this;
  }

  async close() {
    db.close();
    console.log('✅ SQLite database closed');
  }

  async healthCheck() {
    try {
      const result = db.prepare('SELECT datetime() as now').get();
      return {
        status: 'healthy',
        timestamp: result.now,
        connected: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  async transaction(callback) {
    try {
      db.exec('BEGIN TRANSACTION');
      const result = await callback(this);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

// Create and export singleton instance
const database = new DatabaseService();
module.exports = database;