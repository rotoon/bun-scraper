#!/usr/bin/env bun

import { FootballAPIServer } from './server';
import { footballService } from './services';

// Get port from environment or use default
const PORT = parseInt(process.env.PORT || '3000', 10);
const CRON_INTERVAL =
  parseInt(process.env.SCRAPE_INTERVAL_MINUTES || '15', 10) * 60 * 1000; // Convert to milliseconds

// Level 1: Basic rate limiting
let lastCronRun = 0;
const MIN_CRON_INTERVAL = 10 * 60 * 1000; // 10 นาทีขั้นต่ำระหว่าง runs
const MAX_CONSECUTIVE_FAILURES = 3; // สูงสุด 3 ครั้งที่ fail ติดกัน

// Level 2: Production ready status tracking
interface CronStatus {
  lastRun: Date | null;
  lastSuccess: boolean;
  consecutiveFailures: number;
  totalRuns: number;
  successfulRuns: number;
  isRunning: boolean;
}

const cronStatus: CronStatus = {
  lastRun: null,
  lastSuccess: false,
  consecutiveFailures: 0,
  totalRuns: 0,
  successfulRuns: 0,
  isRunning: false,
};

// Create and start server
const server = new FootballAPIServer(PORT);

// Level 1+2: Enhanced cron job function
async function runCronJob() {
  const now = Date.now();

  // Level 1: Rate limiting - ไม่ให้รันบ่อยเกินไป
  if (now - lastCronRun < MIN_CRON_INTERVAL) {
    console.log(
      `⏭️ Skipping cron job - too soon since last run (${Math.round((now - lastCronRun) / 60000)} min ago)`,
    );
    return;
  }

  // Level 2: ตรวจสอบว่า cron กำลังรันอยู่หรือไม่
  if (cronStatus.isRunning) {
    console.log('⏳ Previous cron job still running, skipping this run');
    return;
  }

  // Level 2: Backoff strategy - ถ้า fail ติดกันเกินไป
  if (cronStatus.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log(
      `🚫 Too many consecutive failures (${cronStatus.consecutiveFailures}), skipping next runs`,
    );

    // Reset counter หลังจากรอ 1 ชั่วโมง
    setTimeout(
      () => {
        cronStatus.consecutiveFailures = 0;
        console.log('🔄 Reset failure counter, will try again');
      },
      60 * 60 * 1000,
    );
    return;
  }

  // Start cron job
  cronStatus.isRunning = true;
  cronStatus.lastRun = new Date();
  cronStatus.totalRuns++;

  try {
    console.log(
      `[${new Date().toISOString()}] 🕐 Running scheduled cron job #${cronStatus.totalRuns}...`,
    );
    console.log(
      `📈 Current stats: ${cronStatus.successfulRuns}/${cronStatus.totalRuns} successful (${Math.round((cronStatus.successfulRuns / cronStatus.totalRuns) * 100)}%)`,
    );

    const result = await footballService.executeCronJob();

    if (result.success) {
      console.log(`✅ Cron job successful: ${result.message}`);
      console.log(
        `📊 Stats: ${result.matchesScraped} scraped, ${result.inserted} inserted, ${result.deleted} deleted (took ${result.executionTime}ms)`,
      );

      // Level 2: Update success status
      cronStatus.lastSuccess = true;
      cronStatus.successfulRuns++;
      cronStatus.consecutiveFailures = 0;
      lastCronRun = now;
    } else {
      console.error(`❌ Cron job failed: ${result.message}`);

      // Level 2: Track failures
      cronStatus.lastSuccess = false;
      cronStatus.consecutiveFailures++;
      lastCronRun = now; // ยังอัพเดท lastRun แม้ fail เพื่อ rate limiting
    }
  } catch (error) {
    console.error('❌ Cron job error:', error);

    // Level 2: Track unexpected errors
    cronStatus.lastSuccess = false;
    cronStatus.consecutiveFailures++;
    lastCronRun = now;
  } finally {
    cronStatus.isRunning = false;
  }
}

// Level 2: Enhanced cron status logger
function logCronStatus() {
  console.log('📋 Cron Job Status:');
  console.log(
    `   Last run: ${cronStatus.lastRun ? cronStatus.lastRun.toISOString() : 'Never'}`,
  );
  console.log(`   Last success: ${cronStatus.lastSuccess}`);
  console.log(`   Consecutive failures: ${cronStatus.consecutiveFailures}`);
  console.log(
    `   Success rate: ${cronStatus.totalRuns > 0 ? Math.round((cronStatus.successfulRuns / cronStatus.totalRuns) * 100) : 0}% (${cronStatus.successfulRuns}/${cronStatus.totalRuns})`,
  );
  console.log(`   Currently running: ${cronStatus.isRunning}`);
  console.log(`   Next run in: ${CRON_INTERVAL / 60000} minutes`);
}

// Start cron job
function startCronJob() {
  console.log(
    `⏰ Starting production-ready cron job every ${CRON_INTERVAL / 60000} minutes...`,
  );
  console.log(
    `🛡️ Rate limiting: minimum ${MIN_CRON_INTERVAL / 60000} minutes between runs`,
  );
  console.log(
    `🚨 Failure threshold: ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
  );

  // Log initial status
  logCronStatus();

  // Run immediately on startup (with delay)
  setTimeout(() => {
    console.log('🚀 Running first cron job on startup...');
    runCronJob();
  }, 5000); // Wait 5 seconds after server starts

  // Then run at specified interval
  setInterval(runCronJob, CRON_INTERVAL);

  // Log status every hour
  setInterval(logCronStatus, 60 * 60 * 1000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

// Start the server
server.start();

// Start cron job after server is ready
setTimeout(startCronJob, 2000);
