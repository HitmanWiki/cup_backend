// src/database/migrations/001_initial_schema.js
const db = require('../../config/database');

async function up() {
  await db.query(`
    -- Enable UUID extension if not already enabled
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(42) UNIQUE NOT NULL,
      username VARCHAR(50),
      email VARCHAR(100),
      total_bets INTEGER DEFAULT 0,
      total_won DECIMAL(20, 8) DEFAULT 0,
      total_staked DECIMAL(20, 8) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create matches table
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      match_id INTEGER UNIQUE,
      team_a VARCHAR(100) NOT NULL,
      team_b VARCHAR(100) NOT NULL,
      match_date TIMESTAMP NOT NULL,
      venue VARCHAR(200),
      group_name VARCHAR(10),
      odds_team_a DECIMAL(5,2) NOT NULL,
      odds_draw DECIMAL(5,2) NOT NULL,
      odds_team_b DECIMAL(5,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'upcoming',
      result VARCHAR(1),
      total_staked DECIMAL(20, 8) DEFAULT 0,
      archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create bets table
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      bet_id INTEGER UNIQUE,
      user_address VARCHAR(42) NOT NULL,
      match_id INTEGER NOT NULL,
      outcome INTEGER NOT NULL,
      amount DECIMAL(20, 8) NOT NULL,
      potential_win DECIMAL(20, 8) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      claimed BOOLEAN DEFAULT FALSE,
      odds DECIMAL(5,2) NOT NULL,
      placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      result_set_at TIMESTAMP,
      claimed_at TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(match_id),
      FOREIGN KEY (user_address) REFERENCES users(wallet_address)
    );

    -- Create ultimate_bets table
    CREATE TABLE IF NOT EXISTS ultimate_bets (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(42) UNIQUE NOT NULL,
      team_id INTEGER NOT NULL,
      team_name VARCHAR(100) NOT NULL,
      amount DECIMAL(20, 8) NOT NULL,
      potential_win DECIMAL(20, 8) NOT NULL,
      odds DECIMAL(5,2) NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      claimed BOOLEAN DEFAULT FALSE,
      placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_address) REFERENCES users(wallet_address)
    );

    -- Create leaderboard table
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(42) UNIQUE NOT NULL,
      total_winnings DECIMAL(20, 8) DEFAULT 0,
      total_bets INTEGER DEFAULT 0,
      win_rate DECIMAL(5,2) DEFAULT 0,
      streak INTEGER DEFAULT 0,
      rank INTEGER,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_address) REFERENCES users(wallet_address)
    );

    -- Create results table
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      team_a_score INTEGER,
      team_b_score INTEGER,
      result VARCHAR(1) NOT NULL,
      verified_by VARCHAR(42),
      verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      oracle_tx_hash VARCHAR(66),
      FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );

    -- Create logs table for auditing
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      level VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      context VARCHAR(50),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(42) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_address) REFERENCES users(wallet_address)
    );

    -- Create transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      tx_hash VARCHAR(66) UNIQUE NOT NULL,
      user_address VARCHAR(42) NOT NULL,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(20, 8) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      block_number INTEGER,
      confirmed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_address) REFERENCES users(wallet_address)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
    
    CREATE INDEX IF NOT EXISTS idx_matches_id ON matches(match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_name);
    
    CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_address);
    CREATE INDEX IF NOT EXISTS idx_bets_match ON bets(match_id);
    CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
    CREATE INDEX IF NOT EXISTS idx_bets_placed ON bets(placed_at);
    
    CREATE INDEX IF NOT EXISTS idx_leaderboard_winnings ON leaderboard(total_winnings DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
    
    CREATE INDEX IF NOT EXISTS idx_results_match ON results(match_id);
    CREATE INDEX IF NOT EXISTS idx_results_verified ON results(verified_at);
    
    CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    
    CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
  `);
}

async function down() {
  await db.query(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS results;
    DROP TABLE IF EXISTS leaderboard;
    DROP TABLE IF EXISTS ultimate_bets;
    DROP TABLE IF EXISTS bets;
    DROP TABLE IF EXISTS matches;
    DROP TABLE IF EXISTS users;
  `);
}

module.exports = { up, down };