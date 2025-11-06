import * as cheerio from 'cheerio';
import type { Match, Team, MatchStatus } from './types';

export class FootballScraper {
  private readonly baseUrl =
    process.env.BASE_URL || 'https://doball.live/?type=FOOTBALL';
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async scrapeMatches(): Promise<Match[]> {
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] Starting scrape from ${this.baseUrl}`,
      );

      const response = await fetch(this.baseUrl, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const matches = this.parseMatchesFromHTML(html);

      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] Successfully parsed ${matches.length} matches`,
      );
      return matches;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Scrape failed:`, error);
      throw new Error(
        `Failed to scrape matches: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private parseMatchesFromHTML(html: string): Match[] {
    const $ = cheerio.load(html);
    const matches: Match[] = [];

    $("#show > a[href*='/vdo/?matchid=']").each((_, elem) => {
      try {
        const match = this.extractMatchData($, $(elem));
        if (match) {
          matches.push(match);
        }
      } catch (error) {
        console.error(`Error parsing match:`, error);
      }
    });

    return matches;
  }

  private extractMatchData(
    $: cheerio.CheerioAPI,
    matchLink: cheerio.Cheerio<any>,
  ): Match | null {
    const href = matchLink.attr('href') || '';
    const matchIdMatch = href.match(/matchid=(\d+)/);

    if (!matchIdMatch) return null;

    const matchId =
      matchIdMatch[1] || Math.random().toString(36).substring(2, 11);
    const now = new Date();

    // Extract date
    let matchDate = '';
    matchLink
      .prevAll('div.date-play')
      .first()
      .each((_, dateElem) => {
        const dateText = $(dateElem).text().trim();
        if (dateText) matchDate = dateText;
      });

    // Extract league
    let league = 'UNKNOWN';
    matchLink
      .prevAll('div.league')
      .first()
      .each((_, leagueElem) => {
        const leagueText = $(leagueElem).text().trim();
        if (leagueText) league = leagueText;
      });

    // Extract teams
    const teams = this.extractTeams($, matchLink);

    // Extract time
    const matchTime = this.extractMatchTime($, matchLink);

    // Check if live
    const isLive = matchLink.find('div.button-paly .live-now').length > 0;

    // Calculate match date object and timestamp
    const { matchDateObj, timestamp } = this.calculateMatchTimestamp(
      matchDate,
      matchTime,
      now,
    );

    // Determine status
    const status = this.determineMatchStatus(isLive, matchDateObj, now);

    return {
      matchId,
      matchTime,
      matchDate,
      teams,
      league,
      matchTitle: `${teams[0]?.name || 'Unknown'} vs ${teams[1]?.name || 'Unknown'}`,
      teamsDisplay: `${teams[0]?.name || 'Unknown'} - ${teams[1]?.name || 'Unknown'}`,
      datePlay: matchDate,
      streamUrl: href,
      timestamp,
      status,
    };
  }

  private extractTeams(
    $: cheerio.CheerioAPI,
    matchLink: cheerio.Cheerio<any>,
  ): Team[] {
    const teams: Team[] = [
      { name: 'Unknown Home', logo: null },
      { name: 'Unknown Away', logo: null },
    ];

    matchLink
      .find('div.divTableCell.away-team .team-hw')
      .each((index, teamElem) => {
        const teamSpan = $(teamElem);
        const teamText = teamSpan.text().trim();
        const teamLogo = teamSpan.find('img').attr('src') || null;

        if (index === 0) {
          teams[0] = { name: teamText, logo: teamLogo };
        } else if (index === 1) {
          teams[1] = { name: teamText, logo: teamLogo };
        }
      });

    return teams;
  }

  private extractMatchTime(
    $: cheerio.CheerioAPI,
    matchLink: cheerio.Cheerio<any>,
  ): string {
    let matchTime = '00:00';
    matchLink.find('div.divTableCell.status-match').each((_, statusElem) => {
      const statusText = $(statusElem).text().trim();
      const timeMatch = statusText.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        matchTime = timeMatch[1] || '00:00';
      }
    });
    return matchTime;
  }

  private calculateMatchTimestamp(
    matchDate: string,
    matchTime: string,
    _now: Date,
  ): { matchDateObj: Date; timestamp: string } {
    let matchDateObj = new Date();

    if (matchDate) {
      const dateMatch = matchDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        matchDateObj = new Date(`${year}-${month}-${day}T${matchTime}:00`);
      }
    }

    const timestamp = matchDateObj.getTime().toString();
    return { matchDateObj, timestamp };
  }

  private determineMatchStatus(
    isLive: boolean,
    matchDateObj: Date,
    now: Date,
  ): MatchStatus {
    if (isLive) return 'live';
    if (matchDateObj > now) return 'upcoming';
    return 'finished';
  }
}

// Export singleton instance
export const scraper = new FootballScraper();
