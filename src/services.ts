import { db } from './database';
import { scraper } from './scraper';
import {
  getIframeUrl,
  getMultipleIframeUrls,
  checkStreamAvailability,
  type StreamResponse,
  type GetStreamOptions,
} from './streamExtractor';
import { MatchRepository, CronRepository } from './repositories';
import type {
  Match,
  CronJobResult,
  DatabaseResult,
  MatchQueryParams,
  MatchSortField,
} from './types';

export class FootballService {
  private matchRepository: MatchRepository;
  private cronRepository: CronRepository;

  constructor() {
    this.matchRepository = new MatchRepository(db.getDatabase());
    this.cronRepository = new CronRepository(db.getDatabase());
  }
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
      order = 'desc',
    } = params;

    try {
      // Prepare repository options
      const repositoryOptions = {
        status,
        league,
        dateFrom,
        dateTo,
        team,
        limit,
        offset: (page - 1) * limit,
        orderBy: this.mapSortFieldToOrderBy(sort),
        orderDirection: order.toUpperCase() as 'ASC' | 'DESC',
      };

      // Get matches from repository
      const { matches, total } =
        await this.matchRepository.getMatchesWithFilters(repositoryOptions);

      // Apply pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page * limit < total;
      const hasPrev = page > 1;

      return {
        matches,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
        total,
        filters: {
          status,
          league,
          dateFrom,
          dateTo,
          team,
          sort,
          order,
        },
      };
    } catch (error) {
      console.error('Error in getMatches:', error);
      throw error;
    }
  }

  // Helper method to map sort field to database column
  private mapSortFieldToOrderBy(sortField: MatchSortField): string {
    switch (sortField) {
      case 'date':
        return 'timestamp';
      case 'league':
        return 'league';
      case 'status':
        return 'status';
      default:
        return 'timestamp';
    }
  }

  // Get live matches only
  async getLiveMatches() {
    try {
      return await this.matchRepository.findByStatus('live');
    } catch (error) {
      console.error('Error in getLiveMatches:', error);
      throw error;
    }
  }

  // Get matches by date range
  async getMatchesByDateRange(dateFrom: string, dateTo: string) {
    try {
      return await this.matchRepository.findByDateRange(dateFrom, dateTo);
    } catch (error) {
      console.error('Error in getMatchesByDateRange:', error);
      throw error;
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      return await this.matchRepository.getMatchStats();
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  }

  // Refresh data (scrape and save)
  async refreshData(): Promise<DatabaseResult> {
    try {
      const startTime = Date.now();

      // Scrape fresh data
      const matches = await scraper.scrapeMatches();

      // Save to database using repository
      const result = await this.matchRepository.bulkInsertMatches(matches);

      const executionTime = Date.now() - startTime;

      return {
        ...result,
        message: `${result.message} in ${executionTime}ms`,
      };
    } catch (error) {
      return {
        success: false,
        inserted: 0,
        deleted: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Execute cron job (scrape + save)
  async executeCronJob(): Promise<CronJobResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // eslint-disable-next-line no-console
      console.log(`[${timestamp}] Starting cron job execution...`);

      // Scrape matches
      const matches = await scraper.scrapeMatches();
      // eslint-disable-next-line no-console
      console.log(`[${timestamp}] Scraped ${matches.length} matches`);

      // Save to database using repository
      const saveResult = await this.matchRepository.bulkInsertMatches(matches);

      // Log cron job to cron repository
      const cronJobResult: CronJobResult & { type: 'scrape' } = {
        success: saveResult.success,
        message: saveResult.message,
        matchesScraped: matches.length,
        inserted: saveResult.inserted,
        deleted: saveResult.deleted,
        executionTime: Date.now() - startTime,
        timestamp,
        type: 'scrape',
      };

      await this.cronRepository.logCronJob(cronJobResult);

      if (saveResult.success) {
        // eslint-disable-next-line no-console
        console.log(`[${timestamp}] Cron job completed successfully`);
        return {
          success: true,
          message: `Successfully scraped and saved ${matches.length} matches`,
          matchesScraped: matches.length,
          inserted: saveResult.inserted,
          deleted: saveResult.deleted,
          executionTime: cronJobResult.executionTime,
          timestamp,
        };
      } else {
        throw new Error(saveResult.message || 'Failed to save matches');
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[${timestamp}] Cron job failed:`, error);

      // Log failed cron job
      const failedCronJob: CronJobResult & { type: 'scrape' } = {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime,
        timestamp,
        type: 'scrape',
      };

      try {
        await this.cronRepository.logCronJob(failedCronJob);
      } catch (logError) {
        console.error('Failed to log cron job error:', logError);
      }

      return failedCronJob;
    }
  }

  // Clean old matches
  async cleanOldMatches(
    hoursOld: number = 24,
  ): Promise<{ deleted: number; message: string }> {
    try {
      const deletedCount = await this.matchRepository.cleanOldMatches(hoursOld);

      // Log cleanup job
      const timestamp = new Date().toISOString();
      const cleanupJob: CronJobResult & { type: 'cleanup' } = {
        success: true,
        message: `Cleaned ${deletedCount} old matches (older than ${hoursOld} hours)`,
        deleted: deletedCount,
        timestamp,
        type: 'cleanup',
      };

      await this.cronRepository.logCronJob(cleanupJob);

      return {
        deleted: deletedCount,
        message: cleanupJob.message,
      };
    } catch (error) {
      const errorMessage = `Failed to clean old matches: ${error instanceof Error ? error.message : 'Unknown error'}`;

      // Log failed cleanup
      try {
        const failedCleanupJob: CronJobResult & { type: 'cleanup' } = {
          success: false,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          type: 'cleanup',
        };
        await this.cronRepository.logCronJob(failedCleanupJob);
      } catch (logError) {
        console.error('Failed to log cleanup error:', logError);
      }

      return {
        deleted: 0,
        message: errorMessage,
      };
    }
  }

  // Get unique leagues
  async getLeagues(): Promise<string[]> {
    try {
      return await this.matchRepository.getUniqueLeagues();
    } catch (error) {
      console.error('Error in getLeagues:', error);
      throw error;
    }
  }

  // Search matches by team name
  async searchMatches(query: string): Promise<Match[]> {
    try {
      return await this.matchRepository.searchMatches(query, { limit: 100 });
    } catch (error) {
      console.error('Error in searchMatches:', error);
      throw error;
    }
  }

  // Get iframe URL for a specific match
  async getMatchStream(
    matchId: string,
    options?: GetStreamOptions,
    clientIdentifier: string = 'api',
  ): Promise<StreamResponse> {
    return await getIframeUrl(matchId, options, clientIdentifier);
  }

  // Get iframe URLs for multiple matches
  async getMultipleMatchStreams(
    matchIds: string[],
    options?: GetStreamOptions,
    clientIdentifier: string = 'batch',
  ): Promise<StreamResponse[]> {
    return await getMultipleIframeUrls(matchIds, options, clientIdentifier);
  }

  // Check if a match has available stream
  async isStreamAvailable(matchId: string): Promise<boolean> {
    return await checkStreamAvailability(matchId);
  }

  // Get live matches with stream availability
  async getLiveMatchesWithStreams(): Promise<Match[]> {
    const liveMatches = await this.getLiveMatches();

    // Check stream availability for each live match (in parallel with rate limiting)
    const matchesWithStreams = await Promise.all(
      liveMatches.map(async match => {
        const hasStream = await this.isStreamAvailable(match.matchId);
        return {
          ...match,
          hasStream,
        };
      }),
    );

    return matchesWithStreams;
  }

  // Get matches by ID (useful for stream extraction)
  async getMatchById(matchId: string): Promise<Match | null> {
    try {
      return await this.matchRepository.findByMatchId(matchId);
    } catch (error) {
      console.error('Error in getMatchById:', error);
      throw error;
    }
  }

  // Cron job specific methods (new additions)
  async getCronJobHistory(days: number = 30) {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateFromString = dateFrom.toISOString().split('T')[0];

      return await this.cronRepository.getJobHistory({
        dateFrom: dateFromString,
        limit: 100,
      });
    } catch (error) {
      console.error('Error in getCronJobHistory:', error);
      throw error;
    }
  }

  async getCronJobStats(days: number = 30) {
    try {
      return await this.cronRepository.getJobStats({ days });
    } catch (error) {
      console.error('Error in getCronJobStats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const footballService = new FootballService();
