import { Database } from 'bun:sqlite'
import { join } from 'path'
import type { Match, MatchStatus, DatabaseResult } from './types'

class DatabaseService {
  private db: Database

  constructor(dbPath: string = join(process.cwd(), 'football-matches.db')) {
    this.db = new Database(dbPath)
    this.initDatabase()
  }

  private initDatabase(): void {
    // Create matches table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matchId TEXT UNIQUE NOT NULL,
        matchTime TEXT NOT NULL,
        matchDate TEXT NOT NULL,
        homeTeam TEXT NOT NULL,
        awayTeam TEXT NOT NULL,
        homeTeamLogo TEXT,
        awayTeamLogo TEXT,
        league TEXT NOT NULL,
        matchTitle TEXT NOT NULL,
        teamsDisplay TEXT NOT NULL,
        datePlay TEXT NOT NULL,
        streamUrl TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        scrapedAt INTEGER NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now')),
        updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Create indexes for performance
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_matchId ON matches(matchId)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_status ON matches(status)`)
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_timestamp ON matches(timestamp)`
    )
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_league ON matches(league)`)
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_scrapedAt ON matches(scrapedAt)`
    )
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_matchDate ON matches(matchDate)`
    )
  }

  // Clear all matches (for fresh data)
  clearAllMatches(): number {
    const result = this.db.run('DELETE FROM matches', [])
    return result.changes
  }

  // Save matches to database (clears old data first)
  saveMatches(matches: Match[]): DatabaseResult {
    let inserted = 0
    const deletedCount = this.clearAllMatches()

    try {
      const transaction = this.db.transaction(() => {
        for (const match of matches) {
          this.db.run(
            `
            INSERT INTO matches (
              matchId, matchTime, matchDate, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo,
              league, matchTitle, teamsDisplay, datePlay, streamUrl, timestamp, status, scrapedAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              match.matchId,
              match.matchTime,
              match.matchDate,
              match.teams[0]?.name || '',
              match.teams[1]?.name || '',
              match.teams[0]?.logo || null,
              match.teams[1]?.logo || null,
              match.league,
              match.matchTitle,
              match.teamsDisplay,
              match.datePlay,
              match.streamUrl,
              match.timestamp,
              match.status,
              Date.now(),
              Date.now(),
            ]
          )
          inserted++
        }
      })

      transaction()

      return {
        success: true,
        inserted,
        deleted: deletedCount,
        message: `Successfully saved ${inserted} matches`,
      }
    } catch (error) {
      console.error('Database transaction failed:', error)
      return {
        success: false,
        inserted: 0,
        deleted: 0,
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      }
    }
  }

  // Get matches with filtering and pagination
  getMatches(
    limit?: number,
    status?: MatchStatus,
    league?: string,
    offset: number = 0
  ): { matches: Match[]; total: number } {
    let whereClause = ''
    const params: any[] = []

    // Build WHERE clause
    const conditions: string[] = []
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (league) {
      conditions.push('league = ?')
      params.push(league)
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM matches ${whereClause}`
    const countResult = this.db.query(countQuery).get(params as any) as {
      total: number
    }
    const total = countResult.total

    // Get paginated results
    let query = `
      SELECT * FROM matches
      ${whereClause}
      ORDER BY timestamp DESC
    `

    if (limit) {
      query += ` LIMIT ${limit} OFFSET ${offset}`
    }

    const rows = this.db.query(query).all(params as any) as any[]

    const matches = rows.map((row: any) => ({
      matchId: row.matchId,
      matchTime: row.matchTime,
      matchDate: row.matchDate,
      teams: [
        { name: row.homeTeam, logo: row.homeTeamLogo },
        { name: row.awayTeam, logo: row.awayTeamLogo },
      ],
      league: row.league,
      matchTitle: row.matchTitle,
      teamsDisplay: row.teamsDisplay,
      datePlay: row.datePlay,
      streamUrl: row.streamUrl,
      timestamp: row.timestamp,
      status: row.status as MatchStatus,
    }))

    return { matches, total }
  }

  // Clean old matches
  cleanOldMatches(hoursOld: number = 24): number {
    const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000
    const result = this.db.run('DELETE FROM matches WHERE scrapedAt < ?', [
      cutoffTime,
    ])
    return result.changes
  }

  // Get database statistics
  getStats(): {
    totalMatches: number
    liveMatches: number
    upcomingMatches: number
    finishedMatches: number
    lastUpdated: number | null
  } {
    const total = this.db
      .query('SELECT COUNT(*) as count FROM matches')
      .get() as { count: number }
    const live = this.db
      .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
      .get('live') as { count: number }
    const upcoming = this.db
      .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
      .get('upcoming') as { count: number }
    const finished = this.db
      .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
      .get('finished') as { count: number }
    const lastUpdated = this.db
      .query('SELECT MAX(scrapedAt) as lastUpdated FROM matches')
      .get() as { lastUpdated: number | null }

    return {
      totalMatches: total.count,
      liveMatches: live.count,
      upcomingMatches: upcoming.count,
      finishedMatches: finished.count,
      lastUpdated: lastUpdated.lastUpdated,
    }
  }

  close(): void {
    this.db.close()
  }
}

// Singleton instance
export const db = new DatabaseService()

// Export types
export { DatabaseService }
