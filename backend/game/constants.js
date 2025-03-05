// game/constants.js

/**
 * Game categories
 * @type {Array<string>}
 */
const GAME_CATEGORIES = [
  "Best song for a road trip",
  "Song that makes you dance",
  "Most nostalgic song",
  "Best workout song",
  "Song for a movie soundtrack",
  "Song that tells a story",
  "Best song to fall asleep to",
  "Most underrated song",
  "Song that changed your life",
  "Best song for a first date",
  "Song that makes you emotional",
  "Best song for karaoke"
];

/**
 * Phase durations in seconds
 * @type {Object}
 */
const PHASE_DURATIONS = {
  category: 10,    // Initial category reveal
  submission: 30,  // Song selection
  playback: 30,    // Per song playback duration
  voting: 20,      // Voting phase
  results: 15      // Results display
};

module.exports = {
  GAME_CATEGORIES,
  PHASE_DURATIONS
};