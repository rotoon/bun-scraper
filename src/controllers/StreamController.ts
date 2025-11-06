import { footballService } from '../services'
import { successResponse, badRequestResponse, internalServerErrorResponse, tooManyRequestsResponse } from '../response'
import type { GetStreamOptions } from '../streamExtractor'

export class StreamController {
  async handleGetStream(matchId: string, request: Request): Promise<Response> {
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

  async handleGetBatchStreams(request: Request): Promise<Response> {
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
}