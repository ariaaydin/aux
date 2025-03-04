// sockets/gameHandlers.js - Game event handlers

const mongoose = require('mongoose');
const { gameStateForClient } = require('../game/stateManager');
const { transitionToNextPhase } = require('../game/phaseTransitions');
const { PHASE_DURATIONS } = require('../game/constants');

let io;
let socketToRoom;

/**
 * Initialize the module
 * @param {Object} socketIo - Socket.io instance
 * @param {Object} socketRoomMap - Socket to room mapping
 */
const init = (socketIo, socketRoomMap) => {
  io = socketIo;
  socketToRoom = socketRoomMap;
};

/**
 * Register game event handlers for a socket
 * @param {Object} socket - Socket.io socket
 */
const registerHandlers = (socket) => {
  // Join an existing game room
  socket.on('joinRoom', async ({ roomCode, spotifyId, username }) => {
    try {
      const GameRoom = mongoose.model('GameRoom');
      const gameRoom = await GameRoom.findOne({ roomCode });
      
      if (!gameRoom) {
        return socket.emit('gameError', { message: 'Room not found' });
      }
      
      if (gameRoom.status !== 'waiting') {
        return socket.emit('gameError', { message: 'Game already in progress' });
      }
      
      // Check if player is already in the room
      const existingPlayerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
      
      if (existingPlayerIndex === -1) {
        // Add player to the room
        gameRoom.players.push({
          spotifyId,
          username,
          isHost: false,
          isReady: false
        });
        await gameRoom.save();
      }
      
      // Join the socket room
      socket.join(roomCode);
      socketToRoom[socket.id] = roomCode;
      
      // Notify everyone in the room
      io.to(roomCode).emit('playerJoined', { 
        gameState: gameRoom 
      });
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('gameError', { message: 'Failed to join game room' });
    }
  });
  
  // Set player ready status with selected songs
  socket.on('setReady', async ({ roomCode, spotifyId, selectedSongs }) => {
    try {
      const GameRoom = mongoose.model('GameRoom');
      const gameRoom = await GameRoom.findOne({ roomCode });
      if (!gameRoom) {
        return socket.emit('gameError', { message: 'Room not found' });
      }
  
      const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
      if (playerIndex !== -1) {
        gameRoom.players[playerIndex].isReady = true;
        gameRoom.players[playerIndex].selectedSongs = selectedSongs || []; // Ensure songs are saved
        console.log(`Player ${spotifyId} set ready with songs:`, selectedSongs); // Debug log
        await gameRoom.save();
  
        io.to(roomCode).emit('playerReady', { spotifyId, gameState: gameRoom });
  
        const allReady = gameRoom.players.every(p => p.isReady);
        if (allReady && gameRoom.players.length >= 2) {
          gameRoom.status = 'playing';
          gameRoom.currentRound = 1;
          gameRoom.rounds.push({
            number: 1,
            category: gameRoom.categories[0],
            phase: 'category',
            phaseEndTime: new Date(Date.now() + (PHASE_DURATIONS.category * 1000)),
            submissions: []
          });
          await gameRoom.save();
          console.log('Game starting with state:', gameStateForClient(gameRoom)); // Debug log
          io.to(roomCode).emit('gameStarted', { gameState: gameStateForClient(gameRoom) });
          setTimeout(() => transitionToNextPhase(roomCode), PHASE_DURATIONS.category * 1000);
        }
      }
    } catch (error) {
      console.error('Error setting player ready:', error);
      socket.emit('gameError', { message: 'Failed to update ready status' });
    }
  });
  
  // Join an active game (reconnect)
  socket.on('joinGame', async ({ roomCode, spotifyId }) => {
    try {
      const GameRoom = mongoose.model('GameRoom');
      const gameRoom = await GameRoom.findOne({ roomCode });
      
      if (!gameRoom) {
        return socket.emit('gameError', { message: 'Room not found' });
      }
      
      // Check if player is in the game
      const playerExists = gameRoom.players.some(p => p.spotifyId === spotifyId);
      
      if (!playerExists) {
        return socket.emit('gameError', { message: 'You are not part of this game' });
      }
      
      // Join the socket room
      socket.join(roomCode);
      socketToRoom[socket.id] = roomCode;
      
      // Send current game state
      socket.emit('gameState', gameStateForClient(gameRoom));
      
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('gameError', { message: 'Failed to join game' });
    }
  });
  
  // Submit a song for the current round
  socket.on('submitSong', async ({ roomCode, spotifyId, trackId }) => {
    try {
      const GameRoom = mongoose.model('GameRoom');
      const gameRoom = await GameRoom.findOne({ roomCode });
      
      if (!gameRoom || gameRoom.status !== 'playing') {
        return socket.emit('gameError', { message: 'Game not in progress' });
      }
      
      const currentRoundIndex = gameRoom.currentRound - 1;
      
      if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
        return socket.emit('gameError', { message: 'Invalid round' });
      }
      
      const currentRound = gameRoom.rounds[currentRoundIndex];
      
      if (currentRound.phase !== 'submission') {
        return socket.emit('gameError', { message: 'Not in submission phase' });
      }
      
      // Check if player already submitted
      const existingSubmissionIndex = currentRound.submissions.findIndex(s => s.playerId === spotifyId);
      
      if (existingSubmissionIndex !== -1) {
        // Update existing submission
        currentRound.submissions[existingSubmissionIndex].trackId = trackId;
      } else {
        // Add new submission
        currentRound.submissions.push({
          playerId: spotifyId,
          trackId,
          votes: []
        });
      }
      
      await gameRoom.save();
      
      // Notify the player their submission was received
      socket.emit('songSubmitted', { success: true });
      
      // Notify all players of submission count (not which songs)
      io.to(roomCode).emit('submissionUpdate', { 
        submissionCount: currentRound.submissions.length,
        totalPlayers: gameRoom.players.length
      });
      
      // Check if all players have submitted
      if (currentRound.submissions.length === gameRoom.players.length) {
        // Skip to playback phase immediately
        transitionToNextPhase(roomCode);
      }
    } catch (error) {
      console.error('Error submitting song:', error);
      socket.emit('gameError', { message: 'Failed to submit song' });
    }
  });
  
  // Submit a vote
  socket.on('submitVote', async ({ roomCode, spotifyId, voteForPlayerId }) => {
    try {
      const GameRoom = mongoose.model('GameRoom');
      const gameRoom = await GameRoom.findOne({ roomCode });
      
      if (!gameRoom || gameRoom.status !== 'playing') {
        return socket.emit('gameError', { message: 'Game not in progress' });
      }
      
      const currentRoundIndex = gameRoom.currentRound - 1;
      
      if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
        return socket.emit('gameError', { message: 'Invalid round' });
      }
      
      const currentRound = gameRoom.rounds[currentRoundIndex];
      
      if (currentRound.phase !== 'voting') {
        return socket.emit('gameError', { message: 'Not in voting phase' });
      }
      
      // Cannot vote for your own submission
      if (voteForPlayerId === spotifyId) {
        return socket.emit('gameError', { message: 'You cannot vote for your own submission' });
      }
      
      // Find the submission being voted for
      const submissionIndex = currentRound.submissions.findIndex(s => s.playerId === voteForPlayerId);
      
      if (submissionIndex === -1) {
        return socket.emit('gameError', { message: 'Submission not found' });
      }
      
      // Check if player already voted
      const playerVoted = currentRound.submissions.some(s => s.votes.includes(spotifyId));
      
      if (playerVoted) {
        // Remove previous vote
        currentRound.submissions.forEach(s => {
          s.votes = s.votes.filter(v => v !== spotifyId);
        });
      }
      
      // Add vote
      currentRound.submissions[submissionIndex].votes.push(spotifyId);
      
      await gameRoom.save();
      
      // Notify the player their vote was received
      socket.emit('voteSubmitted', { success: true });
      
      // Notify all players of vote count (not which songs)
      io.to(roomCode).emit('voteUpdate', { 
        voteCount: currentRound.submissions.reduce((count, s) => count + s.votes.length, 0),
        totalPlayers: gameRoom.players.length - currentRound.submissions.length // Don't count players voting for themselves
      });
      
      // Check if all players have voted
      const totalVotes = currentRound.submissions.reduce((count, s) => count + s.votes.length, 0);
      if (totalVotes >= gameRoom.players.length - currentRound.submissions.length) {
        // Skip to results phase immediately
        transitionToNextPhase(roomCode);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      socket.emit('gameError', { message: 'Failed to submit vote' });
    }
  });
};

module.exports = {
  init,
  registerHandlers
};