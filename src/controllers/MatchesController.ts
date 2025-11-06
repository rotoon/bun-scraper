import { footballService } from '../services'
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
  parseQueryParams,
  validateQueryParams,
} from '../response'

export class MatchesController {
  async handleGetMatches(req: Request, url: URL): Promise<Response> {
    // Parse and validate query parameters
    const params = parseQueryParams(url, {
      page: 1,
      limit: 20,
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

  async handleGetLiveMatches(): Promise<Response> {
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

  async handleSearchMatches(url: URL): Promise<Response> {
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

  async handleGetStats(): Promise<Response> {
    try {
      const stats = await footballService.getStatistics()
      return successResponse(stats, 'Database statistics retrieved')
    } catch (error) {
      console.error('Error getting stats:', error)
      return internalServerErrorResponse('Failed to retrieve statistics')
    }
  }

  async handleGetLeagues(): Promise<Response> {
    try {
      const leagues = await footballService.getLeagues()
      return successResponse(leagues, `Retrieved ${leagues.length} leagues`)
    } catch (error) {
      console.error('Error getting leagues:', error)
      return internalServerErrorResponse('Failed to retrieve leagues')
    }
  }

  async handleGetLiveMatchesWithStreams(): Promise<Response> {
    try {
      const matches = await footballService.getLiveMatchesWithStreams()
      return successResponse(matches, `Retrieved ${matches.length} live matches with stream status`)
    } catch (error) {
      console.error('Error getting live matches with streams:', error)
      return internalServerErrorResponse('Failed to retrieve live matches with streams')
    }
  }
}