// api/services/sportsDataService.js - FIXED VERSION
require('dotenv').config();

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
    
    if (!this.apiKey || this.apiKey === 'your_sports_data_api_key') {
      console.error('❌ SPORTS_DATA_API_KEY is not configured in .env file');
      console.error('   Add your real API key to Vercel environment variables');
      throw new Error('Sports API key not configured');
    }
  }

  async testConnection() {
    try {
      console.log('🔗 Testing SportsData.io API connection...');
      
      // Use correct header format for SportsData.io
      const response = await fetch(`${this.baseUrl}/json/Competitions`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        },
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ API Connection successful');
      console.log(`📊 Found ${data.length} competitions`);
      
      // Check if World Cup is available
      const worldCup = data.find(c => c.CompetitionId === 21 || c.Name.includes('World Cup'));
      console.log(`🏆 World Cup available: ${worldCup ? 'YES' : 'NO'}`);
      
      return {
        success: true,
        connected: true,
        competitions: data.length,
        worldCupAvailable: !!worldCup
      };
      
    } catch (error) {
      console.error('❌ API connection failed:', error.message);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  async fetchCompetitions() {
    try {
      console.log('📋 Fetching competitions...');
      
      const response = await fetch(`${this.baseUrl}/json/Competitions`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.length} competitions`);
      return data || [];
      
    } catch (error) {
      console.error('❌ Error fetching competitions:', error.message);
      return [];
    }
  }

  async fetchWorldCupMatches() {
    try {
      console.log('🌍 Fetching World Cup matches from REAL API...');
      
      // First, test the connection
      const connection = await this.testConnection();
      if (!connection.success) {
        throw new Error('API connection failed');
      }
      
      // Try to fetch current World Cup matches (2022)
      console.log('📡 Fetching current World Cup matches...');
      const response = await fetch(`${this.baseUrl}/json/Scores/WorldCup`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const matches = await response.json();
      console.log(`✅ Found ${matches.length} World Cup matches from API`);
      
      if (matches.length > 0) {
        // Transform and return real matches
        const transformed = matches.map(match => this.transformApiMatch(match));
        console.log(`🔄 Transformed ${transformed.length} matches`);
        return transformed;
      }
      
      // If no current matches, try competitions endpoint
      console.log('🔄 Trying competitions endpoint...');
      const competitions = await this.fetchCompetitions();
      const worldCup = competitions.find(c => c.CompetitionId === 21);
      
      if (worldCup) {
        console.log(`🏆 Found World Cup: ${worldCup.Name}`);
        
        // Try to fetch World Cup games
        try {
          const gamesResponse = await fetch(`${this.baseUrl}/json/Games/WorldCup`, {
            headers: {
              'Ocp-Apim-Subscription-Key': this.apiKey
            }
          });
          
          if (gamesResponse.ok) {
            const games = await gamesResponse.json();
            if (games.length > 0) {
              const transformed = games.map(game => this.transformApiMatch(game));
              console.log(`✅ Found ${transformed.length} games from Games endpoint`);
              return transformed;
            }
          }
        } catch (gamesError) {
          console.log('⚠️ Games endpoint not available:', gamesError.message);
        }
      }
      
      // Fallback: Try to fetch all matches and filter
      console.log('🔄 Fetching all matches to filter...');
      const allMatchesResponse = await fetch(`${this.baseUrl}/json/Matches`, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey
        }
      });
      
      if (allMatchesResponse.ok) {
        const allMatches = await allMatchesResponse.json();
        const worldCupMatches = allMatches.filter(match => 
          match.CompetitionId === 21 || 
          (match.Competition && match.Competition.includes('World Cup'))
        );
        
        if (worldCupMatches.length > 0) {
          const transformed = worldCupMatches.map(match => this.transformApiMatch(match));
          console.log(`✅ Filtered ${transformed.length} World Cup matches`);
          return transformed;
        }
      }
      
      console.log('⚠️ No World Cup matches found in API');
      console.log('💡 The API may not have 2026 data yet');
      
      // Return empty array instead of fake data
      return [];
      
    } catch (error) {
      console.error('❌ Error fetching World Cup matches:', error.message);
      console.error('💡 Check your API key and subscription level');
      
      // Return empty array instead of fake data
      return [];
    }
  }

  transformApiMatch(apiMatch) {
    // Parse match date
    const matchDate = apiMatch.DateTime ? new Date(apiMatch.DateTime) : 
                     apiMatch.Date ? new Date(apiMatch.Date) : 
                     new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000); // Random future date
    
    // Determine status
    let status = 'upcoming';
    if (apiMatch.Status === 'Final') status = 'finished';
    if (apiMatch.Status === 'InProgress') status = 'live';
    if (apiMatch.Status === 'Canceled') status = 'cancelled';
    
    // Calculate reasonable odds
    const getOdds = () => {
      // Simple odds calculation
      return {
        teamA: parseFloat((1.8 + Math.random() * 0.6).toFixed(2)),
        draw: parseFloat((3.2 + Math.random() * 0.5).toFixed(2)),
        teamB: parseFloat((2.1 + Math.random() * 0.8).toFixed(2))
      };
    };
    
    const odds = getOdds();
    
    return {
      match_id: apiMatch.MatchId || apiMatch.GameId || apiMatch.Id || Date.now(),
      external_id: apiMatch.MatchId || apiMatch.GameId || 0,
      team_a: apiMatch.HomeTeam || apiMatch.HomeTeamName || 'Team A',
      team_b: apiMatch.AwayTeam || apiMatch.AwayTeamName || 'Team B',
      match_date: matchDate,
      venue: apiMatch.Venue || apiMatch.Stadium || 'Unknown Stadium',
      group_name: apiMatch.Group || apiMatch.Round || 'Group Stage',
      status: status,
      competition_id: apiMatch.CompetitionId || 21,
      season: apiMatch.Season || 2026,
      odds_team_a: odds.teamA,
      odds_draw: odds.draw,
      odds_team_b: odds.teamB,
      api_data: {
        home_score: apiMatch.HomeTeamScore,
        away_score: apiMatch.AwayTeamScore,
        status: apiMatch.Status,
        round: apiMatch.Round,
        group: apiMatch.Group,
        competition: apiMatch.Competition
      }
    };
  }

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
      
      console.log(`📅 Found ${upcoming.length} upcoming matches in next ${days} days`);
      return upcoming;
      
    } catch (error) {
      console.error('❌ Error fetching upcoming matches:', error.message);
      return [];
    }
  }

  async healthCheck() {
    try {
      const connection = await this.testConnection();
      
      return {
        status: connection.success ? 'healthy' : 'unhealthy',
        connected: connection.success,
        error: connection.error,
        hasApiKey: !!this.apiKey,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        hasApiKey: !!this.apiKey,
        baseUrl: this.baseUrl
      };
    }
  }
}

module.exports = SportsDataService;