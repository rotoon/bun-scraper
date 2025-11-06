# Football Scraper API Documentation

## Overview

The Football Scraper API provides comprehensive access to football match data, live scores, streaming information, and advanced filtering capabilities. This RESTful API is built with performance, caching, and rate limiting in mind.

## Base URL

```
http://localhost:3000/api/v1
```

**Important**: Legacy endpoints without `/v1/` have been removed. Please use the v1 endpoints only.

## Authentication

Currently, no authentication is required. However, rate limiting is applied to ensure fair usage.

## Rate Limiting

- **Default limit**: 100 requests per minute per IP
- **Headers included in every response**:
  - `X-RateLimit-Limit`: Maximum requests per minute
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets
- **Response on limit exceeded**: 429 Too Many Requests with `Retry-After` header

## Caching Strategy

The API implements intelligent caching with the following TTL (Time To Live):

- **Live matches**: 30 seconds
- **Match data**: 5-15 minutes depending on match status
- **Statistics**: 10 minutes
- **Leagues**: 1 hour
- **Search results**: 5 minutes

### Cache Headers

- `Cache-Control`: Indicates caching policy and TTL
- `ETag`: For conditional requests
- **304 Not Modified**: Returned when data hasn't changed (use `If-None-Match` header)

## Response Format

All API responses follow a consistent structure:

```json
{
  "data": {
    // Response data varies by endpoint
  },
  "success": true,
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"abc123def456\"",
    "cacheControl": "public, max-age=300, must-revalidate",
    "rateLimitRemaining": 95,
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

### Response Fields

- `data`: The actual response data (varies by endpoint)
- `success`: Boolean indicating if the request was successful
- `message`: Human-readable message describing the result
- `timestamp`: ISO 8601 timestamp of the response
- `cache`: Object containing caching metadata
  - `etag`: Entity tag for conditional requests
  - `cacheControl`: Cache control header value
  - `rateLimitRemaining`: Number of requests remaining in current window
  - `expiresAt`: When the cached data expires

## Error Handling

All errors follow RFC 9457 Problem Details format:

```json
{
  "type": "/problems/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid query parameters",
  "errors": [
    {
      "field": "page",
      "message": "Page must be between 1 and 1000",
      "code": "INVALID_PAGE"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `304 Not Modified`: Data hasn't changed (conditional request)
- `400 Bad Request`: Invalid parameters
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Endpoints

### 1. Get Matches

Retrieve football matches with advanced filtering, sorting, and pagination.

**Endpoint**: `GET /api/v1/matches`

#### Parameters

| Parameter  | Type   | Required | Default | Min/Max     | Description                                                       |
| ---------- | ------ | -------- | ------- | ----------- | ----------------------------------------------------------------- |
| `page`     | number | No       | 1       | 1-1000      | Page number for pagination                                        |
| `limit`    | number | No       | 20      | 1-999       | Items per page                                                    |
| `status`   | string | No       | -       | -           | Filter by match status: `live`, `upcoming`, `finished`, `unknown` |
| `league`   | string | No       | -       | 2-100 chars | Filter by league name (case-insensitive partial match)            |
| `dateFrom` | string | No       | -       | -           | Filter matches from this date (format: YYYY-MM-DD)                |
| `dateTo`   | string | No       | -       | -           | Filter matches until this date (format: YYYY-MM-DD)               |
| `team`     | string | No       | -       | 2-100 chars | Filter by team name (case-insensitive)                            |
| `sort`     | string | No       | `date`  | -           | Sort field: `date`, `league`, `status`                            |
| `order`    | string | No       | `desc`  | -           | Sort order: `asc`, `desc`                                         |

#### Example Requests

```bash
# Get all matches with default pagination
curl -X GET "http://localhost:3000/api/v1/matches"

# Get live matches only
curl -X GET "http://localhost:3000/api/v1/matches?status=live"

# Get Premier League matches sorted by date (ascending)
curl -X GET "http://localhost:3000/api/v1/matches?league=Premier%20League&sort=date&order=asc"

# Get matches for specific date range
curl -X GET "http://localhost:3000/api/v1/matches?dateFrom=2024-01-01&dateTo=2024-01-31"

# Get matches for specific team
curl -X GET "http://localhost:3000/api/v1/matches?team=Manchester%20United"

# Paginated results
curl -X GET "http://localhost:3000/api/v1/matches?page=2&limit=10"

# Complex filtering
curl -X GET "http://localhost:3000/api/v1/matches?status=live&league=Premier%20League&sort=date&order=asc&limit=50"
```

#### Response Format

```json
{
  "data": {
    "matches": [
      {
        "id": 1,
        "matchId": "match123",
        "matchTime": "19:00",
        "matchDate": "2024-01-15",
        "teams": [
          { "name": "Team A", "logo": "https://example.com/logo1.png" },
          { "name": "Team B", "logo": "https://example.com/logo2.png" }
        ],
        "league": "Premier League",
        "matchTitle": "Team A vs Team B",
        "teamsDisplay": "Team A vs Team B",
        "datePlay": "2024-01-15",
        "streamUrl": "http://example.com/stream",
        "timestamp": "2024-01-15T19:00:00Z",
        "status": "live",
        "scrapedAt": 1705316400,
        "createdAt": 1705316400,
        "updatedAt": 1705316400
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "status": "live",
      "league": "Premier League",
      "dateFrom": "2024-01-01",
      "dateTo": "2024-01-31",
      "team": "Manchester",
      "sort": "date",
      "order": "asc"
    }
  },
  "success": true,
  "message": "Retrieved 20 matches",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"abc123def456\"",
    "cacheControl": "public, max-age=300, must-revalidate",
    "rateLimitRemaining": 95,
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

### 2. Get Live Matches

Retrieve currently live matches with minimal caching for real-time data.

**Endpoint**: `GET /api/v1/matches/live`

**Cache TTL**: 30 seconds

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/matches/live"
```

#### Response Format

```json
{
  "data": [
    {
      "id": 1,
      "matchId": "match123",
      "matchTime": "19:00",
      "matchDate": "2024-01-15",
      "teams": [
        { "name": "Team A", "logo": null },
        { "name": "Team B", "logo": null }
      ],
      "league": "Premier League",
      "matchTitle": "Team A vs Team B",
      "teamsDisplay": "Team A vs Team B",
      "datePlay": "2024-01-15",
      "streamUrl": "http://example.com/stream",
      "timestamp": "2024-01-15T19:00:00Z",
      "status": "live"
    }
  ],
  "success": true,
  "message": "Retrieved 5 live matches",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"def456abc789\"",
    "cacheControl": "public, max-age=30, must-revalidate",
    "expiresAt": "2024-01-15T10:30:30Z"
  }
}
```

### 3. Search Matches

Search matches by team name or league using fuzzy matching.

**Endpoint**: `GET /api/v1/matches/search`

#### Parameters

| Parameter | Type   | Required | Min/Max     | Description                     |
| --------- | ------ | -------- | ----------- | ------------------------------- |
| `q`       | string | Yes      | 2-100 chars | Search query (case-insensitive) |

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/matches/search?q=Manchester"
```

#### Response Format

```json
{
  "data": [
    {
      "id": 1,
      "matchId": "match123",
      "matchTime": "19:00",
      "matchDate": "2024-01-15",
      "teams": [
        { "name": "Manchester United", "logo": null },
        { "name": "Liverpool", "logo": null }
      ],
      "league": "Premier League",
      "matchTitle": "Manchester United vs Liverpool",
      "teamsDisplay": "Manchester United vs Liverpool",
      "datePlay": "2024-01-15",
      "streamUrl": "http://example.com/stream",
      "timestamp": "2024-01-15T19:00:00Z",
      "status": "upcoming"
    }
  ],
  "success": true,
  "message": "Found 3 matches matching \"Manchester\"",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"search123456\"",
    "cacheControl": "public, max-age=300, must-revalidate",
    "expiresAt": "2024-01-15T10:35:00Z"
  }
}
```

### 4. Get Live Matches with Streams

Get live matches with stream availability status.

**Endpoint**: `GET /api/v1/matches/live/streams`

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/matches/live/streams"
```

#### Response Format

```json
{
  "data": [
    {
      "id": 1,
      "matchId": "match123",
      "matchTime": "19:00",
      "matchDate": "2024-01-15",
      "teams": [
        { "name": "Team A", "logo": null },
        { "name": "Team B", "logo": null }
      ],
      "league": "Premier League",
      "matchTitle": "Team A vs Team B",
      "teamsDisplay": "Team A vs Team B",
      "datePlay": "2024-01-15",
      "streamUrl": "http://example.com/stream",
      "timestamp": "2024-01-15T19:00:00Z",
      "status": "live",
      "hasStream": true
    }
  ],
  "success": true,
  "message": "Retrieved 5 live matches with stream status",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 5. Get Statistics

Get database statistics and system information.

**Endpoint**: `GET /api/v1/stats`

**Cache TTL**: 10 minutes

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/stats"
```

#### Response Format

```json
{
  "data": {
    "totalMatches": 1250,
    "liveMatches": 8,
    "upcomingMatches": 45,
    "completedMatches": 1197,
    "totalLeagues": 15,
    "lastUpdated": 1705316400,
    "oldestMatch": 1703136000,
    "newestMatch": 1705401600
  },
  "success": true,
  "message": "Database statistics retrieved",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"stats789\"",
    "cacheControl": "public, max-age=600, must-revalidate",
    "expiresAt": "2024-01-15T10:40:00Z"
  }
}
```

### 6. Get Leagues

Get list of all available leagues in the database.

**Endpoint**: `GET /api/v1/leagues`

**Cache TTL**: 1 hour

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/leagues"
```

#### Response Format

```json
{
  "data": [
    {
      "name": "Premier League",
      "count": 380,
      "country": "England"
    },
    {
      "name": "La Liga",
      "count": 380,
      "country": "Spain"
    },
    {
      "name": "Serie A",
      "count": 380,
      "country": "Italy"
    }
  ],
  "success": true,
  "message": "Retrieved 15 leagues",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "etag": "\"leagues456\"",
    "cacheControl": "public, max-age=3600, must-revalidate",
    "expiresAt": "2024-01-15T11:30:00Z"
  }
}
```

### 7. Refresh Data

Manually trigger data refresh from source.

**Endpoint**: `POST /api/v1/refresh`

#### Example Request

```bash
curl -X POST "http://localhost:3000/api/v1/refresh"
```

#### Response Format

```json
{
  "data": {
    "matchesAdded": 25,
    "matchesUpdated": 8,
    "processingTime": 12.5,
    "lastScrape": 1705316400
  },
  "success": true,
  "message": "Data refresh completed successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 8. Clean Old Data

Remove old matches from database based on age.

**Endpoint**: `POST /api/v1/clean`

#### Parameters

| Parameter | Type   | Required | Default | Min/Max | Description                       |
| --------- | ------ | -------- | ------- | ------- | --------------------------------- |
| `hours`   | number | No       | 24      | 1-168   | Delete matches older than X hours |

#### Example Request

```bash
# Clean matches older than 24 hours (default)
curl -X POST "http://localhost:3000/api/v1/clean"

# Clean matches older than 72 hours
curl -X POST "http://localhost:3000/api/v1/clean?hours=72"
```

#### Response Format

```json
{
  "data": {
    "matchesDeleted": 156,
    "hoursThreshold": 24,
    "cleanupTime": 2.3
  },
  "success": true,
  "message": "Cleaned 156 matches older than 24 hours",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 9. Get Stream URL

Get iframe stream URL for a specific match.

**Endpoint**: `GET /api/v1/stream/{matchId}`

#### Path Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `matchId` | string | Yes      | Match ID from the matches list |

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/stream/match123"
```

#### Response Format

```json
{
  "data": {
    "matchId": "match123",
    "streamUrl": "http://example.com/stream/iframe",
    "isAvailable": true,
    "source": "primary",
    "quality": "HD"
  },
  "success": true,
  "message": "Stream URL retrieved successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 10. Get Batch Stream URLs

Get stream URLs for multiple matches in a single request.

**Endpoint**: `POST /api/v1/streams/batch`

#### Request Body

```json
{
  "matchIds": ["match1", "match2", "match3"]
}
```

#### Example Request

```bash
curl -X POST "http://localhost:3000/api/v1/streams/batch" \
  -H "Content-Type: application/json" \
  -d '{"matchIds": ["match1", "match2", "match3"]}'
```

#### Response Format

```json
{
  "data": {
    "streams": [
      {
        "matchId": "match1",
        "streamUrl": "http://example.com/stream1",
        "isAvailable": true
      },
      {
        "matchId": "match2",
        "streamUrl": null,
        "isAvailable": false,
        "error": "Stream not found"
      },
      {
        "matchId": "match3",
        "streamUrl": "http://example.com/stream3",
        "isAvailable": true
      }
    ],
    "total": 3,
    "available": 2,
    "unavailable": 1
  },
  "success": true,
  "message": "Retrieved 2 out of 3 stream URLs",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Data Types

### Match Object

```typescript
interface Match {
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

interface Team {
  name: string;
  logo: string | null;
}

type MatchStatus = 'live' | 'upcoming' | 'finished' | 'unknown';
```

### Pagination Info

```typescript
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Cache Info

```typescript
interface CacheInfo {
  etag?: string;
  cacheControl?: string;
  rateLimitRemaining?: number;
  expiresAt?: string;
}
```

### Statistics

```typescript
interface Statistics {
  totalMatches: number;
  liveMatches: number;
  upcomingMatches: number;
  completedMatches: number;
  totalLeagues: number;
  lastUpdated: number;
  oldestMatch: number;
  newestMatch: number;
}
```

## Best Practices

### 1. Conditional Requests

Use `If-None-Match` header with ETag values to avoid unnecessary data transfer:

```bash
curl -X GET "http://localhost:3000/api/v1/matches" \
  -H "If-None-Match: \"abc123def456\""
```

If the data hasn't changed, you'll receive a `304 Not Modified` response.

### 2. Rate Limit Handling

Monitor rate limit headers and implement exponential backoff:

```javascript
async function fetchWithRetry(url, retries = 3) {
  try {
    const response = await fetch(url);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
      console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return fetchWithRetry(url, retries - 1);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      const delay = Math.pow(2, 4 - retries) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}
```

### 3. Efficient Pagination

Use appropriate page sizes and implement proper pagination logic:

```javascript
async function getAllMatches(url, maxPages = 50) {
  let allMatches = [];
  let page = 1;

  while (page <= maxPages) {
    const response = await fetch(`${url}?page=${page}&limit=100`);
    const data = await response.json();

    if (!data.success) break;

    allMatches = allMatches.concat(data.data.matches);

    if (!data.data.pagination.hasNext) break;
    page++;
  }

  return allMatches;
}
```

### 4. Caching Strategy

Respect `Cache-Control` headers and implement client-side caching:

```javascript
// Simple in-memory cache with TTL
const cache = new Map();

async function cachedFetch(url, ttl = 300000) {
  // 5 minutes default TTL
  const cacheKey = url;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const response = await fetch(url);
  const data = await response.json();

  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  return data;
}
```

### 5. Error Handling

Always check the `success` field and handle validation errors:

```javascript
async function handleApiResponse(response) {
  const data = await response.json();

  if (!data.success) {
    if (data.errors && Array.isArray(data.errors)) {
      // Handle validation errors
      console.error('Validation errors:', data.errors);
      data.errors.forEach(error => {
        console.error(`${error.field}: ${error.message}`);
      });
    } else {
      // Handle general errors
      console.error('API Error:', data.message);
    }
    return null;
  }

  return data.data;
}
```

## Common Use Cases

### 1. Live Score Dashboard

```javascript
// Get live matches every 30 seconds
async function updateLiveScores() {
  try {
    const response = await fetch('/api/v1/matches/live');
    const data = await response.json();

    if (data.success) {
      displayLiveMatches(data.data);
    }
  } catch (error) {
    console.error('Failed to update live scores:', error);
  }
}

// Update every 30 seconds
setInterval(updateLiveScores, 30000);
```

### 2. Match Search

```javascript
async function searchMatches(query) {
  if (query.length < 2) return [];

  try {
    const response = await fetch(
      `/api/v1/matches/search?q=${encodeURIComponent(query)}`,
    );
    const data = await response.json();

    return data.success ? data.data : [];
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
```

### 3. League Filtering

```javascript
async function getLeagueMatches(leagueName, filters = {}) {
  const params = new URLSearchParams({
    league: leagueName,
    ...filters,
  });

  try {
    const response = await fetch(`/api/v1/matches?${params}`);
    const data = await response.json();

    if (data.success) {
      return {
        matches: data.data.matches,
        pagination: data.data.pagination,
        filters: data.data.filters,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get league matches:', error);
    return null;
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```javascript
class FootballAPI {
  constructor(baseUrl = 'http://localhost:3000/api/v1') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }

    return data.data;
  }

  async getMatches(params = {}) {
    const query = new URLSearchParams(params);
    return this.request(`/matches?${query}`);
  }

  async getLiveMatches() {
    return this.request('/matches/live');
  }

  async searchMatches(query) {
    return this.request(`/matches/search?q=${encodeURIComponent(query)}`);
  }

  async getMatchStream(matchId) {
    return this.request(`/stream/${matchId}`);
  }

  async getBatchStreamUrls(matchIds) {
    return this.request('/streams/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchIds }),
    });
  }
}

// Usage
const api = new FootballAPI();

// Get live matches
const liveMatches = await api.getLiveMatches();

// Get stream URLs for multiple matches
const streams = await api.getBatchStreamUrls(['match1', 'match2', 'match3']);
```

### Python

```python
import requests
from typing import List, Dict, Optional

class FootballAPI:
    def __init__(self, base_url: str = "http://localhost:3000/api/v1"):
        self.base_url = base_url
        self.session = requests.Session()

    def request(self, endpoint: str, **kwargs) -> Dict:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request('GET', url, **kwargs)
        response.raise_for_status()
        data = response.json()

        if not data.get('success'):
            raise Exception(data.get('message', 'API request failed'))

        return data['data']

    def get_matches(self, **params) -> Dict:
        return self.request('/matches', params=params)

    def get_live_matches(self) -> List[Dict]:
        return self.request('/matches/live')

    def search_matches(self, query: str) -> List[Dict]:
        return self.request('/matches/search', params={'q': query})

    def get_match_stream(self, match_id: str) -> Dict:
        return self.request(f'/stream/{match_id}')

    def get_batch_stream_urls(self, match_ids: List[str]) -> Dict:
        return self.request('/streams/batch',
                          method='POST',
                          json={'matchIds': match_ids})

# Usage
api = FootballAPI()

# Get live matches
live_matches = api.get_live_matches()

# Get stream URLs for multiple matches
streams = api.get_batch_stream_urls(['match1', 'match2', 'match3'])
```

## Support and Troubleshooting

### Common Issues

1. **Rate Limiting**: Monitor `X-RateLimit-Remaining` header and implement backoff
2. **Caching**: Use `If-None-Match` header for efficient data retrieval
3. **Large Datasets**: Use pagination to avoid timeouts
4. **Search Performance**: Use specific search terms for better results

### Health Check

Check API status and system information:

```bash
curl -X GET "http://localhost:3000/health"
```

### Documentation

- **API Documentation**: `http://localhost:3000/docs`
- **Health Status**: `http://localhost:3000/health`

## Version History

- **v2.0**: Removed legacy endpoints, improved caching, enhanced error handling
- **v1.x**: Initial API with basic functionality

## License

This API is part of the Football Scraper project. See the project repository for license information.
