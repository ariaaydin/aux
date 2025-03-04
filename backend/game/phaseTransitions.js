// game/phaseTransitions.js - Phase transition logic

const mongoose = require('mongoose');
const { PHASE_DURATIONS } = require('./constants');
const { gameStateForClient, calculateRoundResults } = require('./stateManager');
const { handleBotSubmissions, handleBotVotes } = require('./botPlayers');

let io; // Will be set when module is initialized

/**
 * Initialize the module with socket.io instance
 * @param {Object} socketIo - Socket.io instance
 */
const init = (socketIo) => {
  io = socketIo;
};

/**
 * Start playback sequence for a room
 * @param {string} roomCode - Room code
 * @param {Array} submissions - Array of song submissions
 */
const startPlaybackSequence = (roomCode, submissions) => {
  console.log('Starting playback sequence for room:', roomCode, 'with submissions:', submissions);
  let currentIndex = 0;
  io.to(roomCode).emit('playbackUpdate', { index: currentIndex });

  const interval = setInterval(() => {
    currentIndex++;
    if (currentIndex >= submissions.length) {
      clearInterval(interval);
      console.log('Playback complete, transitioning to voting for room:', roomCode);
      transitionToNextPhase(roomCode);
      return;
    }
    console.log('Emitting playback update:', { index: currentIndex });
    io.to(roomCode).emit('playbackUpdate', { index: currentIndex });
  }, PHASE_DURATIONS.playback * 1000); // Per track playback duration
};

/**
 * Transition to the next game phase
 * @param {string} roomCode - Room code
 * @returns {Promise<void>}
 */
const transitionToNextPhase = async (roomCode) => {
  try {
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') return;

    const currentRoundIndex = gameRoom.currentRound - 1;
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) return;

    const currentRound = gameRoom.rounds[currentRoundIndex];
    let nextPhase;
    let phaseDuration;

    switch (currentRound.phase) {
      case 'category':
        nextPhase = 'submission';
        phaseDuration = PHASE_DURATIONS.submission;
        break;
      case 'submission':
        nextPhase = 'playback';
        phaseDuration = PHASE_DURATIONS.playback * currentRound.submissions.length;
        // Start playback sequence here
        if (currentRound.submissions.length > 0) {
          startPlaybackSequence(roomCode, currentRound.submissions);
        } else {
          console.log('No submissions to play, skipping to voting');
          nextPhase = 'voting';
          phaseDuration = PHASE_DURATIONS.voting;
        }
        break;
      case 'playback':
        nextPhase = 'voting';
        phaseDuration = PHASE_DURATIONS.voting;
        break;
      case 'voting':
        nextPhase = 'results';
        phaseDuration = PHASE_DURATIONS.results;
        await calculateRoundResults(roomCode);
        break;
      case 'results':
        if (gameRoom.currentRound >= gameRoom.totalRounds) {
          gameRoom.status = 'completed';
          await gameRoom.save();
          io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
          return;
        }
        nextPhase = 'category';
        phaseDuration = PHASE_DURATIONS.category;
        gameRoom.currentRound += 1;
        gameRoom.rounds.push({
          number: gameRoom.currentRound,
          category: gameRoom.categories[gameRoom.currentRound - 1],
          phase: 'category',
          phaseEndTime: new Date(Date.now() + (PHASE_DURATIONS.category * 1000)),
          submissions: []
        });
        await gameRoom.save();
        io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
        setTimeout(() => transitionToNextPhase(roomCode), PHASE_DURATIONS.category * 1000);
        return;
    }

    currentRound.phase = nextPhase;
    currentRound.phaseEndTime = new Date(Date.now() + (phaseDuration * 1000));
    await gameRoom.save();

    io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));

    if (nextPhase === 'submission') {
      setTimeout(() => handleBotSubmissions(roomCode), 2000); // Delayed bot submissions
    } else if (nextPhase === 'voting') {
      setTimeout(() => handleBotVotes(roomCode), 5000); // Delayed bot votes
    }

    // Only set timeout for non-playback phases, as playback is handled by startPlaybackSequence
    if (nextPhase !== 'playback') {
      setTimeout(() => transitionToNextPhase(roomCode), phaseDuration * 1000);
    }
  } catch (error) {
    console.error('Error transitioning game phase:', error);
  }
};

module.exports = {
  init,
  transitionToNextPhase,
  startPlaybackSequence
};