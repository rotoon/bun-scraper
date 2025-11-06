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
          path: '/api/v1/matches',
          method: 'GET',
          description: 'Get paginated list of matches with advanced filtering',
          parameters: {
            page: 'Page number (default: 1, min: 1, max: 1000)',
            limit: 'Items per page (default: 20, min: 1, max: 999)',
            status: 'Filter by status (live, upcoming, finished, unknown)',
            league: 'Filter by league name (case-insensitive partial match)',
            dateFrom: 'Filter matches from this date (format: YYYY-MM-DD)',
            dateTo: 'Filter matches until this date (format: YYYY-MM-DD)',
            team: 'Filter by team name (case-insensitive, min: 2, max: 100 characters)',
            sort: 'Sort field (default: date) - values: date, league, status',
            order: 'Sort order (default: desc) - values: asc, desc',
          },
        },
        {
          path: '/api/v1/matches/live',
          method: 'GET',
          description: 'Get live matches only (cached for 30 seconds)',
        },
        {
          path: '/api/v1/matches/search',
          method: 'GET',
          description: 'Search matches by team name or league',
          parameters: {
            q: 'Search query string (required, minimum 2 characters)',
          },
        },
        {
          path: '/api/v1/stats',
          method: 'GET',
          description: 'Get database statistics (cached for 10 minutes)',
        },
        {
          path: '/api/v1/leagues',
          method: 'GET',
          description: 'Get list of available leagues (cached for 1 hour)',
        },
        {
          path: '/api/v1/matches/live/streams',
          method: 'GET',
          description: 'Get live matches with stream availability status',
        },
        {
          path: '/api/v1/refresh',
          method: 'POST',
          description: 'Manually refresh data from source',
        },
        {
          path: '/api/v1/clean',
          method: 'POST',
          description: 'Clean old matches from database',
          parameters: {
            hours: 'Delete matches older than specified hours (default: 24, min: 1, max: 168)',
          },
        },
        {
          path: '/api/v1/stream/:matchId',
          method: 'GET',
          description: 'Get iframe stream URL for a specific match',
          parameters: {
            matchId: 'Match ID from the matches list (required)',
          },
        },
        {
          path: '/api/v1/streams/batch',
          method: 'POST',
          description: 'Get iframe stream URLs for multiple matches',
          body: {
            matchIds: 'Array of match IDs',
          },
        },
        {
          path: '/cron',
          method: 'POST',
          description: 'Execute scheduled scraping job (for Railway cron)',
        },
      ],
      examples: {
        getMatches: `GET /api/v1/matches?page=1&limit=10&status=live`,
        searchMatches: `GET /api/v1/matches/search?q=manchester`,
        liveMatches: `GET /api/v1/matches/live`,
        getStats: `GET /api/v1/stats`,
        advancedFilter: `GET /api/v1/matches?league=Premier%20League&team=Manchester&status=live&sort=date&order=asc`,
        dateRange: `GET /api/v1/matches?dateFrom=2024-01-01&dateTo=2024-01-31`,
        streamExample: `GET /api/v1/stream/match123`,
        batchStreams: `POST /api/v1/streams/batch`,
      },
    }

    return Promise.resolve(successResponse(docs, 'API Documentation'))
  }
}