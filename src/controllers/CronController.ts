import { footballService } from '../services'
import { successResponse, internalServerErrorResponse, badRequestResponse, parseQueryParams, validateQueryParams } from '../response'
import type { CronJobResult } from '../types'

export class CronController {
  async handleCronJob(): Promise<Response> {
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

  async handleRefreshData(): Promise<Response> {
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

  async handleCleanData(url: URL): Promise<Response> {
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
}