// game/stateManager.js - Game state management

const mongoose = require('mongoose');
const { GAME_CATEGORIES } = require('./constants');

/**
 * Convert a game room object to a client-friendly state object
 * @param {Object} gameRoom - Game room document from MongoDB
 * @returns {Object} Client-friendly game state
 */
const gameStateForClient = (gameRoom) => {
  // Prepare leaderboard sorted by points
  const leaderboard = gameRoom.players.map(player => ({
    spotifyId: player.spotifyId,
    username: player.username,
    points: player.points
  })).sort((a, b) => b.points - a.points);

  const currentRoundIndex = gameRoom.currentRound - 1;
  let timeLeft = 0;
  let category = '';
  let submissions = [];
  let currentPhase = '';
  let roundResults = null;

  if (currentRoundIndex >= 0 && currentRoundIndex < gameRoom.rounds.length) {
    const currentRound = gameRoom.rounds[currentRoundIndex];
    currentPhase = currentRound.phase;
    category = currentRound.category;
    
    // Calculate time left based on phase end time
    if (currentRound.phaseEndTime) {
      timeLeft = Math.max(0, Math.floor((new Date(currentRound.phaseEndTime) - new Date()) / 1000));
    }
    
    // For playback and voting phases, include submissions
    if (currentRound.phase === 'playback' || currentRound.phase === 'voting') {
      submissions = currentRound.submissions.map(sub => ({
        playerId: sub.playerId,
        trackId: sub.trackId
      }));
    }
    
    // For results phase, include detailed submissions with votes
    if (currentRound.phase === 'results') {
      roundResults = {
        submissions: currentRound.submissions.map(sub => ({
          playerId: sub.playerId,
          trackId: sub.trackId,
          votes: sub.votes
        }))
      };
    }
  }

  // Return client-friendly state object
  return {
    roomCode: gameRoom.roomCode,
    status: gameRoom.status,
    players: gameRoom.players.map(p => ({
      spotifyId: p.spotifyId,
      username: p.username,
      isHost: p.isHost,
      isReady: p.isReady,
      selectedSongs: p.selectedSongs || [],
      points: p.points
    })),
    currentRound: gameRoom.currentRound,
    totalRounds: gameRoom.totalRounds,
    currentPhase,
    category,
    timeLeft,
    submissions,
    roundResults,
    leaderboard,
    isLastRound: gameRoom.currentRound >= gameRoom.totalRounds
  };
};

/**
 * Generate a unique room code
 * @returns {string} 6-character room code
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Create a new game room
 * @param {string} hostSpotifyId - Host's Spotify ID
 * @param {string} hostUsername - Host's username
 * @param {number} roundCount - Number of rounds (default: 5)
 * @returns {Promise<Object>} Created game room document
 */
const createGameRoom = async (hostSpotifyId, hostUsername, roundCount = 5) => {
  const GameRoom = mongoose.model('GameRoom');
  
  // Generate a unique room code
  let roomCode;
  let isUnique = false;
  
  while (!isUnique) {
    roomCode = generateRoomCode();
    // Check if code already exists
    const existingRoom = await GameRoom.findOne({ roomCode });
    if (!existingRoom) {
      isUnique = true;
    }
  }
  
  // Shuffle categories and select the required number
  const shuffledCategories = [...GAME_CATEGORIES]
    .sort(() => 0.5 - Math.random())
    .slice(0, roundCount);
  
  // Create the new game room
  const gameRoom = new GameRoom({
    roomCode,
    status: 'waiting',
    players: [{
      spotifyId: hostSpotifyId,
      username: hostUsername,
      isHost: true,
      isReady: false,
      points: 0
    }],
    categories: shuffledCategories,
    currentRound: 0,
    totalRounds: roundCount,
    rounds: []
  });
  
  await gameRoom.save();
  return gameRoom;
};

/**
 * Calculate round results and award points
 * @param {string} roomCode - Room code
 * @returns {Promise<Object>} Updated game state
 */
const calculateRoundResults = async (roomCode) => {
  try {
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      return null;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      return null;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    
    // Sort submissions by vote count
    const sortedSubmissions = [...currentRound.submissions].sort(
      (a, b) => b.votes.length - a.votes.length
    );
    
    // Award points
    sortedSubmissions.forEach((submission, index) => {
      // Find player
      const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === submission.playerId);
      
      if (playerIndex !== -1) {
        // Award points based on position
        if (index === 0) {
          // Winner gets 3 points
          gameRoom.players[playerIndex].points += 3;
        } else if (index === 1 && submission.votes.length > 0) {
          // Runner-up gets 2 points (only if they got votes)
          gameRoom.players[playerIndex].points += 2;
        } else if (submission.votes.length > 0) {
          // Others with votes get 1 point
          gameRoom.players[playerIndex].points += 1;
        }
      }
    });
    
    await gameRoom.save();
    
    return gameStateForClient(gameRoom);
  } catch (error) {
    console.error('Error calculating round results:', error);
    throw error;
  }
};

/**
 * Set player as ready with selected songs
 * @param {string} roomCode - Room code
 * @param {string} spotifyId - Player's Spotify ID
 * @param {Array} selectedSongs - Player's selected songs
 * @returns {Promise<Object>} Updated game state
 */

const setPlayerReady = async (roomCode, spotifyId, selectedSongs) => {
  try {
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom) {
      throw new Error('Game room not found');
    }
    
    // Find player index
    const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found in game room');
    }
    
    // Clear previous selected songs to avoid carrying over old selections
    if (gameRoom.players[playerIndex].selectedSongs) {
      gameRoom.players[playerIndex].selectedSongs = [];
    }
    
    // Update player's ready status and selected songs
    gameRoom.players[playerIndex].isReady = true;
    gameRoom.players[playerIndex].selectedSongs = selectedSongs;
    
    await gameRoom.save();
    
    // Check if all players are ready
    const allReady = gameRoom.players.every(p => p.isReady);
    
    return {
      gameState: gameStateForClient(gameRoom),
      allReady
    };
  } catch (error) {
    console.error('Error setting player ready:', error);
    throw error;
  }
};

/**
 * Submit a song for the current round
 * @param {string} roomCode - Room code
 * @param {string} spotifyId - Player's Spotify ID
 * @param {string} trackId - Selected track ID
 * @returns {Promise<boolean>} Success indicator
 */
const submitSong = async (roomCode, spotifyId, trackId) => {
  try {
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      return false;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      return false;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    if (currentRound.phase !== 'submission') {
      return false;
    }
    
    // Check if player already submitted a song
    const existingSubmission = currentRound.submissions.findIndex(
      sub => sub.playerId === spotifyId
    );
    
    if (existingSubmission !== -1) {
      // Update existing submission
      currentRound.submissions[existingSubmission].trackId = trackId;
    } else {
      // Add new submission
      currentRound.submissions.push({
        playerId: spotifyId,
        trackId: trackId,
        votes: []
      });
    }
    
    // Find the player's song details
    const player = gameRoom.players.find(p => p.spotifyId === spotifyId);
    if (player) {
      // Remove the selected song from the player's available songs to prevent reuse in future rounds
      player.selectedSongs = player.selectedSongs.filter(song => song.trackId !== trackId);
    }
    
    await gameRoom.save();
    return true;
  } catch (error) {
    console.error('Error submitting song:', error);
    return false;
  }
};

module.exports = {
  gameStateForClient,
  generateRoomCode,
  createGameRoom,
  calculateRoundResults,
  setPlayerReady
};
