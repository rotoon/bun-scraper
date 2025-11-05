/**
 * Input validation utilities
 */

export function validateMatchId(matchId: string | null): string {
  if (!matchId) {
    throw new Error('Match ID is required')
  }

  // Remove any whitespace
  const trimmed = matchId.trim()

  if (!trimmed) {
    throw new Error('Match ID cannot be empty')
  }

  // Check if it's a valid format (numbers or alphanumeric)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Invalid Match ID format')
  }

  // Length validation
  if (trimmed.length < 3 || trimmed.length > 50) {
    throw new Error('Match ID must be between 3 and 50 characters')
  }

  return trimmed
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}