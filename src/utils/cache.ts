import crypto from 'crypto'
import type {
  CacheConfig,
  CacheHeaders,
  CacheInfo,
  Match,
  MatchStatus
} from '../types'

export class CacheManager {
  private config: CacheConfig
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 300, // 5 minutes default
      etagEnabled: true,
      rateLimitEnabled: true,
      maxRequestsPerMinute: 100,
      ...config
    }
  }

  // Generate ETag from data content
  generateETag(data: any): string {
    const content = JSON.stringify(data)
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`
  }

  // Build Cache-Control header
  buildCacheControl(ttl: number = this.config.defaultTTL): string {
    return `public, max-age=${ttl}, must-revalidate`
  }

  // Check if client has cached version
  isNotModified(clientETag: string, currentETag: string): boolean {
    return clientETag === currentETag
  }

  // Generate cache headers for response
  generateCacheHeaders(data: any, ttl?: number): CacheHeaders {
    const headers: CacheHeaders = {
      'Cache-Control': this.buildCacheControl(ttl)
    }

    if (this.config.etagEnabled) {
      headers['ETag'] = this.generateETag(data)
    }

    return headers
  }

  // Check and update rate limit
  checkRateLimit(clientId: string): {
    allowed: boolean
    remaining: number
    resetTime: number
    headers: Record<string, string>
  } {
    if (!this.config.rateLimitEnabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequestsPerMinute,
        resetTime: Math.ceil(Date.now() / 1000) + 60,
        headers: {}
      }
    }

    const now = Date.now()
    const windowStart = Math.floor(now / 60000) * 60000 // Current minute
    const resetTime = windowStart + 60000

    let rateLimit = this.rateLimitStore.get(clientId)

    if (!rateLimit || rateLimit.resetTime < now) {
      // New window
      rateLimit = {
        count: 1,
        resetTime
      }
      this.rateLimitStore.set(clientId, rateLimit)
    } else {
      // Existing window
      rateLimit.count++
    }

    const remaining = Math.max(0, this.config.maxRequestsPerMinute - rateLimit.count)
    const allowed = remaining > 0

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': this.config.maxRequestsPerMinute.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    }

    return { allowed, remaining, resetTime, headers }
  }

  // Get client identifier from request
  getClientId(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    return ip || 'unknown'
  }

  // Build cache info for API response
  buildCacheInfo(etag?: string, ttl?: number, rateLimitRemaining?: number): CacheInfo {
    return {
      etag,
      cacheControl: this.buildCacheControl(ttl),
      rateLimitRemaining,
      expiresAt: ttl ? new Date(Date.now() + ttl * 1000).toISOString() : undefined
    }
  }

  // Clean up expired rate limit entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (value.resetTime < now) {
        this.rateLimitStore.delete(key)
      }
    }
  }
}

// Create singleton instance
export const cacheManager = new CacheManager()

// Helper functions for specific cache scenarios
export function getMatchCacheTTL(matches: Match[]): number {
  // Live matches: 30 seconds cache
  const hasLive = matches.some(match => match.status === 'live')
  if (hasLive) {
    return 30
  }

  // Completed matches: 1 hour cache
  const hasCompleted = matches.some(match => match.status === 'finished')
  if (hasCompleted) {
    return 3600
  }

  // Upcoming matches: 15 minutes cache
  return 900
}

export function getEndpointCacheTTL(endpoint: string, status?: MatchStatus): number {
  switch (endpoint) {
    case '/matches/live':
      return 30 // Live data changes frequently
    case '/matches':
      return status === 'live' ? 30 : status === 'finished' ? 3600 : 900
    case '/stats':
      return 600 // Stats change moderately
    case '/leagues':
      return 3600 // Leagues are relatively static
    default:
      return 300 // Default 5 minutes
  }
}