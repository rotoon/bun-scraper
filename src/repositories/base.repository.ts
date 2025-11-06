import type { Database } from 'bun:sqlite';

// Generic interface for database entities
export interface BaseEntity {
  id?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Generic interface for repository operations
export interface IRepository<T extends BaseEntity> {
  // CRUD operations
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  findById(id: number): Promise<T | null>;
  findOne(filters: Partial<T>): Promise<T | null>;
  findMany(filters?: Partial<T>, options?: QueryOptions): Promise<T[]>;
  update(id: number, updates: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;

  // Batch operations
  createMany(
    entities: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Promise<T[]>;
  updateMany(filters: Partial<T>, updates: Partial<T>): Promise<number>;
  deleteMany(filters: Partial<T>): Promise<number>;

  // Aggregation
  count(filters?: Partial<T>): Promise<number>;

  // Transaction support
  transaction<R>(callback: (repo: this) => Promise<R>): Promise<R>;
}

// Query options for find operations
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

// Base error class for repository operations
export class RepositoryError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    code: string = 'REPOSITORY_ERROR',
    details?: any,
  ) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.details = details;
  }
}

// Base repository implementation
export abstract class BaseRepository<T extends BaseEntity>
  implements IRepository<T>
{
  protected db: Database;
  protected tableName: string;

  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  // Abstract method to be implemented by concrete repositories
  protected abstract mapRowToEntity(row: any): T;
  protected abstract mapEntityToRow(entity: Partial<T>): any;

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const now = Date.now();
      const entityWithTimestamps = {
        ...entity,
        createdAt: now,
        updatedAt: now,
      } as T;

      const row = this.mapEntityToRow(entityWithTimestamps);
      const fields = Object.keys(row).join(', ');
      const placeholders = Object.keys(row)
        .map(() => '?')
        .join(', ');
      const values = Object.values(row);

      const result = this.db.run(
        `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders})`,
        values,
      );

      if (!result.lastInsertRowid) {
        throw new RepositoryError('Failed to insert entity', 'INSERT_ERROR');
      }

      const created = await this.findById(Number(result.lastInsertRowid));
      if (!created) {
        throw new RepositoryError(
          'Failed to retrieve created entity',
          'RETRIEVE_ERROR',
        );
      }

      return created;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to create entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CREATE_ERROR',
        error,
      );
    }
  }

  async findById(id: number): Promise<T | null> {
    try {
      const row = this.db
        .query(`SELECT * FROM ${this.tableName} WHERE id = ?`)
        .get(id);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to find entity by id: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_ERROR',
        error,
      );
    }
  }

  async findOne(filters: Partial<T>): Promise<T | null> {
    try {
      const { whereClause, params } = this.buildWhereClause(filters);
      const row = this.db
        .query(`SELECT * FROM ${this.tableName} ${whereClause}`)
        .get(params);
      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw new RepositoryError(
        `Failed to find entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_ERROR',
        error,
      );
    }
  }

  async findMany(
    filters?: Partial<T>,
    options: QueryOptions = {},
  ): Promise<T[]> {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (filters && Object.keys(filters).length > 0) {
        const { whereClause, whereParams } = this.buildWhereClause(filters);
        query += ` ${whereClause}`;
        params.push(...whereParams);
      }

      if (options.orderBy) {
        const direction = options.orderDirection || 'ASC';
        query += ` ORDER BY ${options.orderBy} ${direction}`;
      }

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
        `Failed to find entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FIND_ERROR',
        error,
      );
    }
  }

  async update(id: number, updates: Partial<T>): Promise<T | null> {
    try {
      const updateData = {
        ...updates,
        updatedAt: Date.now(),
      };

      const row = this.mapEntityToRow(updateData);
      const fields = Object.keys(row)
        .map(key => `${key} = ?`)
        .join(', ');
      const values = Object.values(row);

      const result = this.db.run(
        `UPDATE ${this.tableName} SET ${fields} WHERE id = ?`,
        [...values, id],
      );

      if (result.changes === 0) {
        throw new RepositoryError(
          'No entity found to update',
          'NOT_FOUND_ERROR',
        );
      }

      return await this.findById(id);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_ERROR',
        error,
      );
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const result = this.db.run(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        id,
      );
      return result.changes > 0;
    } catch (error) {
      throw new RepositoryError(
        `Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        error,
      );
    }
  }

  async createMany(
    entities: Omit<T, 'id' | 'createdAt' | 'updatedAt'>[],
  ): Promise<T[]> {
    try {
      const now = Date.now();
      const entitiesWithTimestamps = entities.map(
        entity =>
          ({
            ...entity,
            createdAt: now,
            updatedAt: now,
          }) as T,
      );

      return await this.transaction(async () => {
        const results: T[] = [];
        for (const entity of entitiesWithTimestamps) {
          const result = await this.create(entity);
          results.push(result);
        }
        return results;
      });
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        `Failed to create entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_CREATE_ERROR',
        error,
      );
    }
  }

  async updateMany(filters: Partial<T>, updates: Partial<T>): Promise<number> {
    try {
      const updateData = {
        ...updates,
        updatedAt: Date.now(),
      };

      const row = this.mapEntityToRow(updateData);
      const fields = Object.keys(row)
        .map(key => `${key} = ?`)
        .join(', ');
      const values = Object.values(row);

      const { whereClause, whereParams } = this.buildWhereClause(filters);

      const result = this.db.run(
        `UPDATE ${this.tableName} SET ${fields} ${whereClause}`,
        [...values, ...whereParams],
      );

      return result.changes;
    } catch (error) {
      throw new RepositoryError(
        `Failed to update entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_UPDATE_ERROR',
        error,
      );
    }
  }

  async deleteMany(filters: Partial<T>): Promise<number> {
    try {
      const { whereClause, params } = this.buildWhereClause(filters);
      const result = this.db.run(
        `DELETE FROM ${this.tableName} ${whereClause}`,
        params,
      );
      return result.changes;
    } catch (error) {
      throw new RepositoryError(
        `Failed to delete entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'BATCH_DELETE_ERROR',
        error,
      );
    }
  }

  async count(filters?: Partial<T>): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (filters && Object.keys(filters).length > 0) {
        const { whereClause, whereParams } = this.buildWhereClause(filters);
        query += ` ${whereClause}`;
        params.push(...whereParams);
      }

      const result = this.db.query(query).get(params) as { count: number };
      return result.count;
    } catch (error) {
      throw new RepositoryError(
        `Failed to count entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COUNT_ERROR',
        error,
      );
    }
  }

  async transaction<R>(callback: (repo: this) => Promise<R>): Promise<R> {
    const transaction = this.db.transaction(async () => {
      return await callback(this);
    });
    return await transaction();
  }

  // Helper method to build WHERE clause
  protected buildWhereClause(filters: Partial<T>): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }
}
