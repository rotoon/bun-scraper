import { db } from './database'
import { scraper } from './scraper'
import { getIframeUrl, getMultipleIframeUrls, checkStreamAvailability, type StreamResponse, type GetStreamOptions } from './streamExtractor'
import type { Match, MatchStatus, CronJobResult, DatabaseResult, MatchQueryParams, MatchSortField, SortOrder } from './types'

export class FootballService {
  // Get matches with advanced filtering and pagination
  async getMatches(params: MatchQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      league,
      dateFrom,
      dateTo,
      team,
      sort = 'date',
      order = 'desc'
    } = params

    // Get all matches (we'll apply filters in memory for now)
    const { matches: allMatches } = db.getMatches(9999) // Get all matches

    // Apply filters
    let filteredMatches = [...allMatches]

    // Filter by status
    if (status) {
      filteredMatches = filteredMatches.filter(match => match.status === status)
    }

    // Filter by league
    if (league) {
      filteredMatches = filteredMatches.filter(match =>
        match.league.toLowerCase().includes(league.toLowerCase())
      )
    }

    // Filter by date range
    if (dateFrom) {
      filteredMatches = filteredMatches.filter(match => match.matchDate >= dateFrom)
    }

    if (dateTo) {
      filteredMatches = filteredMatches.filter(match => match.matchDate <= dateTo)
    }

    // Filter by team name
    if (team) {
      const teamLower = team.toLowerCase()
      filteredMatches = filteredMatches.filter(match =>
        match.teams.some(team => team.name.toLowerCase().includes(teamLower)) ||
        match.teamsDisplay.toLowerCase().includes(teamLower) ||
        match.matchTitle.toLowerCase().includes(teamLower)
      )
    }

    // Apply sorting
    filteredMatches = this.sortMatches(filteredMatches, sort as MatchSortField, order as SortOrder)

    // Apply pagination
    const offset = (page - 1) * limit
    const paginatedMatches = filteredMatches.slice(offset, offset + limit)
    const total = filteredMatches.length

    return {
      matches: paginatedMatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
      total,
      filters: {
        status,
        league,
        dateFrom,
        dateTo,
        team,
        sort,
        order
      }
    }
  }

  // Sort matches based on field and order
  private sortMatches(matches: Match[], sortField: MatchSortField, order: SortOrder): Match[] {
    const multiplier = order === 'asc' ? 1 : -1

    return matches.sort((a, b) => {
      switch (sortField) {
        case 'date':
          // Sort by matchDate and matchTime combined
          const dateA = new Date(`${a.matchDate} ${a.matchTime}`).getTime()
          const dateB = new Date(`${b.matchDate} ${b.matchTime}`).getTime()
          return multiplier * (dateA - dateB)

        case 'league':
          return multiplier * a.league.localeCompare(b.league)

        case 'status':
          // Custom status ordering: live > upcoming > finished > unknown
          const statusOrder = { 'live': 3, 'upcoming': 2, 'finished': 1, 'unknown': 0 }
          const statusA = statusOrder[a.status] || 0
          const statusB = statusOrder[b.status] || 0
          return multiplier * (statusA - statusB)

        default:
          return multiplier * a.matchDate.localeCompare(b.matchDate)
      }
    })
  }

  // Get live matches only
  async getLiveMatches() {
    const { matches } = db.getMatches(undefined, 'live')
    return matches
  }

  // Get matches by date range
  async getMatchesByDateRange(dateFrom: string, dateTo: string) {
    // This would require adding date range queries to the database module
    // For now, return all matches (frontend can filter)
    const { matches } = db.getMatches()
    return matches.filter(
      (match) => match.matchDate >= dateFrom && match.matchDate <= dateTo
    )
  }

  // Get statistics
  async getStatistics() {
    return db.getStats()
  }

  // Refresh data (scrape and save)
  async refreshData(): Promise<DatabaseResult> {
    try {
      const startTime = Date.now()

      // Scrape fresh data
      const matches = await scraper.scrapeMatches()

      // Save to database (clears old data)
      const result = db.saveMatches(matches)

      const executionTime = Date.now() - startTime

      return {
        ...result,
        message: `${result.message} in ${executionTime}ms`,
      }
    } catch (error) {
      return {
        success: false,
        inserted: 0,
        deleted: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Execute cron job (scrape + save)
  async executeCronJob(): Promise<CronJobResult> {
    const startTime = Date.now()

    try {
      console.log(
        `[${new Date().toISOString()}] Starting cron job execution...`
      )

      // Scrape matches
      const matches = await scraper.scrapeMatches()
      console.log(
        `[${new Date().toISOString()}] Scraped ${matches.length} matches`
      )

      // Save to database
      const saveResult = db.saveMatches(matches)

      if (saveResult.success) {
        const executionTime = Date.now() - startTime
        console.log(
          `[${new Date().toISOString()}] Cron job completed successfully`
        )

        return {
          success: true,
          message: `Successfully scraped and saved ${matches.length} matches`,
          matchesScraped: matches.length,
          inserted: saveResult.inserted,
          deleted: saveResult.deleted,
          executionTime,
          timestamp: new Date().toISOString(),
        }
      } else {
        throw new Error(saveResult.message || 'Failed to save matches')
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error(`[${new Date().toISOString()}] Cron job failed:`, error)

      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Clean old matches
  async cleanOldMatches(
    hoursOld: number = 24
  ): Promise<{ deleted: number; message: string }> {
    try {
      const deletedCount = db.cleanOldMatches(hoursOld)

      return {
        deleted: deletedCount,
        message: `Cleaned ${deletedCount} old matches (older than ${hoursOld} hours)`,
      }
    } catch (error) {
      return {
        deleted: 0,
        message: `Failed to clean old matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  // Get unique leagues
  async getLeagues(): Promise<string[]> {
    // This would require adding a distinct query to the database module
    const { matches } = db.getMatches(1000) // Get recent matches to determine leagues
    const leagues = [...new Set(matches.map((match) => match.league))]
    return leagues.sort()
  }

  // Search matches by team name
  async searchMatches(query: string): Promise<Match[]> {
    const { matches } = db.getMatches(100) // Get recent matches
    const searchTerm = query.toLowerCase()

    return matches.filter(
      (match) =>
        match.teams[0]?.name?.toLowerCase().includes(searchTerm) ||
        match.teams[1]?.name?.toLowerCase().includes(searchTerm) ||
        match.matchTitle.toLowerCase().includes(searchTerm) ||
        match.league.toLowerCase().includes(searchTerm)
    )
  }

  // Get iframe URL for a specific match
  async getMatchStream(
    matchId: string,
    options?: GetStreamOptions,
    clientIdentifier: string = "api"
  ): Promise<StreamResponse> {
    return await getIframeUrl(matchId, options, clientIdentifier)
  }

  // Get iframe URLs for multiple matches
  async getMultipleMatchStreams(
    matchIds: string[],
    options?: GetStreamOptions,
    clientIdentifier: string = "batch"
  ): Promise<StreamResponse[]> {
    return await getMultipleIframeUrls(matchIds, options, clientIdentifier)
  }

  // Check if a match has available stream
  async isStreamAvailable(matchId: string): Promise<boolean> {
    return await checkStreamAvailability(matchId)
  }

  // Get live matches with stream availability
  async getLiveMatchesWithStreams(): Promise<Match[]> {
    const liveMatches = await this.getLiveMatches()

    // Check stream availability for each live match (in parallel with rate limiting)
    const matchesWithStreams = await Promise.all(
      liveMatches.map(async (match) => {
        const hasStream = await this.isStreamAvailable(match.matchId)
        return {
          ...match,
          hasStream
        }
      })
    )

    return matchesWithStreams
  }

  // Get matches by ID (useful for stream extraction)
  async getMatchById(matchId: string): Promise<Match | null> {
    const { matches } = db.getMatches(1)
    return matches.find(match => match.matchId === matchId) || null
  }
}

// Export singleton instance
export const footballService = new FootballService()
