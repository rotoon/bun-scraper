import { Database } from 'bun:sqlite';
import {
  BaseRepository,
  type IRepository,
  type QueryOptions,
  RepositoryError,
} from './base.repository';
import type { Match, MatchStatus } from '../types';

// Database row interface for matches table
interface MatchRow {
  id?: number;
  matchId: string;
  matchTime: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  league: string;
  matchTitle: string;
  teamsDisplay: string;
  datePlay: string;
  streamUrl: string;
  timestamp: string;
  status: MatchStatus;
  scrapedAt: number;
  createdAt?: number;
  updatedAt?: number;
}

// Extended interface for match-specific query options
export interface MatchQueryOptions extends QueryOptions {
  status?: MatchStatus;
  league?: string;
  dateFrom?: string;
  dateTo?: string;
  team?: string;
  matchId?: string;
}

// Interface for match-specific operations
export interface IMatchRepository extends IRepository<Match> {
  // Match-specific find operations
  findByMatchId(matchId: string): Promise<Match | null>;
  findByStatus(
    status: MatchStatus,
    options?: MatchQueryOptions,
  ): Promise<Match[]>;
  findByLeague(league: string, options?: MatchQueryOptions): Promise<Match[]>;
  findByDateRange(
    dateFrom: string,
    dateTo: string,
    options?: MatchQueryOptions,
  ): Promise<Match[]>;
  findByTeamName(
    teamName: string,
    options?: MatchQueryOptions,
  ): Promise<Match[]>;
  searchMatches(query: string, options?: MatchQueryOptions): Promise<Match[]>;

  // Advanced query operations
  getMatchesWithFilters(options: MatchQueryOptions): Promise<{
    matches: Match[];
    total: number;
  }>;
  getUniqueLeagues(): Promise<string[]>;
  getMatchStats(): Promise<{
    totalMatches: number;
    liveMatches: number;
    upcomingMatches: number;
    finishedMatches: number;
    lastUpdated: number | null;
  }>;

  // Batch operations for scraping
  clearAllMatches(): Promise<number>;
  bulkInsertMatches(
    matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Promise<{
    success: boolean;
    inserted: number;
    deleted: number;
    message: string;
  }>;

  // Maintenance operations
  cleanOldMatches(hoursOld?: number): Promise<number>;
}

export class MatchRepository
  extends BaseRepository<Match>
  implements IMatchRepository
{
  constructor(db: Database) {
    super(db, 'matches');
  }

  protected mapRowToEntity(row: MatchRow): Match {
    return {
      id: row.id,
      matchId: row.matchId,
      matchTime: row.matchTime,
      matchDate: row.matchDate,
      teams: [
        { name: row.homeTeam, logo: row.homeTeamLogo || null },
        { name: row.awayTeam, logo: row.awayTeamLogo || null },
      ],
      league: row.league,
      matchTitle: row.matchTitle,
      teamsDisplay: row.teamsDisplay,
      datePlay: row.datePlay,
      streamUrl: row.streamUrl,
      timestamp: row.timestamp,
      status: row.status,
      scrapedAt: row.scrapedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  protected mapEntityToRow(entity: Partial<Match>): Partial<MatchRow> {
    const row: Partial<MatchRow> = {
      matchId: entity.matchId,
      matchTime: entity.matchTime,
      matchDate: entity.matchDate,
      league: entity.league,
      matchTitle: entity.matchTitle,
      teamsDisplay: entity.teamsDisplay,
      datePlay: entity.datePlay,
      streamUrl: entity.streamUrl,
      timestamp: entity.timestamp,
      status: entity.status,
      scrapedAt: entity.scrapedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    // Handle teams array
    if (entity.teams) {
      if (entity.teams[0]) {
        row.homeTeam = entity.teams[0].name;
        row.homeTeamLogo = entity.teams[0].logo || undefined;
      }
      if (entity.teams[1]) {
        row.awayTeam = entity.teams[1].name;
        row.awayTeamLogo = entity.teams[1].logo || undefined;
      }
    }

    return row;
  }

  async findByMatchId(matchId: string): Promise<Match | null> {
    try {
      const row = this.db
        .query('SELECT * FROM matches WHERE matchId = ?')
        .get(matchId) as MatchRow;
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to find match by matchId: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_BY_MATCH_ID_ERROR',
        error,
      );
    }
  }

  async findByStatus(
    status: MatchStatus,
    options: MatchQueryOptions = {},
  ): Promise<Match[]> {
    try {
      const { whereClause, params } = this.buildMatchWhereClause({
        ...options,
        status,
      });
      const query = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(query).all(params) as MatchRow[];
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to find matches by status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_BY_STATUS_ERROR',
        error,
      );
    }
  }

  async findByLeague(
    league: string,
    options: MatchQueryOptions = {},
  ): Promise<Match[]> {
    try {
      const { whereClause, params } = this.buildMatchWhereClause({
        ...options,
        league,
      });
      const query = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(query).all(params) as MatchRow[];
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to find matches by league: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_BY_LEAGUE_ERROR',
        error,
      );
    }
  }

  async findByDateRange(
    dateFrom: string,
    dateTo: string,
    options: MatchQueryOptions = {},
  ): Promise<Match[]> {
    try {
      const { whereClause, params } = this.buildMatchWhereClause({
        ...options,
        dateFrom,
        dateTo,
      });
      const query = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(query).all(params) as MatchRow[];
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to find matches by date range: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_BY_DATE_RANGE_ERROR',
        error,
      );
    }
  }

  async findByTeamName(
    teamName: string,
    options: MatchQueryOptions = {},
  ): Promise<Match[]> {
    try {
      const searchTerm = `%${teamName.toLowerCase()}%`;
      const params = [searchTerm, searchTerm, searchTerm];

      let whereClause = `WHERE (LOWER(homeTeam) LIKE ? OR LOWER(awayTeam) LIKE ? OR LOWER(matchTitle) LIKE ?)`;
      const paramIndex = 3;

      // Add additional filters
      const additionalFilters = this.buildAdditionalFilters(
        options,
        paramIndex,
      );
      if (additionalFilters.conditions.length > 0) {
        whereClause += ` AND ${additionalFilters.conditions.join(' AND ')}`;
        params.push(...additionalFilters.params);
      }

      const query = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(query).all(params) as MatchRow[];
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to find matches by team name: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_BY_TEAM_ERROR',
        error,
      );
    }
  }

  async searchMatches(
    query: string,
    options: MatchQueryOptions = {},
  ): Promise<Match[]> {
    try {
      const searchTerm = `%${query.toLowerCase()}%`;
      const params = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ];

      let whereClause = `WHERE (
        LOWER(homeTeam) LIKE ? OR
        LOWER(awayTeam) LIKE ? OR
        LOWER(matchTitle) LIKE ? OR
        LOWER(teamsDisplay) LIKE ? OR
        LOWER(league) LIKE ?
      )`;
      const paramIndex = 5;

      // Add additional filters
      const additionalFilters = this.buildAdditionalFilters(
        options,
        paramIndex,
      );
      if (additionalFilters.conditions.length > 0) {
        whereClause += ` AND ${additionalFilters.conditions.join(' AND ')}`;
        params.push(...additionalFilters.params);
      }

      const queryOptions = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(queryOptions).all(params) as MatchRow[];
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to search matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_ERROR',
        error,
      );
    }
  }

  async getMatchesWithFilters(options: MatchQueryOptions): Promise<{
    matches: Match[];
    total: number;
  }> {
    try {
      const { whereClause, params } = this.buildMatchWhereClause(options);

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM matches ${whereClause}`;
      const countResult = this.db.query(countQuery).get(params) as {
        total: number;
      };

      // Get paginated results
      const query = this.buildMatchQuery(whereClause, options);
      const rows = this.db.query(query).all(params) as MatchRow[];
      const matches = rows.map(row => this.mapRowToEntity(row));

      return { matches, total: countResult.total };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get matches with filters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_MATCHES_WITH_FILTERS_ERROR',
        error,
      );
    }
  }

  async getUniqueLeagues(): Promise<string[]> {
    try {
      const rows = this.db
        .query('SELECT DISTINCT league FROM matches ORDER BY league')
        .all() as { league: string }[];
      return rows.map(row => row.league).filter(Boolean);
    } catch (error) {
      throw new RepositoryError(
        `Failed to get unique leagues: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_UNIQUE_LEAGUES_ERROR',
        error,
      );
    }
  }

  async getMatchStats(): Promise<{
    totalMatches: number;
    liveMatches: number;
    upcomingMatches: number;
    finishedMatches: number;
    lastUpdated: number | null;
  }> {
    try {
      const total = this.db
        .query('SELECT COUNT(*) as count FROM matches')
        .get() as { count: number };
      const live = this.db
        .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
        .get('live') as { count: number };
      const upcoming = this.db
        .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
        .get('upcoming') as { count: number };
      const finished = this.db
        .query('SELECT COUNT(*) as count FROM matches WHERE status = ?')
        .get('finished') as { count: number };
      const lastUpdated = this.db
        .query('SELECT MAX(scrapedAt) as lastUpdated FROM matches')
        .get() as { lastUpdated: number | null };

      return {
        totalMatches: total.count,
        liveMatches: live.count,
        upcomingMatches: upcoming.count,
        finishedMatches: finished.count,
        lastUpdated: lastUpdated.lastUpdated,
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get match stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_MATCH_STATS_ERROR',
        error,
      );
    }
  }

  async clearAllMatches(): Promise<number> {
    try {
      const result = this.db.run('DELETE FROM matches');
      return result.changes;
    } catch (error) {
      throw new RepositoryError(
        `Failed to clear matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEAR_MATCHES_ERROR',
        error,
      );
    }
  }

  async bulkInsertMatches(
    matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Promise<{
    success: boolean;
    inserted: number;
    deleted: number;
    message: string;
  }> {
    try {
      return await this.transaction(async repo => {
        const deletedCount = await repo.clearAllMatches();
        let inserted = 0;

        for (const match of matches) {
          const now = Date.now();
          const matchWithTimestamps = {
            ...match,
            scrapedAt: now,
            createdAt: now,
            updatedAt: now,
          };

          const row = repo.mapEntityToRow(matchWithTimestamps);
          const fields = Object.keys(row).join(', ');
          const placeholders = Object.keys(row)
            .map(() => '?')
            .join(', ');
          const values = Object.values(row);

          repo.db.run(
            `INSERT INTO matches (${fields}) VALUES (${placeholders})`,
            values,
          );
          inserted++;
        }

        return {
          success: true,
          inserted,
          deleted: deletedCount,
          message: `Successfully saved ${inserted} matches`,
        };
      });
    } catch (error) {
      return {
        success: false,
        inserted: 0,
        deleted: 0,
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  async cleanOldMatches(hoursOld: number = 24): Promise<number> {
    try {
      const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
      const result = this.db.run('DELETE FROM matches WHERE scrapedAt < ?', [
        cutoffTime,
      ]);
      return result.changes;
    } catch (error) {
      throw new RepositoryError(
        `Failed to clean old matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEAN_OLD_MATCHES_ERROR',
        error,
      );
    }
  }

  // Helper methods for building queries
  private buildMatchWhereClause(options: MatchQueryOptions): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Status filter
    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    // League filter
    if (options.league) {
      conditions.push(`LOWER(league) LIKE $${paramIndex}`);
      params.push(`%${options.league.toLowerCase()}%`);
      paramIndex++;
    }

    // Date range filters
    if (options.dateFrom) {
      conditions.push(`matchDate >= $${paramIndex}`);
      params.push(options.dateFrom);
      paramIndex++;
    }

    if (options.dateTo) {
      conditions.push(`matchDate <= $${paramIndex}`);
      params.push(options.dateTo);
      paramIndex++;
    }

    // Specific match ID
    if (options.matchId) {
      conditions.push(`matchId = $${paramIndex}`);
      params.push(options.matchId);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  private buildAdditionalFilters(
    options: MatchQueryOptions,
    startIndex: number,
  ): {
    conditions: string[];
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    // Team filter (if not handled in main search)
    if (options.team && !options.matchId) {
      conditions.push(
        `(LOWER(homeTeam) LIKE $${paramIndex} OR LOWER(awayTeam) LIKE $${paramIndex} OR LOWER(matchTitle) LIKE $${paramIndex})`,
      );
      params.push(`%${options.team.toLowerCase()}%`);
      paramIndex++;
    }

    return { conditions, params };
  }

  private buildMatchQuery(
    whereClause: string,
    options: MatchQueryOptions,
  ): string {
    let query = `SELECT * FROM matches ${whereClause}`;

    // Add sorting
    if (options.orderBy) {
      const direction = options.orderDirection || 'ASC';
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    } else {
      // Default sort by timestamp
      query += ` ORDER BY timestamp ASC`;
    }

    // Add pagination
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
      if (options.offset) {
        query += ` OFFSET ${options.offset}`;
      }
    }

    return query;
  }
}
