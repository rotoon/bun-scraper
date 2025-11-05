#!/usr/bin/env bun

import { FootballAPIServer } from './src/server'

// Get port from environment or use default
const PORT = parseInt(process.env.PORT || '3000', 10)

// Create and start server
const server = new FootballAPIServer(PORT)

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  server.stop()
  process.exit(0)
})

// Start the server
server.start()
