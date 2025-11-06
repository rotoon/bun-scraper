import { footballService } from '../services';
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
  notModifiedResponse,
  tooManyRequestsWithRateLimitResponse,
  parseQueryParams,
  validateQueryParams,
} from '../response';
import { cacheManager, getMatchCacheTTL } from '../utils/cache';
import type { MatchQueryParams } from '../types';

export class MatchesController {
  async handleGetMatches(req: Request, url: URL): Promise<Response> {
    // Check rate limiting
    const clientId = cacheManager.getClientId(req);
    const rateLimit = cacheManager.checkRateLimit(clientId);

    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return tooManyRequestsWithRateLimitResponse(
        'Rate limit exceeded',
        retryAfter,
        rateLimit.headers,
      );
    }

    // Check for If-None-Match header (ETag support)
    const ifNoneMatch = req.headers.get('if-none-match');

    // Parse and validate query parameters
    const params = parseQueryParams(url, {
      page: 1,
      limit: 20,
      sort: 'date',
      order: 'desc',
    }) as MatchQueryParams;

    const errors = validateQueryParams(params);
    if (errors.length > 0) {
      return badRequestResponse('Invalid query parameters', errors);
    }

    try {
      const result = await footballService.getMatches(params);

      // Generate cache info
      const ttl = getMatchCacheTTL(result.matches);
      const etag = cacheManager.generateETag(result);

      // Check if resource has not been modified
      if (ifNoneMatch && cacheManager.isNotModified(ifNoneMatch, etag)) {
        return notModifiedResponse();
      }

      const cacheInfo = cacheManager.buildCacheInfo(
        etag,
        ttl,
        rateLimit.remaining,
      );

      return successResponse(
        result,
        `Retrieved ${result.matches.length} matches`,
        result.pagination,
        cacheInfo,
      );
    } catch (error) {
      console.error('Error getting matches:', error);
      return internalServerErrorResponse('Failed to retrieve matches');
    }
  }

  async handleGetLiveMatches(): Promise<Response> {
    try {
      const matches = await footballService.getLiveMatches();

      // Generate cache info for live matches (short TTL)
      const ttl = 30; // 30 seconds for live data
      const etag = cacheManager.generateETag(matches);
      const cacheInfo = cacheManager.buildCacheInfo(etag, ttl);

      return successResponse(
        matches,
        `Retrieved ${matches.length} live matches`,
        undefined,
        cacheInfo,
      );
    } catch (error) {
      console.error('Error getting live matches:', error);
      return internalServerErrorResponse('Failed to retrieve live matches');
    }
  }

  async handleSearchMatches(url: URL): Promise<Response> {
    const query = url.searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return badRequestResponse(
        'Search query must be at least 2 characters long',
      );
    }

    try {
      const matches = await footballService.searchMatches(query.trim());
      return successResponse(
        matches,
        `Found ${matches.length} matches matching "${query}"`,
      );
    } catch (error) {
      console.error('Error searching matches:', error);
      return internalServerErrorResponse('Failed to search matches');
    }
  }

  async handleGetStats(): Promise<Response> {
    try {
      const stats = await footballService.getStatistics();
      return successResponse(stats, 'Database statistics retrieved');
    } catch (error) {
      console.error('Error getting stats:', error);
      return internalServerErrorResponse('Failed to retrieve statistics');
    }
  }

  async handleGetLeagues(): Promise<Response> {
    try {
      const leagues = await footballService.getLeagues();
      return successResponse(leagues, `Retrieved ${leagues.length} leagues`);
    } catch (error) {
      console.error('Error getting leagues:', error);
      return internalServerErrorResponse('Failed to retrieve leagues');
    }
  }

  async handleGetLiveMatchesWithStreams(): Promise<Response> {
    try {
      const matches = await footballService.getLiveMatchesWithStreams();
      return successResponse(
        matches,
        `Retrieved ${matches.length} live matches with stream status`,
      );
    } catch (error) {
      console.error('Error getting live matches with streams:', error);
      return internalServerErrorResponse(
        'Failed to retrieve live matches with streams',
      );
    }
  }
}
