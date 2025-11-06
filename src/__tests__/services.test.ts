import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { Match, MatchQueryParams } from '../types'

// Mock matches data for testing
const mockMatches: Match[] = [
  {
    id: 1,
    matchId: 'match1',
    matchTime: '19:00',
    matchDate: '2024-01-15',
    teams: [
      { name: 'Manchester United', logo: null },
      { name: 'Liverpool', logo: null }
    ],
    league: 'Premier League',
    matchTitle: 'Manchester United vs Liverpool',
    teamsDisplay: 'Manchester United vs Liverpool',
    datePlay: '2024-01-15',
    streamUrl: 'http://example.com/stream1',
    timestamp: '2024-01-15T19:00:00Z',
    status: 'live',
    scrapedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 2,
    matchId: 'match2',
    matchTime: '21:00',
    matchDate: '2024-01-16',
    teams: [
      { name: 'Barcelona', logo: null },
      { name: 'Real Madrid', logo: null }
    ],
    league: 'La Liga',
    matchTitle: 'Barcelona vs Real Madrid',
    teamsDisplay: 'Barcelona vs Real Madrid',
    datePlay: '2024-01-16',
    streamUrl: 'http://example.com/stream2',
    timestamp: '2024-01-16T21:00:00Z',
    status: 'upcoming',
    scrapedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 3,
    matchId: 'match3',
    matchTime: '18:00',
    matchDate: '2024-01-14',
    teams: [
      { name: 'Bayern Munich', logo: null },
      { name: 'PSG', logo: null }
    ],
    league: 'Champions League',
    matchTitle: 'Bayern Munich vs PSG',
    teamsDisplay: 'Bayern Munich vs PSG',
    datePlay: '2024-01-14',
    streamUrl: 'http://example.com/stream3',
    timestamp: '2024-01-14T18:00:00Z',
    status: 'finished',
    scrapedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 4,
    matchId: 'match4',
    matchTime: '20:00',
    matchDate: '2024-01-17',
    teams: [
      { name: 'Manchester City', logo: null },
      { name: 'Chelsea', logo: null }
    ],
    league: 'Premier League',
    matchTitle: 'Manchester City vs Chelsea',
    teamsDisplay: 'Manchester City vs Chelsea',
    datePlay: '2024-01-17',
    streamUrl: 'http://example.com/stream4',
    timestamp: '2024-01-17T20:00:00Z',
    status: 'upcoming',
    scrapedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

// Mock the database module before importing
const mockDatabaseModule = {
  getMatches: mock((limit?: number, status?: string, league?: string, offset?: number) => {
    let filtered = [...mockMatches]

    if (status) {
      filtered = filtered.filter(match => match.status === status)
    }

    if (league) {
      filtered = filtered.filter(match => match.league === league)
    }

    return {
      matches: filtered,
      total: filtered.length
    }
  })
}

// Mock the database service
const mockDatabaseService = {
  getMatches: mockDatabaseModule.getMatches
}

describe('FootballService - Advanced Filtering', () => {
  let service: any

  beforeEach(() => {
    // Mock the database module
    const dbModule = mock.module('../database', () => ({
      db: mockDatabaseService,
      DatabaseService: class MockDatabaseService {
        getMatches = mockDatabaseModule.getMatches
      }
    }))

    // Import the service after mocking
    const { FootballService } = require('../services')
    service = new FootballService()
  })

  describe('getMatches with filters', () => {
    it('should return all matches with default parameters', async () => {
      const result = await service.getMatches()

      expect(result.matches).toHaveLength(4)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(result.pagination.total).toBe(4)
    })

    it('should filter by status', async () => {
      const params: MatchQueryParams = { status: 'live' }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].status).toBe('live')
      expect(result.filters.status).toBe('live')
    })

    it('should filter by league', async () => {
      const params: MatchQueryParams = { league: 'Premier League' }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.matches.every(match => match.league === 'Premier League')).toBe(true)
      expect(result.filters.league).toBe('Premier League')
    })

    it('should filter by date range', async () => {
      const params: MatchQueryParams = {
        dateFrom: '2024-01-15',
        dateTo: '2024-01-16'
      }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.matches.every(match =>
        match.matchDate >= '2024-01-15' && match.matchDate <= '2024-01-16'
      )).toBe(true)
    })

    it('should filter by team name', async () => {
      const params: MatchQueryParams = { team: 'Manchester' }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.matches.every(match =>
        match.teamsDisplay.includes('Manchester')
      )).toBe(true)
    })

    it('should apply multiple filters', async () => {
      const params: MatchQueryParams = {
        league: 'Premier League',
        status: 'upcoming'
      }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].league).toBe('Premier League')
      expect(result.matches[0].status).toBe('upcoming')
    })

    it('should sort by date in ascending order', async () => {
      const params: MatchQueryParams = {
        sort: 'date',
        order: 'asc'
      }
      const result = await service.getMatches(params)

      const dates = result.matches.map(match => new Date(`${match.matchDate} ${match.matchTime}`).getTime())
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1])
      }
    })

    it('should sort by date in descending order', async () => {
      const params: MatchQueryParams = {
        sort: 'date',
        order: 'desc'
      }
      const result = await service.getMatches(params)

      const dates = result.matches.map(match => new Date(`${match.matchDate} ${match.matchTime}`).getTime())
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1])
      }
    })

    it('should sort by league', async () => {
      const params: MatchQueryParams = {
        sort: 'league',
        order: 'asc'
      }
      const result = await service.getMatches(params)

      const leagues = result.matches.map(match => match.league)
      for (let i = 1; i < leagues.length; i++) {
        expect(leagues[i] >= leagues[i - 1]).toBe(true)
      }
    })

    it('should sort by status with custom ordering', async () => {
      const params: MatchQueryParams = {
        sort: 'status',
        order: 'desc'
      }
      const result = await service.getMatches(params)

      const statuses = result.matches.map(match => match.status)
      // Should be ordered: live > upcoming > finished > unknown
      expect(statuses[0]).toBe('live')
      expect(statuses[1]).toBe('upcoming')
      expect(statuses[2]).toBe('upcoming')
      expect(statuses[3]).toBe('finished')
    })

    it('should apply pagination', async () => {
      const params: MatchQueryParams = { page: 1, limit: 2 }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(2)
      expect(result.pagination.total).toBe(4)
      expect(result.pagination.totalPages).toBe(2)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrev).toBe(false)
    })

    it('should handle pagination with second page', async () => {
      const params: MatchQueryParams = { page: 2, limit: 2 }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.hasPrev).toBe(true)
      expect(result.pagination.hasNext).toBe(false)
    })

    it('should return empty result when no matches match filters', async () => {
      const params: MatchQueryParams = {
        league: 'Non-existent League'
      }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('should handle case-insensitive team search', async () => {
      const params: MatchQueryParams = { team: 'manchester' }
      const result = await service.getMatches(params)

      expect(result.matches).toHaveLength(2)
      expect(result.matches.every(match =>
        match.teamsDisplay.toLowerCase().includes('manchester')
      )).toBe(true)
    })
  })

  describe('sorting edge cases', () => {
    it('should handle empty matches array', async () => {
      // Override mock for this test
      mockDatabaseService.getMatches.mockImplementation(() => ({ matches: [], total: 0 }))

      const result = await service.getMatches({ sort: 'date', order: 'desc' })

      expect(result.matches).toHaveLength(0)
      expect(result.pagination.total).toBe(0)

      // Restore original mock
      mockDatabaseService.getMatches.mockImplementation(
        (limit?: number, status?: string, league?: string, offset?: number) => {
          let filtered = [...mockMatches]
          if (status) filtered = filtered.filter(match => match.status === status)
          if (league) filtered = filtered.filter(match => match.league === league)
          return { matches: filtered, total: filtered.length }
        }
      )
    })

    it('should handle default sort parameters', async () => {
      const result = await service.getMatches({})

      expect(result.filters.sort).toBe('date')
      expect(result.filters.order).toBe('desc')
    })
  })
})

describe('Query Parameter Validation', () => {
  const { validateQueryParams } = require('../response')

  it('should validate valid parameters', () => {
    const params = {
      page: 1,
      limit: 20,
      status: 'live',
      sort: 'date',
      order: 'desc',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
      team: 'Test Team'
    }

    const errors = validateQueryParams(params)
    expect(errors).toHaveLength(0)
  })

  it('should reject invalid page', () => {
    const params = { page: 0 } // 0 should be rejected
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('page')
    expect(errors[0].code).toBe('INVALID_PAGE')
  })

  it('should reject invalid status', () => {
    const params = { status: 'invalid' }
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('status')
    expect(errors[0].code).toBe('INVALID_STATUS')
  })

  it('should reject invalid sort field', () => {
    const params = { sort: 'invalid' }
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('sort')
    expect(errors[0].code).toBe('INVALID_SORT')
  })

  it('should reject invalid order', () => {
    const params = { order: 'invalid' }
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('order')
    expect(errors[0].code).toBe('INVALID_ORDER')
  })

  it('should reject invalid date format', () => {
    const params = { dateFrom: '01/01/2024' }
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('dateFrom')
    expect(errors[0].code).toBe('INVALID_DATE_FORMAT')
  })

  it('should reject team name too short', () => {
    const params = { team: 'a' }
    const errors = validateQueryParams(params)

    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('team')
    expect(errors[0].code).toBe('INVALID_TEAM_LENGTH')
  })
})