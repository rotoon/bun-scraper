import type {
  ApiResponse,
  ProblemResponse,
  PaginationInfo,
  ValidationError,
  CacheInfo,
} from './types';

// Success Response Helper
export function successResponse<T>(
  data: T,
  message: string = 'Success',
  pagination?: PaginationInfo,
  cache?: CacheInfo,
): Response {
  const response: ApiResponse<T> = {
    data,
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...(pagination && { pagination }),
    ...(cache && { cache }),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Add cache headers if provided
  if (cache) {
    if (cache.cacheControl) {
      headers['Cache-Control'] = cache.cacheControl;
    }
    if (cache.etag) {
      headers['ETag'] = cache.etag;
    }
    if (cache.rateLimitRemaining !== undefined) {
      headers['X-RateLimit-Remaining'] = cache.rateLimitRemaining.toString();
    }
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
}

// Created Response Helper (201)
export function createdResponse<T>(
  data: T,
  message: string = 'Resource created successfully',
): Response {
  const response: ApiResponse<T> = {
    data,
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(response), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Error Response Helper (RFC 9457 Problem Details)
export function errorResponse(
  status: number,
  title: string,
  detail: string,
  type?: string,
  errors?: ValidationError[],
  instance?: string,
): Response {
  const problem: ProblemResponse = {
    type: type || `/problems/${status}`,
    title,
    status,
    detail,
    ...(instance && { instance }),
    ...(errors && { errors }),
  };

  return new Response(JSON.stringify(problem), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Common Error Responses
export const badRequestResponse = (
  detail: string,
  errors?: ValidationError[],
) => errorResponse(400, 'Bad Request', detail, '/problems/bad-request', errors);

export const unauthorizedResponse = (
  detail: string = 'Authentication required',
) => errorResponse(401, 'Unauthorized', detail, '/problems/unauthorized');

export const forbiddenResponse = (detail: string = 'Access forbidden') =>
  errorResponse(403, 'Forbidden', detail, '/problems/forbidden');

export const notFoundResponse = (detail: string = 'Resource not found') =>
  errorResponse(404, 'Not Found', detail, '/problems/not-found');

export const conflictResponse = (detail: string) =>
  errorResponse(409, 'Conflict', detail, '/problems/conflict');

export const tooManyRequestsResponse = (
  detail: string = 'Rate limit exceeded',
) =>
  errorResponse(
    429,
    'Too Many Requests',
    detail,
    '/problems/too-many-requests',
  );

export const internalServerErrorResponse = (
  detail: string = 'Internal server error',
) =>
  errorResponse(
    500,
    'Internal Server Error',
    detail,
    '/problems/internal-server-error',
  );

export const serviceUnavailableResponse = (
  detail: string = 'Service temporarily unavailable',
) =>
  errorResponse(
    503,
    'Service Unavailable',
    detail,
    '/problems/service-unavailable',
  );

// Not Modified Response (304)
export function notModifiedResponse(): Response {
  return new Response(null, {
    status: 304,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}

// Too Many Requests Response with Rate Limit Headers
export function tooManyRequestsWithRateLimitResponse(
  detail: string = 'Rate limit exceeded',
  retryAfter?: number,
  rateLimitHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/problem+json',
    'Access-Control-Allow-Origin': '*',
  };

  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  if (rateLimitHeaders) {
    Object.assign(headers, rateLimitHeaders);
  }

  const problem: ProblemResponse = {
    type: '/problems/too-many-requests',
    title: 'Too Many Requests',
    status: 429,
    detail,
  };

  return new Response(JSON.stringify(problem), {
    status: 429,
    headers,
  });
}

// CORS Options Response
export function optionsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Parse and validate query parameters
export function parseQueryParams(url: URL, defaults: Record<string, any> = {}) {
  const params: Record<string, any> = { ...defaults };

  // Parse number parameters
  ['page', 'limit', 'offset'].forEach(param => {
    const value = url.searchParams.get(param);
    if (value !== null) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        params[param] = numValue;
      }
    }
  });

  // Parse string parameters
  [
    'status',
    'league',
    'dateFrom',
    'dateTo',
    'hours',
    'team',
    'sort',
    'order',
  ].forEach(param => {
    const value = url.searchParams.get(param);
    if (value !== null) {
      params[param] = value;
    }
  });

  return params;
}

// Validate query parameters
export function validateQueryParams(
  params: Record<string, any>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate pagination
  if (params.page !== undefined && (params.page < 1 || params.page > 1000)) {
    errors.push({
      field: 'page',
      message: 'Page must be between 1 and 1000',
      code: 'INVALID_PAGE',
    });
  }

  if (params.limit && (params.limit < 1 || params.limit > 999)) {
    errors.push({
      field: 'limit',
      message: 'Limit must be between 1 and 999',
      code: 'INVALID_LIMIT',
    });
  }

  // Validate status
  const validStatuses = ['live', 'upcoming', 'finished', 'unknown'];
  if (params.status && !validStatuses.includes(params.status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
      code: 'INVALID_STATUS',
    });
  }

  // Validate sort field
  const validSortFields = ['date', 'league', 'status'];
  if (params.sort && !validSortFields.includes(params.sort)) {
    errors.push({
      field: 'sort',
      message: `Sort must be one of: ${validSortFields.join(', ')}`,
      code: 'INVALID_SORT',
    });
  }

  // Validate order
  const validOrders = ['asc', 'desc'];
  if (params.order && !validOrders.includes(params.order)) {
    errors.push({
      field: 'order',
      message: `Order must be one of: ${validOrders.join(', ')}`,
      code: 'INVALID_ORDER',
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (params.dateFrom && !dateRegex.test(params.dateFrom)) {
    errors.push({
      field: 'dateFrom',
      message: 'dateFrom must be in YYYY-MM-DD format',
      code: 'INVALID_DATE_FORMAT',
    });
  }

  if (params.dateTo && !dateRegex.test(params.dateTo)) {
    errors.push({
      field: 'dateTo',
      message: 'dateTo must be in YYYY-MM-DD format',
      code: 'INVALID_DATE_FORMAT',
    });
  }

  // Validate team name length
  if (params.team && (params.team.length < 2 || params.team.length > 100)) {
    errors.push({
      field: 'team',
      message: 'Team name must be between 2 and 100 characters',
      code: 'INVALID_TEAM_LENGTH',
    });
  }

  // Validate hours for cleanup
  if (params.hours && (params.hours < 1 || params.hours > 168)) {
    errors.push({
      field: 'hours',
      message: 'Hours must be between 1 and 168 (7 days)',
      code: 'INVALID_HOURS',
    });
  }

  return errors;
}

// Build pagination info
export function buildPaginationInfo(
  page: number,
  limit: number,
  total: number,
): PaginationInfo {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
