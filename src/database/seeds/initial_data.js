// src/database/seeds/initial_data.js
const db = require('../../../config/database');

async function seed() {
  // Insert sample users
  await db.query(`
    INSERT INTO users (wallet_address, username, total_bets, total_won, total_staked) 
    VALUES 
      ('0x7a3f8e2a1b9c4d5e6f7a8b9c0d1e2f3a4b5c6d7', 'EagleEye', 24, 12450, 8000),
      ('0x4b2c9d1e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3', 'StarsAndStripes', 19, 9870, 6500),
      ('0x1f9a4b6c8d7e2f3a5b4c6d8e9f0a1b2c3d4e5f6', 'CLUTCHMaster', 16, 8120, 5500),
      ('0x6d5e7f3a1b9c4d2e8f7a6b5c4d3e2f1a0b9c8d7', 'RedWhiteBlue', 12, 6540, 4200),
      ('0x3c8b2d9a4f7e6c5d4b3a2c1d0e9f8a7b6c5d4e3', 'FreedomBettor', 8, 4320, 3100)
    ON CONFLICT (wallet_address) DO NOTHING;
  `);

  // Insert sample matches
  await db.query(`
    INSERT INTO matches 
    (match_id, team_a, team_b, match_date, venue, group_name, odds_team_a, odds_draw, odds_team_b, status) 
    VALUES
      (1, 'Mexico', 'South Africa', '2026-06-11 13:00:00', 'Estadio Azteca, Mexico City', 'Group A', 1.9, 3.4, 4.2, 'upcoming'),
      (2, 'United States', 'Paraguay', '2026-06-12 19:00:00', 'Levi''s Stadium, Santa Clara', 'Group D', 2.0, 3.3, 3.8, 'upcoming'),
      (3, 'Argentina', 'Algeria', '2026-06-13 16:00:00', 'MetLife Stadium, New York/New Jersey', 'Group J', 1.8, 3.4, 4.6, 'upcoming'),
      (4, 'Brazil', 'Morocco', '2026-06-14 18:00:00', 'Mercedes-Benz Stadium, Atlanta', 'Group C', 2.1, 3.2, 3.4, 'upcoming'),
      (5, 'Germany', 'Curacao', '2026-06-15 15:00:00', 'SoFi Stadium, Los Angeles', 'Group E', 1.5, 4.0, 6.0, 'upcoming')
    ON CONFLICT (match_id) DO NOTHING;
  `);

  // Insert sample leaderboard data
  await db.query(`
    INSERT INTO leaderboard (user_address, total_winnings, total_bets, win_rate, rank) 
    VALUES
      ('0x7a3f8e2a1b9c4d5e6f7a8b9c0d1e2f3a4b5c6d7', 12450, 24, 65.4, 1),
      ('0x4b2c9d1e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3', 9870, 19, 58.9, 2),
      ('0x1f9a4b6c8d7e2f3a5b4c6d8e9f0a1b2c3d4e5f6', 8120, 16, 62.5, 3),
      ('0x6d5e7f3a1b9c4d2e8f7a6b5c4d3e2f1a0b9c8d7', 6540, 12, 58.3, 4),
      ('0x3c8b2d9a4f7e6c5d4b3a2c1d0e9f8a7b6c5d4e3', 4320, 8, 62.5, 5)
    ON CONFLICT (user_address) DO NOTHING;
  `);

  console.log('Database seeded successfully');
}

module.exports = { seed };