// Standard API Response Structure (following RFC 9457)
export interface ApiResponse<T = any> {
  data?: T;
  success: boolean;
  message: string;
  timestamp: string;
  pagination?: PaginationInfo;
  cache?: CacheInfo;
}

// Pagination Info
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Cache Information
export interface CacheInfo {
  etag?: string;
  cacheControl?: string;
  rateLimitRemaining?: number;
  expiresAt?: string;
}

// Problem/Error Response (RFC 9457)
export interface ProblemResponse {
  type: string; // URI that identifies the problem type
  title: string; // Short, human-readable summary
  status: number; // HTTP status code
  detail: string; // Human-readable explanation
  instance?: string; // URI that identifies the specific occurrence
  errors?: ValidationError[]; // Optional validation errors
}

// Validation Error Details
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Football Match Entity
export interface Team {
  name: string;
  logo: string | null;
}

export interface Match {
  id?: number;
  matchId: string;
  matchTime: string;
  matchDate: string;
  teams: Team[];
  league: string;
  matchTitle: string;
  teamsDisplay: string;
  datePlay: string;
  streamUrl: string;
  timestamp: string;
  status: MatchStatus;
  scrapedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type MatchStatus = 'live' | 'upcoming' | 'finished' | 'unknown';

// Sort options for matches
export type MatchSortField = 'date' | 'league' | 'status';
export type SortOrder = 'asc' | 'desc';

// Query Parameters
export interface MatchQueryParams {
  page?: number;
  limit?: number;
  status?: MatchStatus;
  league?: string;
  dateFrom?: string;
  dateTo?: string;
  team?: string;
  sort?: MatchSortField;
  order?: SortOrder;
}

// Database Query Result
export interface DatabaseResult {
  success: boolean;
  inserted?: number;
  updated?: number;
  deleted?: number;
  message?: string;
}

// Cron Job Result
export interface CronJobResult {
  success: boolean;
  message: string;
  matchesScraped?: number;
  inserted?: number;
  deleted?: number;
  executionTime?: number;
  timestamp: string;
}

// Cache-related interfaces
export interface CacheConfig {
  defaultTTL: number; // in seconds
  etagEnabled: boolean;
  rateLimitEnabled: boolean;
  maxRequestsPerMinute: number;
}

export interface CacheHeaders {
  'Cache-Control': string;
  'ETag'?: string;
  'X-RateLimit-Remaining'?: string;
  'X-RateLimit-Limit'?: string;
  'X-RateLimit-Reset'?: string;
}