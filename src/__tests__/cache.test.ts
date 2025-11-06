import { describe, it, expect, beforeEach } from 'bun:test';
import { CacheManager } from '../utils/cache';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      defaultTTL: 60,
      etagEnabled: true,
      rateLimitEnabled: true,
      maxRequestsPerMinute: 10,
    });
  });

  describe('ETag Generation', () => {
    it('should generate consistent ETags for same data', () => {
      const data = { test: 'data' };
      const etag1 = cacheManager.generateETag(data);
      const etag2 = cacheManager.generateETag(data);

      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate different ETags for different data', () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };
      const etag1 = cacheManager.generateETag(data1);
      const etag2 = cacheManager.generateETag(data2);

      expect(etag1).not.toBe(etag2);
    });

    it('should handle complex objects', () => {
      const complexData = {
        matches: [
          { id: 1, name: 'Match 1' },
          { id: 2, name: 'Match 2' },
        ],
        pagination: { page: 1, total: 2 },
      };
      const etag = cacheManager.generateETag(complexData);

      expect(etag).toBeDefined();
      expect(typeof etag).toBe('string');
    });
  });

  describe('Cache-Control Headers', () => {
    it('should build cache control header with default TTL', () => {
      const header = cacheManager.buildCacheControl();
      expect(header).toBe('public, max-age=60, must-revalidate');
    });

    it('should build cache control header with custom TTL', () => {
      const header = cacheManager.buildCacheControl(300);
      expect(header).toBe('public, max-age=300, must-revalidate');
    });
  });

  describe('ETag Comparison', () => {
    it('should identify matching ETags', () => {
      const data = { test: 'data' };
      const etag = cacheManager.generateETag(data);
      const isMatch = cacheManager.isNotModified(etag, etag);

      expect(isMatch).toBe(true);
    });

    it('should identify non-matching ETags', () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };
      const etag1 = cacheManager.generateETag(data1);
      const etag2 = cacheManager.generateETag(data2);
      const isMatch = cacheManager.isNotModified(etag1, etag2);

      expect(isMatch).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const clientId = 'test-client';
      const result = cacheManager.checkRateLimit(clientId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
      expect(result.headers['X-RateLimit-Limit']).toBe('10');
      expect(result.headers['X-RateLimit-Remaining']).toBe('9');
    });

    it('should reject requests exceeding limit', () => {
      const clientId = 'test-client';

      // Use up all allowed requests
      for (let i = 0; i < 10; i++) {
        cacheManager.checkRateLimit(clientId);
      }

      // Next request should be rejected
      const result = cacheManager.checkRateLimit(clientId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset rate limit after time window', () => {
      const clientId = 'test-client';

      // Use up all allowed requests
      for (let i = 0; i < 10; i++) {
        cacheManager.checkRateLimit(clientId);
      }

      // Mock time passing (advance by more than 1 minute)
      const originalTime = Date.now;
      Date.now = () => originalTime() + 70000;

      // Should be allowed again
      const result = cacheManager.checkRateLimit(clientId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);

      // Restore original Date.now
      Date.now = originalTime;
    });

    it('should handle different clients separately', () => {
      const client1 = 'client1';
      const client2 = 'client2';

      // Use up limit for client1
      for (let i = 0; i < 10; i++) {
        cacheManager.checkRateLimit(client1);
      }

      // client1 should be rate limited
      const result1 = cacheManager.checkRateLimit(client1);
      expect(result1.allowed).toBe(false);

      // client2 should still be allowed
      const result2 = cacheManager.checkRateLimit(client2);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Cache Headers Generation', () => {
    it('should generate complete cache headers', () => {
      const data = { test: 'data' };
      const headers = cacheManager.generateCacheHeaders(data, 300);

      expect(headers['Cache-Control']).toBe(
        'public, max-age=300, must-revalidate',
      );
      expect(headers['ETag']).toBeDefined();
      expect(typeof headers['ETag']).toBe('string');
    });

    it('should work with ETag disabled', () => {
      const cacheManagerNoEtag = new CacheManager({
        defaultTTL: 60,
        etagEnabled: false,
        rateLimitEnabled: true,
        maxRequestsPerMinute: 10,
      });

      const data = { test: 'data' };
      const headers = cacheManagerNoEtag.generateCacheHeaders(data);

      expect(headers['Cache-Control']).toBe(
        'public, max-age=60, must-revalidate',
      );
      expect(headers['ETag']).toBeUndefined();
    });
  });

  describe('Cache Info Building', () => {
    it('should build cache info with all parameters', () => {
      const etag = '"test-etag"';
      const ttl = 300;
      const rateLimitRemaining = 50;

      const cacheInfo = cacheManager.buildCacheInfo(
        etag,
        ttl,
        rateLimitRemaining,
      );

      expect(cacheInfo.etag).toBe(etag);
      expect(cacheInfo.cacheControl).toBe(
        'public, max-age=300, must-revalidate',
      );
      expect(cacheInfo.rateLimitRemaining).toBe(50);
      expect(cacheInfo.expiresAt).toBeDefined();
    });

    it('should build minimal cache info', () => {
      const cacheInfo = cacheManager.buildCacheInfo();

      expect(cacheInfo.etag).toBeUndefined();
      expect(cacheInfo.cacheControl).toBe(
        'public, max-age=60, must-revalidate',
      );
      expect(cacheInfo.rateLimitRemaining).toBeUndefined();
      expect(cacheInfo.expiresAt).toBeUndefined();
    });
  });

  describe('Client Identification', () => {
    it('should extract client ID from request headers', () => {
      const req = new Request('http://example.com', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const clientId = cacheManager.getClientId(req);
      expect(clientId).toBe('192.168.1.1');
    });

    it('should fallback to x-real-ip header', () => {
      const req = new Request('http://example.com', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });

      const clientId = cacheManager.getClientId(req);
      expect(clientId).toBe('10.0.0.1');
    });

    it('should return unknown for missing headers', () => {
      const req = new Request('http://example.com');
      const clientId = cacheManager.getClientId(req);
      expect(clientId).toBe('unknown');
    });

    it('should handle multiple forwarded IPs', () => {
      const req = new Request('http://example.com', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        },
      });

      const clientId = cacheManager.getClientId(req);
      expect(clientId).toBe('192.168.1.1');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired rate limit entries', () => {
      const clientId = 'test-client';

      // Add some rate limit entries
      cacheManager.checkRateLimit(clientId);

      // Mock time passing (advance by more than 1 minute)
      const originalTime = Date.now;
      Date.now = () => originalTime() + 70000;

      // Cleanup should remove expired entries
      cacheManager.cleanup();

      // Should be allowed again (clean slate)
      const result = cacheManager.checkRateLimit(clientId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);

      // Restore original Date.now
      Date.now = originalTime;
    });
  });
});

describe('Cache Utility Functions', () => {
  const { getMatchCacheTTL, getEndpointCacheTTL } = require('../utils/cache');

  describe('getMatchCacheTTL', () => {
    it('should return 30 seconds for live matches', () => {
      const matches = [{ status: 'live' }];
      const ttl = getMatchCacheTTL(matches);
      expect(ttl).toBe(30);
    });

    it('should return 1 hour for finished matches', () => {
      const matches = [{ status: 'finished' }];
      const ttl = getMatchCacheTTL(matches);
      expect(ttl).toBe(3600);
    });

    it('should return 15 minutes for upcoming matches', () => {
      const matches = [{ status: 'upcoming' }];
      const ttl = getMatchCacheTTL(matches);
      expect(ttl).toBe(900);
    });

    it('should return 30 seconds when any match is live', () => {
      const matches = [
        { status: 'finished' },
        { status: 'live' },
        { status: 'upcoming' },
      ];
      const ttl = getMatchCacheTTL(matches);
      expect(ttl).toBe(30);
    });
  });

  describe('getEndpointCacheTTL', () => {
    it('should return appropriate TTL for different endpoints', () => {
      expect(getEndpointCacheTTL('/matches/live')).toBe(30);
      expect(getEndpointCacheTTL('/matches', 'live')).toBe(30);
      expect(getEndpointCacheTTL('/matches', 'finished')).toBe(3600);
      expect(getEndpointCacheTTL('/matches', 'upcoming')).toBe(900);
      expect(getEndpointCacheTTL('/stats')).toBe(600);
      expect(getEndpointCacheTTL('/leagues')).toBe(3600);
      expect(getEndpointCacheTTL('/unknown')).toBe(300);
    });
  });
});
