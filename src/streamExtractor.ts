import * as cheerio from 'cheerio';
import { getRandomHeaders, randomDelay } from './utils/proxyRotator';
import { rateLimit } from './utils/rateLimit';
import { validateMatchId, validateUrl } from './utils/validation';

const BASE_URL = process.env.STREAM_BASE_URL || 'https://doball.live/vdo/';
const REQUEST_TIMEOUT = 15000; // 15 seconds

export interface StreamResponse {
  success: boolean;
  matchId: string;
  iframeSrc: string | null;
  hasStream: boolean;
  error?: string;
  message?: string;
}

export interface GetStreamOptions {
  userAgent?: string;
  timeout?: number;
  maxRetries?: number;
  enableRateLimit?: boolean;
}

/**
 * Extract iframe source from HTML content
 */
function extractIframeSrc(html: string): string | null {
  const $ = cheerio.load(html);

  // Try direct iframe
  let iframeSrc = $('iframe').attr('src') || null;
  if (iframeSrc && validateUrl(iframeSrc)) return iframeSrc;

  // Search in script tags
  $('script').each((_, elem) => {
    const scriptContent = $(elem).html() || '';

    // Find iframe URL in script
    const iframeMatch = scriptContent.match(
      /iframe[^>]*src=['"](https?:\/\/[^'"]+)['"]/i,
    );
    if (iframeMatch?.[1] && validateUrl(iframeMatch[1])) {
      iframeSrc = iframeMatch[1];
      return false; // Stop loop
    }

    // Find video URL
    const videoMatch = scriptContent.match(
      /(?:src|source|file)['"]\s*[:=]\s*['"](https?:\/\/[^'"]+)['"]/i,
    );
    if (videoMatch?.[1] && validateUrl(videoMatch[1])) {
      iframeSrc = videoMatch[1];
      return false;
    }
  });

  if (iframeSrc && validateUrl(iframeSrc)) return iframeSrc;

  // Try video elements
  $('video').each((_, elem) => {
    const src =
      $(elem).attr('src') || $(elem).find('source').first().attr('src');
    if (src && validateUrl(src)) {
      iframeSrc = src;
      return false;
    }
  });

  // Try embedded video players
  $('.video-player, .stream-player, .embed-responsive').each((_, elem) => {
    const dataSrc = $(elem).attr('data-src') || $(elem).attr('src');
    if (dataSrc && validateUrl(dataSrc)) {
      iframeSrc = dataSrc;
      return false;
    }
  });

  return iframeSrc && validateUrl(iframeSrc) ? iframeSrc : null;
}

/**
 * Fetch stream data for a given match ID
 */
async function getStreamData(
  matchId: string,
  options: GetStreamOptions = {},
): Promise<{ iframeSrc: string | null }> {
  const { timeout = REQUEST_TIMEOUT, userAgent } = options;

  // Random delay to avoid bot detection
  await randomDelay(300, 1000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const baseHeaders = getRandomHeaders();
    const headers: Record<string, string> = userAgent
      ? { ...baseHeaders, 'User-Agent': userAgent }
      : baseHeaders;

    const response = await fetch(`${BASE_URL}?matchid=${matchId}`, {
      headers,
      signal: controller.signal,
      cache: 'no-store', // Dynamic fetching for external API
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const iframeSrc = extractIframeSrc(html);

    // eslint-disable-next-line no-console
    console.log(
      iframeSrc
        ? `✅ Found stream for matchId: ${matchId}`
        : `⚠️ No stream found for matchId: ${matchId}`,
    );

    return { iframeSrc };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Main function to get iframe URL for a match
 */
export async function getIframeUrl(
  matchId: string,
  options: GetStreamOptions = {},
  clientIdentifier: string = 'default',
): Promise<StreamResponse> {
  const { maxRetries = 3, enableRateLimit = true } = options;

  // Rate limiting
  if (enableRateLimit) {
    const rateLimitResult = rateLimit(clientIdentifier);
    if (!rateLimitResult.success) {
      console.warn(`🚨 Rate limit exceeded for client: ${clientIdentifier}`);
      return {
        success: false,
        matchId,
        iframeSrc: null,
        hasStream: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
      };
    }
  }

  // Input validation
  try {
    const validatedMatchId = validateMatchId(matchId);
    // eslint-disable-next-line no-console
    console.log(`✅ Validated matchId: ${validatedMatchId}`);
    matchId = validatedMatchId;
  } catch (error) {
    console.error(`❌ Invalid matchId: ${matchId}`, error);
    return {
      success: false,
      matchId,
      iframeSrc: null,
      hasStream: false,
      error: 'Invalid Match ID',
      message:
        error instanceof Error
          ? error.message
          : 'Please provide a valid match ID',
    };
  }

  // Retry logic
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { iframeSrc } = await getStreamData(matchId, options);

      return {
        success: true,
        matchId,
        iframeSrc,
        hasStream: !!iframeSrc,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(
        `❌ Attempt ${attempt} failed for matchId ${matchId}:`,
        lastError.message,
      );

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        // eslint-disable-next-line no-console
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  const errorMessage = lastError?.message || 'Unknown error occurred';
  console.error(`❌ All ${maxRetries} attempts failed for matchId ${matchId}`);

  return {
    success: false,
    matchId,
    iframeSrc: null,
    hasStream: false,
    error: 'Failed to fetch stream URL',
    message: errorMessage,
  };
}

/**
 * Batch process multiple match IDs
 */
export async function getMultipleIframeUrls(
  matchIds: string[],
  options: GetStreamOptions = {},
  clientIdentifier: string = 'batch',
): Promise<StreamResponse[]> {
  const results: StreamResponse[] = [];

  for (const matchId of matchIds) {
    const result = await getIframeUrl(matchId, options, clientIdentifier);
    results.push(result);

    // Small delay between requests to avoid overwhelming the server
    await randomDelay(500, 1500);
  }

  return results;
}

/**
 * Check if a match has available stream without fetching the full URL
 */
export async function checkStreamAvailability(
  matchId: string,
): Promise<boolean> {
  try {
    const result = await getIframeUrl(matchId, {
      timeout: 5000,
      maxRetries: 1,
    });
    return result.hasStream;
  } catch {
    return false;
  }
}
