import { Database } from 'bun:sqlite';
import { BaseRepository, RepositoryError } from './base.repository';
import type { CronJobResult } from '../types';

// Cron job log entity interface
export interface CronJobLog extends BaseEntity {
  id?: number;
  success: boolean;
  message: string;
  matchesScraped?: number;
  inserted?: number;
  deleted?: number;
  executionTime?: number;
  timestamp: string;
  type: 'scrape' | 'cleanup' | 'maintenance';
  error?: string;
}

// Cron job statistics interface
export interface CronJobStats {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  lastJobSuccess: boolean;
  lastExecutionTime: string | null;
  averageExecutionTime: number;
  totalMatchesScraped: number;
  uptimePercentage: number;
}

// Cron job query options
export interface CronJobQueryOptions {
  type?: 'scrape' | 'cleanup' | 'maintenance';
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// Interface for cron-specific operations
export interface ICronRepository {
  // Job logging
  logCronJob(
    jobResult: CronJobResult & { type: CronJobLog['type'] },
  ): Promise<CronJobLog>;
  getJobHistory(options?: CronJobQueryOptions): Promise<CronJobLog[]>;
  getJobStats(options?: { days?: number }): Promise<CronJobStats>;
  getLatestJob(type?: CronJobLog['type']): Promise<CronJobLog | null>;

  // Cleanup operations
  cleanupOldLogs(daysOld?: number): Promise<number>;
  getJobFailureRate(days?: number): Promise<number>;
  getJobSuccessRate(days?: number): Promise<number>;

  // Analytics
  getExecutionTrend(days?: number): Promise<
    Array<{
      date: string;
      successCount: number;
      failureCount: number;
      averageExecutionTime: number;
    }>
  >;
  getHourlyExecutionPattern(days?: number): Promise<
    Array<{
      hour: number;
      jobCount: number;
      successRate: number;
    }>
  >;
}

export class CronRepository
  extends BaseRepository<CronJobLog>
  implements ICronRepository
{
  constructor(db: Database) {
    super(db, 'cron_jobs');
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    try {
      // Create cron_jobs table if it doesn't exist
      this.db.run(`
        CREATE TABLE IF NOT EXISTS cron_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          success BOOLEAN NOT NULL,
          message TEXT NOT NULL,
          matchesScraped INTEGER,
          inserted INTEGER,
          deleted INTEGER,
          executionTime INTEGER,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('scrape', 'cleanup', 'maintenance')),
          error TEXT,
          createdAt INTEGER DEFAULT (strftime('%s', 'now')),
          updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);

      // Create indexes for performance
      this.db.run(
        `CREATE INDEX IF NOT EXISTS idx_cron_timestamp ON cron_jobs(timestamp)`,
      );
      this.db.run(
        `CREATE INDEX IF NOT EXISTS idx_cron_type ON cron_jobs(type)`,
      );
      this.db.run(
        `CREATE INDEX IF NOT EXISTS idx_cron_success ON cron_jobs(success)`,
      );
      this.db.run(
        `CREATE INDEX IF NOT EXISTS idx_cron_createdAt ON cron_jobs(createdAt)`,
      );
    } catch (error) {
      throw new RepositoryError(
        `Failed to initialize cron jobs table: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INIT_TABLE_ERROR',
        error,
      );
    }
  }

  protected mapRowToEntity(row: any): CronJobLog {
    return {
      id: row.id,
      success: Boolean(row.success),
      message: row.message,
      matchesScraped: row.matchesScraped
        ? Number(row.matchesScraped)
        : undefined,
      inserted: row.inserted ? Number(row.inserted) : undefined,
      deleted: row.deleted ? Number(row.deleted) : undefined,
      executionTime: row.executionTime ? Number(row.executionTime) : undefined,
      timestamp: row.timestamp,
      type: row.type,
      error: row.error,
      createdAt: row.createdAt ? Number(row.createdAt) : undefined,
      updatedAt: row.updatedAt ? Number(row.updatedAt) : undefined,
    };
  }

  protected mapEntityToRow(entity: Partial<CronJobLog>): any {
    const row: any = {
      success: entity.success ? 1 : 0,
      message: entity.message,
      matchesScraped: entity.matchesScraped,
      inserted: entity.inserted,
      deleted: entity.deleted,
      executionTime: entity.executionTime,
      timestamp: entity.timestamp,
      type: entity.type,
      error: entity.error,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    // Filter out undefined values
    Object.keys(row).forEach(key => {
      if (row[key] === undefined) {
        delete row[key];
      }
    });

    return row;
  }

  async logCronJob(
    jobResult: CronJobResult & { type: CronJobLog['type'] },
  ): Promise<CronJobLog> {
    try {
      const logEntry: Omit<CronJobLog, 'id' | 'createdAt' | 'updatedAt'> = {
        success: jobResult.success,
        message: jobResult.message,
        matchesScraped: jobResult.matchesScraped,
        inserted: jobResult.inserted,
        deleted: jobResult.deleted,
        executionTime: jobResult.executionTime,
        timestamp: jobResult.timestamp,
        type: jobResult.type,
        error: jobResult.success ? undefined : jobResult.message,
      };

      return await this.create(logEntry);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to log cron job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOG_CRON_JOB_ERROR',
        error,
      );
    }
  }

  async getJobHistory(
    options: CronJobQueryOptions = {},
  ): Promise<CronJobLog[]> {
    try {
      const { whereClause, params } = this.buildCronWhereClause(options);

      let query = `SELECT * FROM cron_jobs ${whereClause}`;
      query += ` ORDER BY timestamp DESC`;

      if (options.limit) {
        query += ` LIMIT ${options.limit}`;
        if (options.offset) {
          query += ` OFFSET ${options.offset}`;
        }
      }

      const rows = this.db.query(query).all(params);
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      throw new RepositoryError(
        `Failed to get job history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_JOB_HISTORY_ERROR',
        error,
      );
    }
  }

  async getJobStats(options: { days?: number } = {}): Promise<CronJobStats> {
    try {
      const days = options.days || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Total jobs in period
      const totalResult = this.db
        .query('SELECT COUNT(*) as count FROM cron_jobs WHERE timestamp >= ?')
        .get(cutoffTimestamp) as { count: number };

      // Successful jobs in period
      const successResult = this.db
        .query(
          'SELECT COUNT(*) as count FROM cron_jobs WHERE success = 1 AND timestamp >= ?',
        )
        .get(cutoffTimestamp) as { count: number };

      // Failed jobs in period
      const failedResult = this.db
        .query(
          'SELECT COUNT(*) as count FROM cron_jobs WHERE success = 0 AND timestamp >= ?',
        )
        .get(cutoffTimestamp) as { count: number };

      // Last job
      const lastJobResult = this.db
        .query('SELECT * FROM cron_jobs ORDER BY timestamp DESC LIMIT 1')
        .get() as any;

      // Average execution time
      const avgTimeResult = this.db
        .query(
          'SELECT AVG(executionTime) as avgTime FROM cron_jobs WHERE executionTime IS NOT NULL AND timestamp >= ?',
        )
        .get(cutoffTimestamp) as { avgTime: number };

      // Total matches scraped
      const totalMatchesResult = this.db
        .query(
          'SELECT SUM(matchesScraped) as totalMatches FROM cron_jobs WHERE matchesScraped IS NOT NULL AND timestamp >= ?',
        )
        .get(cutoffTimestamp) as { totalMatches: number };

      const totalJobs = totalResult.count;
      const successfulJobs = successResult.count;
      const failedJobs = failedResult.count;
      const lastJobSuccess = lastJobResult
        ? Boolean(lastJobResult.success)
        : false;
      const lastExecutionTime = lastJobResult ? lastJobResult.timestamp : null;
      const averageExecutionTime = avgTimeResult.avgTime
        ? Math.round(avgTimeResult.avgTime)
        : 0;
      const totalMatchesScraped = totalMatchesResult.totalMatches || 0;
      const uptimePercentage =
        totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 100) : 0;

      return {
        totalJobs,
        successfulJobs,
        failedJobs,
        lastJobSuccess,
        lastExecutionTime,
        averageExecutionTime,
        totalMatchesScraped,
        uptimePercentage,
      };
    } catch (error) {
      throw new RepositoryError(
        `Failed to get job stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_JOB_STATS_ERROR',
        error,
      );
    }
  }

  async getLatestJob(type?: CronJobLog['type']): Promise<CronJobLog | null> {
    try {
      let query = 'SELECT * FROM cron_jobs';
      const params: any[] = [];

      if (type) {
        query += ' WHERE type = ?';
        params.push(type);
      }

      query += ' ORDER BY timestamp DESC LIMIT 1';

      const row = this.db.query(query).get(params);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to get latest job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_LATEST_JOB_ERROR',
        error,
      );
    }
  }

  async cleanupOldLogs(daysOld: number = 90): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - daysOld);
      const cutoffTimestamp = cutoffTime.getTime();

      const result = this.db.run(
        'DELETE FROM cron_jobs WHERE createdAt < ?',
        cutoffTimestamp,
      );

      return result.changes;
    } catch (error) {
      throw new RepositoryError(
        `Failed to cleanup old logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLEANUP_OLD_LOGS_ERROR',
        error,
      );
    }
  }

  async getJobFailureRate(days: number = 30): Promise<number> {
    try {
      const stats = await this.getJobStats({ days });
      return stats.totalJobs > 0
        ? Math.round((stats.failedJobs / stats.totalJobs) * 100)
        : 0;
    } catch (error) {
      throw new RepositoryError(
        `Failed to get job failure rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_FAILURE_RATE_ERROR',
        error,
      );
    }
  }

  async getJobSuccessRate(days: number = 30): Promise<number> {
    try {
      const stats = await this.getJobStats({ days });
      return stats.totalJobs > 0
        ? Math.round((stats.successfulJobs / stats.totalJobs) * 100)
        : 0;
    } catch (error) {
      throw new RepositoryError(
        `Failed to get job success rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_SUCCESS_RATE_ERROR',
        error,
      );
    }
  }

  async getExecutionTrend(days: number = 30): Promise<
    Array<{
      date: string;
      successCount: number;
      failureCount: number;
      averageExecutionTime: number;
    }>
  > {
    try {
      const query = `
        SELECT
          DATE(timestamp) as date,
          COUNT(*) as totalCount,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failureCount,
          AVG(CASE WHEN executionTime IS NOT NULL THEN executionTime ELSE NULL END) as averageExecutionTime
        FROM cron_jobs
        WHERE timestamp >= DATE('now', '-${days} days')
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `;

      const rows = this.db.query(query).all() as any[];

      return rows.map(row => ({
        date: row.date,
        successCount: row.successCount,
        failureCount: row.failureCount,
        averageExecutionTime: row.averageExecutionTime
          ? Math.round(row.averageExecutionTime)
          : 0,
      }));
    } catch (error) {
      throw new RepositoryError(
        `Failed to get execution trend: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_EXECUTION_TREND_ERROR',
        error,
      );
    }
  }

  async getHourlyExecutionPattern(days: number = 7): Promise<
    Array<{
      hour: number;
      jobCount: number;
      successRate: number;
    }>
  > {
    try {
      const query = `
        SELECT
          CAST(strftime('%H', timestamp) AS INTEGER) as hour,
          COUNT(*) as jobCount,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount
        FROM cron_jobs
        WHERE timestamp >= DATE('now', '-${days} days')
        GROUP BY CAST(strftime('%H', timestamp) AS INTEGER)
        ORDER BY hour ASC
      `;

      const rows = this.db.query(query).all() as any[];

      return rows.map(row => ({
        hour: row.hour,
        jobCount: row.jobCount,
        successRate:
          row.jobCount > 0
            ? Math.round((row.successCount / row.jobCount) * 100)
            : 0,
      }));
    } catch (error) {
      throw new RepositoryError(
        `Failed to get hourly execution pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_HOURLY_PATTERN_ERROR',
        error,
      );
    }
  }

  private buildCronWhereClause(options: CronJobQueryOptions): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    if (options.success !== undefined) {
      conditions.push('success = ?');
      params.push(options.success ? 1 : 0);
    }

    if (options.dateFrom) {
      conditions.push('timestamp >= ?');
      params.push(options.dateFrom);
    }

    if (options.dateTo) {
      conditions.push('timestamp <= ?');
      params.push(options.dateTo);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }
}
