# Quick Start Guide

This guide will help you get started with the Football Scraper API quickly and efficiently.

## Prerequisites

- Node.js 18+ or Bun runtime
- Basic knowledge of REST APIs
- Understanding of JSON data format

## Getting Started

### 1. Start the Server

```bash
# Clone the repository
git clone <repository-url>
cd bun-scraper

# Install dependencies
bun install

# Start the development server
bun run dev
```

The server will start on `http://localhost:3000`

### 2. Test Basic Endpoints

Open your browser or use curl to test:

```bash
# Check server health
curl http://localhost:3000/health

# Get API documentation
curl http://localhost:3000/docs

# Get some matches
curl http://localhost:3000/api/v1/matches
```

## Common Use Cases

### 1. Display Live Matches

```bash
# Get all live matches
curl http://localhost:3000/api/v1/matches/live
```

**JavaScript Example:**

```javascript
async function fetchLiveMatches() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/matches/live');
    const data = await response.json();

    if (data.success) {
      console.log(`Found ${data.data.length} live matches`);
      data.data.forEach(match => {
        console.log(
          `${match.teams[0].name} vs ${match.teams[1].name} - ${match.league}`,
        );
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchLiveMatches();
```

### 2. Search for Matches

```bash
# Search for Manchester United matches
curl "http://localhost:3000/api/v1/matches/search?q=Manchester%20United"
```

**JavaScript Example:**

```javascript
async function searchMatches(query) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/matches/search?q=${encodeURIComponent(query)}`,
    );
    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      console.error('Search failed:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Usage
const results = await searchMatches('Premier League');
console.log(`Found ${results.length} matches`);
```

### 3. Filter by League

```bash
# Get Premier League matches
curl "http://localhost:3000/api/v1/matches?league=Premier%20League"
```

**JavaScript Example:**

```javascript
async function getLeagueMatches(leagueName, page = 1, limit = 20) {
  const params = new URLSearchParams({
    league: leagueName,
    page: page.toString(),
    limit: limit.toString(),
  });

  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/matches?${params}`,
    );
    const data = await response.json();

    if (data.success) {
      return {
        matches: data.data.matches,
        pagination: data.data.pagination,
      };
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
const premierLeague = await getLeagueMatches('Premier League');
console.log(`Total matches: ${premierLeague.pagination.total}`);
```

### 4. Get Stream URLs

```bash
# Get stream URL for a specific match
curl http://localhost:3000/api/v1/stream/match123

# Get multiple stream URLs
curl -X POST http://localhost:3000/api/v1/streams/batch \
  -H "Content-Type: application/json" \
  -d '{"matchIds": ["match1", "match2", "match3"]}'
```

**JavaScript Example:**

```javascript
async function getStreamUrls(matchIds) {
  try {
    const response = await fetch('http://localhost:3000/api/v1/streams/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ matchIds }),
    });

    const data = await response.json();

    if (data.success) {
      return data.data.streams;
    } else {
      console.error('Failed to get streams:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Usage
const streams = await getStreamUrls(['match1', 'match2', 'match3']);
streams.forEach(stream => {
  if (stream.isAvailable) {
    console.log(`${stream.matchId}: ${stream.streamUrl}`);
  } else {
    console.log(`${stream.matchId}: No stream available`);
  }
});
```

## Rate Limiting & Caching

### Rate Limiting

- **100 requests per minute** per IP
- Monitor headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- On limit exceeded: HTTP 429 with `Retry-After` header

### Smart Caching

```javascript
// Implement client-side caching
const cache = new Map();

async function cachedFetch(url, ttl = 300000) {
  // 5 minutes TTL
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

// Usage with ETag support
async function fetchWithCache(url) {
  const cached = cache.get(url);

  const headers = {};
  if (cached && cached.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    // Data hasn't changed
    return cached.data;
  }

  const data = await response.json();

  if (response.ok && data.success) {
    cache.set(url, {
      data,
      etag: response.headers.get('ETag'),
      timestamp: Date.now(),
    });
  }

  return data;
}
```

## Error Handling

Always check the `success` field and handle errors properly:

```javascript
async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
      if (data.errors) {
        // Validation errors
        console.error('Validation errors:');
        data.errors.forEach(error => {
          console.error(`  ${error.field}: ${error.message}`);
        });
      } else {
        // General error
        console.error('API Error:', data.message);
      }
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}

// Usage
const matches = await safeApiCall(
  'http://localhost:3000/api/v1/matches?status=live',
);
if (matches) {
  console.log(`Found ${matches.length} live matches`);
}
```

## Building a Simple App

### Live Score Dashboard (HTML + JavaScript)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Live Football Scores</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
      }
      .match {
        border: 1px solid #ddd;
        margin: 10px 0;
        padding: 15px;
      }
      .live {
        border-left: 5px solid #ff4444;
      }
      .teams {
        font-weight: bold;
        font-size: 18px;
      }
      .league {
        color: #666;
        margin: 5px 0;
      }
      .time {
        color: #888;
      }
      .error {
        color: red;
      }
    </style>
  </head>
  <body>
    <h1>Live Football Scores</h1>
    <div id="matches"></div>
    <div id="error" class="error"></div>

    <script>
      async function fetchLiveMatches() {
        try {
          const response = await fetch(
            'http://localhost:3000/api/v1/matches/live',
          );
          const data = await response.json();

          const matchesDiv = document.getElementById('matches');
          const errorDiv = document.getElementById('error');

          if (!data.success) {
            errorDiv.textContent = `Error: ${data.message}`;
            matchesDiv.innerHTML = '';
            return;
          }

          errorDiv.textContent = '';

          if (data.data.length === 0) {
            matchesDiv.innerHTML = '<p>No live matches at the moment.</p>';
            return;
          }

          matchesDiv.innerHTML = data.data
            .map(
              match => `
                    <div class="match live">
                        <div class="teams">${match.teams[0].name} vs ${match.teams[1].name}</div>
                        <div class="league">${match.league}</div>
                        <div class="time">Kickoff: ${match.matchTime}</div>
                        ${match.streamUrl ? `<button onclick="openStream('${match.matchId}')">Watch Stream</button>` : ''}
                    </div>
                `,
            )
            .join('');
        } catch (error) {
          document.getElementById('error').textContent =
            `Network error: ${error.message}`;
          document.getElementById('matches').innerHTML = '';
        }
      }

      function openStream(matchId) {
        window.open(`http://localhost:3000/api/v1/stream/${matchId}`, '_blank');
      }

      // Auto-refresh every 30 seconds
      fetchLiveMatches();
      setInterval(fetchLiveMatches, 30000);
    </script>
  </body>
</html>
```

### Match Search Application

```javascript
class FootballSearchApp {
  constructor() {
    this.baseUrl = 'http://localhost:3000/api/v1';
    this.setupEventListeners();
  }

  setupEventListeners() {
    const searchInput = document.getElementById('search');
    const leagueSelect = document.getElementById('league');
    const statusSelect = document.getElementById('status');

    // Search on input change with debouncing
    let searchTimeout;
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.search(), 500);
    });

    leagueSelect.addEventListener('change', () => this.search());
    statusSelect.addEventListener('change', () => this.search());
  }

  async search(page = 1) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
    });

    const searchQuery = document.getElementById('search').value.trim();
    if (searchQuery.length >= 2) {
      params.set('q', searchQuery);
    }

    const league = document.getElementById('league').value;
    if (league) {
      params.set('league', league);
    }

    const status = document.getElementById('status').value;
    if (status) {
      params.set('status', status);
    }

    try {
      this.showLoading();
      const response = await fetch(`${this.baseUrl}/matches?${params}`);
      const data = await response.json();

      if (data.success) {
        this.displayResults(data.data);
        this.displayPagination(data.data.pagination);
      } else {
        this.showError(data.message);
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  displayResults(data) {
    const resultsDiv = document.getElementById('results');

    if (data.matches.length === 0) {
      resultsDiv.innerHTML = '<p>No matches found.</p>';
      return;
    }

    resultsDiv.innerHTML = data.matches
      .map(
        match => `
            <div class="match ${match.status}">
                <div class="teams">${match.teams[0].name} vs ${match.teams[1].name}</div>
                <div class="league">${match.league}</div>
                <div class="time">${match.matchDate} ${match.matchTime}</div>
                <div class="status">${match.status}</div>
                ${match.streamUrl ? `<button onclick="openStream('${match.matchId}')">Watch</button>` : ''}
            </div>
        `,
      )
      .join('');
  }

  displayPagination(pagination) {
    const paginationDiv = document.getElementById('pagination');

    if (pagination.totalPages <= 1) {
      paginationDiv.innerHTML = '';
      return;
    }

    let html = '<div class="pagination">';

    if (pagination.hasPrev) {
      html += `<button onclick="app.search(${pagination.page - 1})">Previous</button>`;
    }

    html += `<span>Page ${pagination.page} of ${pagination.totalPages}</span>`;

    if (pagination.hasNext) {
      html += `<button onclick="app.search(${pagination.page + 1})">Next</button>`;
    }

    html += '</div>';
    paginationDiv.innerHTML = html;
  }

  showLoading() {
    document.getElementById('results').innerHTML = '<p>Loading...</p>';
    document.getElementById('pagination').innerHTML = '';
  }

  showError(message) {
    document.getElementById('results').innerHTML =
      `<p class="error">Error: ${message}</p>`;
    document.getElementById('pagination').innerHTML = '';
  }
}

// Initialize app
const app = new FootballSearchApp();
```

## Production Considerations

### 1. Use Environment Variables

```javascript
// config.js
const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
  cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000, // 5 minutes
  refreshInterval: parseInt(process.env.REFRESH_INTERVAL) || 30000, // 30 seconds
};
```

### 2. Implement Retry Logic

```javascript
async function apiCallWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const retryAfter =
          parseInt(response.headers.get('Retry-After')) || delay;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}
```

### 3. Monitor Rate Limits

```javascript
class RateLimitMonitor {
  constructor() {
    this.requests = [];
    this.maxRequests = 100;
    this.windowMs = 60000; // 1 minute
  }

  canMakeRequest() {
    const now = Date.now();
    const recentRequests = this.requests.filter(
      time => now - time < this.windowMs,
    );
    this.requests = recentRequests;

    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }

  getWaitTime() {
    if (this.requests.length < this.maxRequests) return 0;

    const oldestRequest = this.requests[0];
    const waitTime = this.windowMs - (Date.now() - oldestRequest);
    return Math.max(0, waitTime);
  }
}
```

## Next Steps

1. **Read the full API documentation**: `API_DOCUMENTATION.md`
2. **Explore advanced filtering and pagination**
3. **Implement proper error handling and retry logic**
4. **Set up monitoring and logging**
5. **Consider using a WebSocket for real-time updates**

## Need Help?

- **Full API Documentation**: See `API_DOCUMENTATION.md`
- **Health Check**: `http://localhost:3000/health`
- **API Endpoints Overview**: `http://localhost:3000/docs`

Happy coding! 🚀
