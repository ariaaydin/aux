// utils/types.js - Shared types for game

/**
 * Game phases enumeration
 * @enum {string}
 */
export const PHASES = {
  WAITING: 'waiting',
  CATEGORY: 'category',
  SUBMISSION: 'submission',
  PLAYBACK: 'playback',
  VOTING: 'voting',
  RESULTS: 'results',
  COMPLETED: 'completed'
};

/**
 * Player type
 * @typedef {Object} Player
 * @property {string} spotifyId - Player's Spotify ID
 * @property {string} username - Player's username
 * @property {boolean} isHost - Whether player is the host
 * @property {boolean} isReady - Whether player is ready to start
 * @property {number} points - Player's score
 * @property {Array<SongItem>} selectedSongs - Player's selected songs
 */

/**
 * Song item type
 * @typedef {Object} SongItem
 * @property {string} trackId - Spotify track ID
 * @property {string} trackName - Track name
 * @property {string} trackArtist - Track artist
 * @property {string} trackImage - Track image URL
 */

/**
 * Song submission type
 * @typedef {Object} Submission
 * @property {string} playerId - Player's Spotify ID
 * @property {string} trackId - Submitted track ID
 * @property {Array<string>} votes - Array of player IDs who voted for this submission
 */

/**
 * Leaderboard entry type
 * @typedef {Object} LeaderboardEntry
 * @property {string} spotifyId - Player's Spotify ID
 * @property {string} username - Player's username
 * @property {number} points - Player's score
 */

/**
 * Round results type
 * @typedef {Object} RoundResults
 * @property {Array<Submission>} submissions - Array of submissions with votes
 */

// Export module
export default {
  PHASES
};