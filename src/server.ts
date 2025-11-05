import { footballService } from './services'
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalServerErrorResponse,
  tooManyRequestsResponse,
  optionsResponse,
  parseQueryParams,
  validateQueryParams,
} from './response'
import type { CronJobResult } from './types'
import type { GetStreamOptions } from './streamExtractor'

// Main server class
export class FootballAPIServer {
  private port: number
  private server: any

  constructor(port: number = 3000) {
    this.port = port
  }

  start(): void {
    this.server = Bun.serve({
      port: this.port,
      fetch: async (req) => this.handleRequest(req),
      error(error: Error) {
        console.error('Server error:', error)
        return internalServerErrorResponse('Internal server error')
      },
    })

    console.log(`🚀 Football API Server v2.0`)
    console.log(`📍 Server running on http://localhost:${this.port}`)
    console.log(`📖 API Documentation: http://localhost:${this.port}/docs`)
    console.log(`🏥 Health Check: http://localhost:${this.port}/health`)
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const method = req.method

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return optionsResponse()
    }

    // Route handling
    try {
      switch (true) {
        // Health Check
        case url.pathname === '/health' && method === 'GET':
          return this.handleHealthCheck()

        // API Documentation
        case url.pathname === '/docs' && method === 'GET':
          return this.handleDocs()

        // Matches endpoints
        case url.pathname === '/api/matches' && method === 'GET':
          return this.handleGetMatches(req, url)

        case url.pathname === '/api/matches/live' && method === 'GET':
          return this.handleGetLiveMatches()

        case url.pathname === '/api/matches/search' && method === 'GET':
          return this.handleSearchMatches(url)

        // Statistics endpoint
        case url.pathname === '/api/stats' && method === 'GET':
          return this.handleGetStats()

        // Leagues endpoint
        case url.pathname === '/api/leagues' && method === 'GET':
          return this.handleGetLeagues()

        // Cron job endpoint (for Railway)
        case url.pathname === '/cron' && method === 'POST':
          return this.handleCronJob()

        // Data management endpoints
        case url.pathname === '/api/refresh' && method === 'POST':
          return this.handleRefreshData()

        case url.pathname === '/api/clean' && method === 'POST':
          return this.handleCleanData(url)

        // Stream endpoints
        case url.pathname.startsWith('/api/stream/') && method === 'GET':
          const matchId = url.pathname.split('/').pop()
          return this.handleGetStream(matchId!, req)

        case url.pathname === '/api/streams/batch' && method === 'POST':
          return this.handleGetBatchStreams(req)

        case url.pathname === '/api/matches/live/streams' && method === 'GET':
          return this.handleGetLiveMatchesWithStreams()

        // Default response
        default:
          return notFoundResponse(
            `Endpoint ${method} ${url.pathname} not found`
          )
      }
    } catch (error) {
      console.error('Request handling error:', error)
      return internalServerErrorResponse(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  private async handleHealthCheck(): Promise<Response> {
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

  private handleDocs(): Promise<Response> {
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
            limit: 'Items per page (default: 999, max: 999)',
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

  private async handleGetMatches(req: Request, url: URL): Promise<Response> {
    // Parse and validate query parameters
    const params = parseQueryParams(url, {
      page: 1,
      limit: 999,
    })

    const errors = validateQueryParams(params)
    if (errors.length > 0) {
      return badRequestResponse('Invalid query parameters', errors)
    }

    try {
      const result = await footballService.getMatches(
        params.page,
        params.limit,
        params.status,
        params.league
      )

      return successResponse(
        result.matches,
        `Retrieved ${result.matches.length} matches`,
        result.pagination
      )
    } catch (error) {
      console.error('Error getting matches:', error)
      return internalServerErrorResponse('Failed to retrieve matches')
    }
  }

  private async handleGetLiveMatches(): Promise<Response> {
    try {
      const matches = await footballService.getLiveMatches()
      return successResponse(
        matches,
        `Retrieved ${matches.length} live matches`
      )
    } catch (error) {
      console.error('Error getting live matches:', error)
      return internalServerErrorResponse('Failed to retrieve live matches')
    }
  }

  private async handleSearchMatches(url: URL): Promise<Response> {
    const query = url.searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return badRequestResponse(
        'Search query must be at least 2 characters long'
      )
    }

    try {
      const matches = await footballService.searchMatches(query.trim())
      return successResponse(
        matches,
        `Found ${matches.length} matches matching "${query}"`
      )
    } catch (error) {
      console.error('Error searching matches:', error)
      return internalServerErrorResponse('Failed to search matches')
    }
  }

  private async handleGetStats(): Promise<Response> {
    try {
      const stats = await footballService.getStatistics()
      return successResponse(stats, 'Database statistics retrieved')
    } catch (error) {
      console.error('Error getting stats:', error)
      return internalServerErrorResponse('Failed to retrieve statistics')
    }
  }

  private async handleGetLeagues(): Promise<Response> {
    try {
      const leagues = await footballService.getLeagues()
      return successResponse(leagues, `Retrieved ${leagues.length} leagues`)
    } catch (error) {
      console.error('Error getting leagues:', error)
      return internalServerErrorResponse('Failed to retrieve leagues')
    }
  }

  private async handleCronJob(): Promise<Response> {
    try {
      const result: CronJobResult = await footballService.executeCronJob()

      if (result.success) {
        return successResponse(result, result.message)
      } else {
        return internalServerErrorResponse(result.message)
      }
    } catch (error) {
      console.error('Error executing cron job:', error)
      return internalServerErrorResponse('Failed to execute cron job')
    }
  }

  private async handleRefreshData(): Promise<Response> {
    try {
      const result = await footballService.refreshData()

      if (result.success) {
        return successResponse(result, result.message)
      } else {
        return internalServerErrorResponse(
          result.message || 'Failed to refresh data'
        )
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
      return internalServerErrorResponse('Failed to refresh data')
    }
  }

  private async handleCleanData(url: URL): Promise<Response> {
    const params = parseQueryParams(url, { hours: 24 })
    const errors = validateQueryParams(params)

    if (errors.length > 0) {
      return badRequestResponse('Invalid query parameters', errors)
    }

    try {
      const result = await footballService.cleanOldMatches(params.hours)
      return successResponse(result, result.message)
    } catch (error) {
      console.error('Error cleaning data:', error)
      return internalServerErrorResponse('Failed to clean old matches')
    }
  }

  private async handleGetStream(matchId: string, request: Request): Promise<Response> {
    if (!matchId) {
      return badRequestResponse('Match ID is required')
    }

    try {
      // Get client IP for rate limiting
      const clientIP =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'

      const result = await footballService.getMatchStream(matchId, {}, clientIP)

      if (result.success) {
        return successResponse(result, 'Stream URL retrieved successfully')
      } else {
        if (result.error === 'Rate limit exceeded') {
          return tooManyRequestsResponse(result.message || 'Rate limit exceeded')
        } else if (result.error === 'Invalid Match ID') {
          return badRequestResponse(result.message || 'Invalid match ID')
        } else {
          return internalServerErrorResponse(result.message || 'Failed to fetch stream')
        }
      }
    } catch (error) {
      console.error('Error getting stream:', error)
      return internalServerErrorResponse('Failed to fetch stream URL')
    }
  }

  private async handleGetBatchStreams(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { matchIds?: string[], options?: GetStreamOptions }

      if (!body.matchIds || !Array.isArray(body.matchIds)) {
        return badRequestResponse('matchIds array is required')
      }

      if (body.matchIds.length === 0) {
        return badRequestResponse('At least one match ID is required')
      }

      if (body.matchIds.length > 10) {
        return badRequestResponse('Maximum 10 match IDs allowed per request')
      }

      // Get client IP for rate limiting
      const clientIP =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown'

      const options: GetStreamOptions = {
        timeout: body.options?.timeout || 15000,
        maxRetries: body.options?.maxRetries || 2,
        userAgent: body.options?.userAgent
      }

      const results = await footballService.getMultipleMatchStreams(
        body.matchIds,
        options,
        clientIP
      )

      const successCount = results.filter(r => r.success).length
      const message = `Processed ${results.length} requests, ${successCount} successful`

      return successResponse({ results, summary: { total: results.length, successful: successCount } }, message)
    } catch (error) {
      console.error('Error getting batch streams:', error)
      return badRequestResponse('Invalid request body or failed to process streams')
    }
  }

  private async handleGetLiveMatchesWithStreams(): Promise<Response> {
    try {
      const matches = await footballService.getLiveMatchesWithStreams()
      return successResponse(matches, `Retrieved ${matches.length} live matches with stream status`)
    } catch (error) {
      console.error('Error getting live matches with streams:', error)
      return internalServerErrorResponse('Failed to retrieve live matches with stream status')
    }
  }

  stop(): void {
    if (this.server) {
      this.server.stop()
    }
  }
}
