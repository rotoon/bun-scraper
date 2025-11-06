import {
  optionsResponse,
  notFoundResponse,
  internalServerErrorResponse,
} from './response'
import { HealthController } from './controllers/HealthController'
import { MatchesController } from './controllers/MatchesController'
import { CronController } from './controllers/CronController'
import { StreamController } from './controllers/StreamController'

// Main server class
export class FootballAPIServer {
  private port: number
  private server: any
  private healthController: HealthController
  private matchesController: MatchesController
  private cronController: CronController
  private streamController: StreamController

  constructor(port: number = 3000) {
    this.port = port
    this.healthController = new HealthController(port)
    this.matchesController = new MatchesController()
    this.cronController = new CronController()
    this.streamController = new StreamController()
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
          return this.healthController.handleHealthCheck()

        // API Documentation
        case url.pathname === '/docs' && method === 'GET':
          return this.healthController.handleDocs()

        // Matches endpoints - API v1
        case url.pathname === '/api/v1/matches' && method === 'GET':
          return this.matchesController.handleGetMatches(req, url)

        case url.pathname === '/api/v1/matches/live' && method === 'GET':
          return this.matchesController.handleGetLiveMatches()

        case url.pathname === '/api/v1/matches/search' && method === 'GET':
          return this.matchesController.handleSearchMatches(url)

        case url.pathname === '/api/v1/matches/live/streams' &&
          method === 'GET':
          return this.matchesController.handleGetLiveMatchesWithStreams()

        // Statistics endpoint
        case url.pathname === '/api/v1/stats' && method === 'GET':
          return this.matchesController.handleGetStats()

        // Leagues endpoint
        case url.pathname === '/api/v1/leagues' && method === 'GET':
          return this.matchesController.handleGetLeagues()

        // Legacy API endpoints (for backward compatibility)
        case url.pathname === '/api/matches' && method === 'GET':
          return this.matchesController.handleGetMatches(req, url)

        case url.pathname === '/api/matches/live' && method === 'GET':
          return this.matchesController.handleGetLiveMatches()

        case url.pathname === '/api/matches/search' && method === 'GET':
          return this.matchesController.handleSearchMatches(url)

        case url.pathname === '/api/matches/live/streams' && method === 'GET':
          return this.matchesController.handleGetLiveMatchesWithStreams()

        case url.pathname === '/api/stats' && method === 'GET':
          return this.matchesController.handleGetStats()

        case url.pathname === '/api/leagues' && method === 'GET':
          return this.matchesController.handleGetLeagues()

        // Cron job endpoint (for Railway)
        case url.pathname === '/cron' && method === 'POST':
          return this.cronController.handleCronJob()

        // Data management endpoints - API v1
        case url.pathname === '/api/v1/refresh' && method === 'POST':
          return this.cronController.handleRefreshData()

        case url.pathname === '/api/v1/clean' && method === 'POST':
          return this.cronController.handleCleanData(url)

        // Stream endpoints - API v1
        case url.pathname.startsWith('/api/v1/stream/') && method === 'GET':
          const matchId = url.pathname.split('/').pop()
          return this.streamController.handleGetStream(matchId!, req)

        case url.pathname === '/api/v1/streams/batch' && method === 'POST':
          return this.streamController.handleGetBatchStreams(req)

        // Legacy endpoints (for backward compatibility)
        case url.pathname === '/api/refresh' && method === 'POST':
          return this.cronController.handleRefreshData()

        case url.pathname === '/api/clean' && method === 'POST':
          return this.cronController.handleCleanData(url)

        case url.pathname.startsWith('/api/stream/') && method === 'GET':
          const legacyMatchId = url.pathname.split('/').pop()
          return this.streamController.handleGetStream(legacyMatchId!, req)

        case url.pathname === '/api/streams/batch' && method === 'POST':
          return this.streamController.handleGetBatchStreams(req)

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

  stop(): void {
    if (this.server) {
      this.server.stop()
    }
  }
}
