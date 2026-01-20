const axios = require('axios');

class SportsDataService {
  constructor() {
    this.apiKey = process.env.SPORTS_DATA_API_KEY;
    this.baseUrl = process.env.SPORTS_DATA_API_URL || 'https://api.sportsdata.io/v4/soccer/scores';
    this.worldCupId = 21;
    this.season2026 = 2026;
    
    console.log('🔧 SportsDataService Config:', {
      apiKey: this.apiKey ? '✓ Set' : '✗ Missing',
      baseUrl: this.baseUrl,
      worldCupId: this.worldCupId,
      season2026: this.season2026
    });
    
    if (!this.apiKey) {
      throw new Error('SPORTS_DATA_API_KEY is not configured in .env file');
    }
  }

 async testConnection() {
  try {
    console.log('🔗 Testing SportsData.io API connection...');
    
    // Use a shorter timeout
    const response = await axios.get(`${this.baseUrl}/json/Areas`, {
      params: { key: this.apiKey },
      timeout: 3000 // 3 seconds instead of 5
    });
    
    console.log('✅ API Connection successful');
    console.log(`📊 Found ${response.data.length} areas/regions`);
    
    return true;
    
  } catch (error) {
    // Don't throw, just return false
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️ API connection timeout');
    } else if (error.response) {
      console.log(`❌ API error: ${error.response.status}`);
    } else {
      console.log(`❌ Connection failed: ${error.message}`);
    }
    
    return false; // Return false instead of throwing
  }
}

  // 2. FETCH COMPETITIONS (Works with your API key)
  async fetchCompetitions() {
    try {
      console.log('📋 Fetching competitions...');
      
      const response = await axios.get(`${this.baseUrl}/json/Competitions`, {
        params: { key: this.apiKey },
        timeout: 5000
      });
      
      console.log(`✅ Found ${response.data.length} competitions`);
      return response.data || [];
      
    } catch (error) {
      console.error('❌ Error fetching competitions:', error.message);
      return [];
    }
  }

  // 3. GENERATE WORLD CUP 2026 MATCHES (Fallback)
  async fetchWorldCupMatches() {
    try {
      console.log('🌍 Fetching World Cup matches...');
      
      // First, verify we can access competitions
      const competitions = await this.fetchCompetitions();
      const worldCup = competitions.find(c => c.CompetitionId === 21);
      
      if (!worldCup) {
        console.log('⚠️ World Cup not found in API data, using generated schedule');
        return this.generateWorldCup2026Schedule();
      }
      
      console.log(`🏆 World Cup found: ${worldCup.Name}`);
      console.log(`📅 Available seasons: ${worldCup.Seasons?.map(s => s.Season).join(', ') || 'None'}`);
      
      // Check if 2026 season exists
      const season2026 = worldCup.Seasons?.find(s => s.Season === 2026);
      if (!season2026) {
        console.log('⚠️ World Cup 2026 season not available yet, using generated schedule');
        return this.generateWorldCup2026Schedule();
      }
      
      console.log(`✅ World Cup 2026 season confirmed (ID: ${season2026.SeasonId})`);
      
      // Try to get matches (though your API key might not have access)
      try {
        // This might fail, but we try anyway
        const response = await axios.get(`${this.baseUrl}/json/Schedule/WorldCup/2026`, {
          params: { key: this.apiKey },
          timeout: 3000
        });
        
        if (response.data && response.data.length > 0) {
          console.log(`✅ Found ${response.data.length} real World Cup 2026 matches`);
          return response.data.map(game => this.transformGameData(game));
        }
      } catch (matchError) {
        console.log('📋 Match data not available, using generated schedule');
      }
      
      // Fallback to generated schedule
      return this.generateWorldCup2026Schedule();
      
    } catch (error) {
      console.error('❌ Error in fetchWorldCupMatches:', error.message);
      return this.generateWorldCup2026Schedule(); // Always return generated schedule as fallback
    }
  }

  // 4. GENERATE REALISTIC WORLD CUP 2026 SCHEDULE
  generateWorldCup2026Schedule() {
    console.log('🎯 Generating realistic World Cup 2026 schedule...');
    
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const groupTeams = {
      'A': ['USA', 'Canada', 'Mexico', 'Costa Rica'],
      'B': ['Brazil', 'Argentina', 'Uruguay', 'Chile'],
      'C': ['England', 'France', 'Germany', 'Netherlands'],
      'D': ['Spain', 'Portugal', 'Italy', 'Belgium'],
      'E': ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
      'F': ['Morocco', 'Egypt', 'Senegal', 'Nigeria'],
      'G': ['Switzerland', 'Denmark', 'Sweden', 'Norway'],
      'H': ['Iran', 'South Africa', 'New Zealand', 'Qatar']
    };
    
    const venues = [
      'MetLife Stadium, New Jersey',
      'SoFi Stadium, California',
      'AT&T Stadium, Texas',
      'Mercedes-Benz Stadium, Georgia',
      'Hard Rock Stadium, Florida',
      'Arrowhead Stadium, Missouri',
      'Lumen Field, Washington',
      'BC Place, Vancouver'
    ];
    
    const matches = [];
    let matchId = 1000;
    const startDate = new Date('2026-06-11');
    
    // Generate group stage matches
    groups.forEach(group => {
      const teams = groupTeams[group];
      
      // Each team plays each other once
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const matchDate = new Date(startDate);
          matchDate.setDate(startDate.getDate() + matches.length % 10);
          
          matches.push({
            match_id: matchId++,
            external_id: `WC2026-${group}-${matchId}`,
            team_a: teams[i],
            team_b: teams[j],
            match_date: matchDate.toISOString(),
            venue: venues[matches.length % venues.length],
            group_name: `Group ${group}`,
            status: 'upcoming',
            competition_id: 21,
            season: 2026,
            odds_team_a: (1.8 + Math.random() * 0.6).toFixed(2),
            odds_draw: (3.0 + Math.random() * 0.8).toFixed(2),
            odds_team_b: (2.5 + Math.random() * 1.0).toFixed(2),
            api_data: {
              group: group,
              round: 'Group Stage',
              matchday: Math.floor(matches.length / 6) + 1
            }
          });
        }
      }
    });
    
    // Add knockout stage matches
    const knockoutRounds = [
      { name: 'Round of 16', count: 8 },
      { name: 'Quarter-finals', count: 4 },
      { name: 'Semi-finals', count: 2 },
      { name: 'Third Place', count: 1 },
      { name: 'Final', count: 1 }
    ];
    
    let knockoutDate = new Date('2026-07-01');
    
    knockoutRounds.forEach(round => {
      for (let i = 0; i < round.count; i++) {
        matches.push({
          match_id: matchId++,
          external_id: `WC2026-${round.name.replace(' ', '')}-${i+1}`,
          team_a: `Winner ${String.fromCharCode(65 + i)}`,
          team_b: `Runner-up ${String.fromCharCode(65 + (i + 1) % 8)}`,
          match_date: new Date(knockoutDate).toISOString(),
          venue: venues[i % venues.length],
          group_name: round.name,
          status: 'upcoming',
          competition_id: 21,
          season: 2026,
          odds_team_a: (1.5 + Math.random() * 0.5).toFixed(2),
          odds_draw: (3.5 + Math.random() * 0.5).toFixed(2),
          odds_team_b: (2.0 + Math.random() * 0.8).toFixed(2),
          api_data: {
            round: round.name,
            stage: 'Knockout'
          }
        });
        knockoutDate.setDate(knockoutDate.getDate() + 1);
      }
      knockoutDate.setDate(knockoutDate.getDate() + 2); // Gap between rounds
    });
    
    console.log(`✅ Generated ${matches.length} World Cup 2026 matches`);
    return matches;
  }

  // 5. TRANSFORM GAME DATA HELPER
  transformGameData(game) {
    return {
      match_id: game.GameId || this.generateUniqueId(),
      external_id: game.GameId || 0,
      team_a: game.HomeTeam || game.HomeTeamName || 'TBD',
      team_b: game.AwayTeam || game.AwayTeamName || 'TBD',
      match_date: game.DateTime || new Date().toISOString(),
      venue: game.Stadium || game.Venue || 'World Cup Stadium',
      group_name: game.Round || game.Stage || 'Group Stage',
      status: this.mapStatus(game.Status || 'Scheduled'),
      competition_id: 21,
      season: game.Season || 2026,
      odds_team_a: this.calculateDefaultOdds(1.8, 2.4),
      odds_draw: this.calculateDefaultOdds(3.0, 3.8),
      odds_team_b: this.calculateDefaultOdds(2.5, 4.0),
      api_data: {
        home_score: game.HomeTeamScore,
        away_score: game.AwayTeamScore,
        status: game.Status,
        round: game.Round,
        group: game.Group
      }
    };
  }

  // 6. FETCH UPCOMING MATCHES
  async fetchUpcomingMatches(days = 7) {
    try {
      const allMatches = await this.fetchWorldCupMatches();
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(now.getDate() + days);
      
      const upcoming = allMatches
        .filter(match => {
          const matchDate = new Date(match.match_date);
          return matchDate > now && matchDate <= endDate && match.status === 'upcoming';
        })
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
      
      console.log(`✅ Found ${upcoming.length} upcoming matches in next ${days} days`);
      return upcoming;
      
    } catch (error) {
      console.error('❌ Error fetching upcoming matches:', error.message);
      return [];
    }
  }

  // 7. FETCH GROUP STAGE MATCHES
  async fetchGroupStageMatches() {
    try {
      const allMatches = await this.fetchWorldCupMatches();
      const groups = {};
      
      allMatches.forEach(match => {
        if (match.group_name && match.group_name.includes('Group')) {
          const group = match.group_name;
          if (!groups[group]) {
            groups[group] = [];
          }
          
          groups[group].push({
            id: match.match_id,
            external_id: match.external_id,
            date: match.match_date,
            home_team: match.team_a,
            away_team: match.team_b,
            venue: match.venue,
            status: match.status,
            odds_team_a: match.odds_team_a,
            odds_draw: match.odds_draw,
            odds_team_b: match.odds_team_b,
            group: group
          });
        }
      });
      
      // Sort by date in each group
      Object.keys(groups).forEach(group => {
        groups[group].sort((a, b) => new Date(a.date) - new Date(b.date));
      });
      
      console.log(`📊 Found group stage matches in ${Object.keys(groups).length} groups`);
      return groups;
      
    } catch (error) {
      console.error('❌ Error fetching group stage:', error.message);
      return {};
    }
  }

  // 8. HELPER METHODS
  generateUniqueId() {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  calculateDefaultOdds(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  mapStatus(apiStatus) {
    const statusMap = {
      'Scheduled': 'upcoming',
      'InProgress': 'live',
      'Final': 'finished',
      'F/OT': 'finished',
      'F/SO': 'finished',
      'Postponed': 'cancelled',
      'Cancelled': 'cancelled',
      'Suspended': 'cancelled',
      'Abandoned': 'cancelled'
    };
    return statusMap[apiStatus] || 'upcoming';
  }

  // 9. HEALTH CHECK (Required by DataSyncService)
  async healthCheck() {
    try {
      const competitions = await this.fetchCompetitions();
      const worldCup = competitions.find(c => c.CompetitionId === 21);
      
      // Generate sample matches to check
      const sampleMatches = this.generateWorldCup2026Schedule();
      
      return {
        status: 'healthy',
        competitions: competitions.length,
        worldCupAvailable: !!worldCup,
        canGenerateSchedule: true,
        generatedMatches: sampleMatches.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        competitions: 0,
        worldCupAvailable: false,
        canGenerateSchedule: false,
        generatedMatches: 0
      };
    }
  }
}

module.exports = SportsDataService;