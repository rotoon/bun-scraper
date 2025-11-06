import { footballService } from '../services'
import { successResponse } from '../response'

export class HealthController {
  private port: number

  constructor(port: number = 3000) {
    this.port = port
  }

  async handleHealthCheck(): Promise<Response> {
    const stats = await footballService.getStatistics()

    return successResponse({
      status: 'healthy',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        totalMatches: stats.totalMatches,
        lastUpdated: stats.lastUpdated
          ? new Date(stats.lastUpdated).toISOString()
          : null,
      },
    })
  }

  handleDocs(): Promise<Response> {
    const docs = {
      title: 'Football Matches API v2.0',
      version: '2.0.0',
      description:
        'RESTful API for football match data scraping and management',
      baseUrl: `http://localhost:${this.port}`,
      endpoints: [
        {
          path: '/api/matches',
          method: 'GET',
          description: 'Get paginated list of matches',
          parameters: {
            page: 'Page number (default: 1)',
            limit: 'Items per page (default: 20, max: 100)',
            status: 'Filter by status (live, upcoming, finished, unknown)',
            league: 'Filter by league name',
          },
        },
        {
          path: '/api/matches/live',
          method: 'GET',
          description: 'Get live matches only',
        },
        {
          path: '/api/matches/search',
          method: 'GET',
          description: 'Search matches by team name or league',
          parameters: {
            q: 'Search query string (required)',
          },
        },
        {
          path: '/api/stats',
          method: 'GET',
          description: 'Get database statistics',
        },
        {
          path: '/api/leagues',
          method: 'GET',
          description: 'Get list of available leagues',
        },
        {
          path: '/cron',
          method: 'POST',
          description: 'Execute scheduled scraping job (for Railway cron)',
        },
        {
          path: '/api/refresh',
          method: 'POST',
          description: 'Manually refresh data from source',
        },
        {
          path: '/api/clean',
          method: 'POST',
          description: 'Clean old matches from database',
          parameters: {
            hours: 'Delete matches older than specified hours (default: 24)',
          },
        },
        {
          path: '/api/stream/:matchId',
          method: 'GET',
          description: 'Get iframe stream URL for a specific match',
          parameters: {
            matchId: 'Match ID from the matches list (required)',
          },
        },
        {
          path: '/api/streams/batch',
          method: 'POST',
          description: 'Get iframe stream URLs for multiple matches',
          body: {
            matchIds: 'Array of match IDs',
            options: 'Optional configuration (timeout, retries, etc.)',
          },
        },
        {
          path: '/api/matches/live/streams',
          method: 'GET',
          description: 'Get live matches with stream availability status',
        },
      ],
      examples: {
        getMatches: `GET /api/matches?page=1&limit=10&status=live`,
        searchMatches: `GET /api/matches/search?q=manchester`,
        liveMatches: `GET /api/matches/live`,
        getStats: `GET /api/stats`,
      },
    }

    return Promise.resolve(successResponse(docs, 'API Documentation'))
  }
}