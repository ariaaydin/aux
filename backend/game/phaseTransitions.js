// game/phaseTransitions.js

const mongoose = require('mongoose');
const GameRoom = mongoose.model('GameRoom');

// Socket.io instance
let io;

// Active timers by room code
const activeTimers = {};

// Phase durations in seconds
const PHASE_DURATIONS = {
  category: 10,
  submission: 30,
  playback: 30, // Per song
  voting: 20,
  results: 15
};

/**
 * Initialize the module with socket.io instance
 * @param {Object} socketIo - Socket.io instance
 */
const init = (socketIo) => {
  io = socketIo;
};

/**
 * Get client-safe game state
 * @param {Object} gameRoom - Game room document
 * @returns {Object} Client-safe game state
 */
const gameStateForClient = (gameRoom) => {
  // Calculate leaderboard
  const leaderboard = gameRoom.players.map(player => ({
    spotifyId: player.spotifyId,
    username: player.username,
    points: player.points || 0
  })).sort((a, b) => b.points - a.points);

  // Get current round data
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
    
    // Calculate time left
    if (currentRound.phaseEndTime) {
      timeLeft = Math.max(0, Math.floor((new Date(currentRound.phaseEndTime) - new Date()) / 1000));
    }
    
    // Include submissions for playback and voting phases
    if (currentRound.phase === 'playback' || currentRound.phase === 'voting') {
      submissions = currentRound.submissions.map(sub => ({
        playerId: sub.playerId,
        trackId: sub.trackId
      }));
    }
    
    // Include results for results phase
    if (currentRound.phase === 'results') {
      roundResults = {
        submissions: currentRound.submissions.map(sub => ({
          playerId: sub.playerId,
          trackId: sub.trackId,
          votes: sub.votes || []
        }))
      };
    }
  }

  // Construct client state
  return {
    roomCode: gameRoom.roomCode,
    status: gameRoom.status,
    players: gameRoom.players.map(p => ({
      spotifyId: p.spotifyId,
      username: p.username,
      isHost: p.isHost || false,
      isReady: p.isReady || false,
      points: p.points || 0,
      selectedSongs: p.selectedSongs || []
    })),
    currentRound: gameRoom.currentRound,
    totalRounds: gameRoom.totalRounds || 5,
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
 * Start playback sequence for a room
 * @param {string} roomCode - Room code
 * @param {Array} submissions - Song submissions
 */
const startPlaybackSequence = (roomCode, submissions) => {
  console.log(`Starting playback sequence for room ${roomCode} with ${submissions.length} submissions`);
  
  // Start with first track
  let currentIndex = 0;
  io.to(roomCode).emit('playbackUpdate', { index: currentIndex });
  
  // Create interval to cycle through tracks
  const interval = setInterval(async () => {
    currentIndex++;
    
    // Check if we've played all tracks
    if (currentIndex >= submissions.length) {
      clearInterval(interval);
      
      // Move to voting phase
      console.log(`Playback complete for room ${roomCode}, moving to voting phase`);
      transitionToNextPhase(roomCode);
      return;
    }
    
    // Emit current track index
    console.log(`Playing track ${currentIndex + 1}/${submissions.length} for room ${roomCode}`);
    io.to(roomCode).emit('playbackUpdate', { index: currentIndex });
  }, PHASE_DURATIONS.playback * 1000);
  
  // Save interval reference
  activeTimers[`${roomCode}-playback`] = interval;
};

/**
 * Calculate round results and update scores
 * @param {string} roomCode - Room code
 */
const calculateRoundResults = async (roomCode) => {
  try {
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log(`Game ${roomCode} not in playing state`);
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index ${currentRoundIndex} for game ${roomCode}`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    
    // Sort submissions by vote count
    const sortedSubmissions = [...currentRound.submissions].sort(
      (a, b) => (b.votes ? b.votes.length : 0) - (a.votes ? a.votes.length : 0)
    );
    
    console.log(`Calculating results for round ${gameRoom.currentRound}/${gameRoom.totalRounds}`);
    console.log(`Sorted submissions:`, sortedSubmissions.map(s => 
      `${s.playerId}: ${s.votes ? s.votes.length : 0} votes`
    ));
    
    // Award points
    sortedSubmissions.forEach((submission, index) => {
      const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === submission.playerId);
      
      if (playerIndex === -1) {
        console.log(`Player ${submission.playerId} not found in game ${roomCode}`);
        return;
      }
      
      // Initialize points if not set
      if (typeof gameRoom.players[playerIndex].points !== 'number') {
        gameRoom.players[playerIndex].points = 0;
      }
      
      // Award points based on position
      if (index === 0 && submission.votes && submission.votes.length > 0) {
        // Winner gets 3 points
        gameRoom.players[playerIndex].points += 3;
        console.log(`Awarded 3 points to ${gameRoom.players[playerIndex].username} (1st place)`);
      } else if (index === 1 && submission.votes && submission.votes.length > 0) {
        // Runner-up gets 2 points
        gameRoom.players[playerIndex].points += 2;
        console.log(`Awarded 2 points to ${gameRoom.players[playerIndex].username} (2nd place)`);
      } else if (submission.votes && submission.votes.length > 0) {
        // Others with votes get 1 point
        gameRoom.players[playerIndex].points += 1;
        console.log(`Awarded 1 point to ${gameRoom.players[playerIndex].username} (received votes)`);
      }
    });
    
    await gameRoom.save();
    console.log(`Saved updated points for game ${roomCode}`);
    
    // Emit updated game state
    io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
    
  } catch (error) {
    console.error(`Error calculating round results for room ${roomCode}:`, error);
  }
};

/**
 * Handle bot submissions for test mode
 * @param {string} roomCode - Room code
 */
const handleBotSubmissions = async (roomCode) => {
  try {
    console.log(`Handling bot submissions for room ${roomCode}`);
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log(`Game ${roomCode} not in playing state for bot submissions`);
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index ${currentRoundIndex} for bot submissions`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    
    if (currentRound.phase !== 'submission') {
      console.log(`Not in submission phase for bot submissions (${currentRound.phase})`);
      return;
    }
    
    // Get bot players
    const botPlayers = gameRoom.players.filter(p => p.spotifyId.startsWith('bot-'));
    console.log(`Found ${botPlayers.length} bot players`);
    
    let submissionsAdded = 0;
    
    // Make bots submit songs
    for (const bot of botPlayers) {
      // Skip if bot has already submitted
      const alreadySubmitted = currentRound.submissions.some(s => s.playerId === bot.spotifyId);
      if (alreadySubmitted) {
        console.log(`Bot ${bot.username} already submitted`);
        continue;
      }
      
      // Ensure bot has songs to submit
      if (!bot.selectedSongs || bot.selectedSongs.length === 0) {
        console.log(`Bot ${bot.username} has no songs to submit`);
        continue;
      }
      
      // Pick a random song from bot's selected songs
      const availableSongs = bot.selectedSongs.filter(
        song => !gameRoom.rounds.some(
          r => r.submissions.some(s => s.playerId === bot.spotifyId && s.trackId === song.trackId)
        )
      );
      
      if (availableSongs.length === 0) {
        console.log(`Bot ${bot.username} has no unused songs remaining`);
        continue;
      }
      
      const randomSongIndex = Math.floor(Math.random() * availableSongs.length);
      const randomSong = availableSongs[randomSongIndex];
      
      console.log(`Bot ${bot.username} submitting ${randomSong.trackName}`);
      
      // Add submission
      currentRound.submissions.push({
        playerId: bot.spotifyId,
        trackId: randomSong.trackId,
        votes: []
      });
      
      submissionsAdded++;
    }
    
    if (submissionsAdded > 0) {
      await gameRoom.save();
      console.log(`Saved ${submissionsAdded} bot submissions for room ${roomCode}`);
      
      // Notify all players of submission count
      io.to(roomCode).emit('submissionUpdate', { 
        submissionCount: currentRound.submissions.length,
        totalPlayers: gameRoom.players.length
      });
      
      // Check if all players have submitted
      if (currentRound.submissions.length >= gameRoom.players.length) {
        console.log(`All players submitted, advancing to playback phase`);
        
        // Clear any existing timers
        cancelPhaseTimer(roomCode);
        
        // Move to playback phase
        transitionToNextPhase(roomCode);
      }
    }
  } catch (error) {
    console.error(`Error handling bot submissions for room ${roomCode}:`, error);
  }
};

/**
 * Handle bot votes for test mode
 * @param {string} roomCode - Room code
 */
const handleBotVotes = async (roomCode) => {
  try {
    console.log(`Handling bot votes for room ${roomCode}`);
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log(`Game ${roomCode} not in playing state for bot votes`);
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index ${currentRoundIndex} for bot votes`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    
    if (currentRound.phase !== 'voting') {
      console.log(`Not in voting phase for bot votes (${currentRound.phase})`);
      return;
    }
    
    // Get bot players
    const botPlayers = gameRoom.players.filter(p => p.spotifyId.startsWith('bot-'));
    console.log(`Found ${botPlayers.length} bot players for voting`);
    
    let votesAdded = 0;
    
    // Make bots vote
    for (const bot of botPlayers) {
      // Check if bot already voted
      const alreadyVoted = currentRound.submissions.some(s => s.votes && s.votes.includes(bot.spotifyId));
      
      if (alreadyVoted) {
        console.log(`Bot ${bot.username} already voted`);
        continue;
      }
      
      // Find submissions the bot can vote for (not their own)
      const validSubmissions = currentRound.submissions.filter(s => s.playerId !== bot.spotifyId);
      
      if (validSubmissions.length === 0) {
        console.log(`No valid submissions for bot ${bot.username} to vote for`);
        continue;
      }
      
      // Pick a random submission to vote for
      const randomSubmissionIndex = Math.floor(Math.random() * validSubmissions.length);
      const chosenSubmission = validSubmissions[randomSubmissionIndex];
      
      // Find the submission in the current round
      const submissionIndex = currentRound.submissions.findIndex(s => 
        s.playerId === chosenSubmission.playerId && s.trackId === chosenSubmission.trackId
      );
      
      if (submissionIndex === -1) {
        console.log(`Submission not found for bot ${bot.username} to vote`);
        continue;
      }
      
      // Initialize votes array if needed
      if (!currentRound.submissions[submissionIndex].votes) {
        currentRound.submissions[submissionIndex].votes = [];
      }
      
      // Add vote
      currentRound.submissions[submissionIndex].votes.push(bot.spotifyId);
      console.log(`Bot ${bot.username} voted for player ${chosenSubmission.playerId}`);
      
      votesAdded++;
    }
    
    if (votesAdded > 0) {
      await gameRoom.save();
      console.log(`Saved ${votesAdded} bot votes for room ${roomCode}`);
      
      // Count total votes
      const totalVotes = currentRound.submissions.reduce(
        (count, s) => count + (s.votes ? s.votes.length : 0), 
        0
      );
      
      // Notify all players of vote count
      io.to(roomCode).emit('voteUpdate', { 
        voteCount: totalVotes,
        totalPlayers: gameRoom.players.length - currentRound.submissions.length
      });
      
      // Check if all eligible players have voted
      const maxPossibleVotes = gameRoom.players.length - currentRound.submissions.length;
      
      if (totalVotes >= maxPossibleVotes) {
        console.log(`All players voted, advancing to results phase`);
        
        // Clear any existing timers
        cancelPhaseTimer(roomCode);
        
        // Move to results phase
        transitionToNextPhase(roomCode);
      }
    }
  } catch (error) {
    console.error(`Error handling bot votes for room ${roomCode}:`, error);
  }
};

/**
 * Cancel active phase timer for a room
 * @param {string} roomCode - Room code
 */
const cancelPhaseTimer = (roomCode) => {
  // Check for phase transition timer
  if (activeTimers[roomCode]) {
    clearTimeout(activeTimers[roomCode]);
    delete activeTimers[roomCode];
    console.log(`Cancelled phase timer for room ${roomCode}`);
  }
  
  // Check for playback interval
  if (activeTimers[`${roomCode}-playback`]) {
    clearInterval(activeTimers[`${roomCode}-playback`]);
    delete activeTimers[`${roomCode}-playback`];
    console.log(`Cancelled playback interval for room ${roomCode}`);
  }
};

/**
 * Manually progress to the next phase (for test mode)
 * @param {string} roomCode - Room code
 */
const manualProgressPhase = async (roomCode) => {
  try {
    console.log(`Manual phase progression requested for room ${roomCode}`);
    
    // Cancel any existing timers
    cancelPhaseTimer(roomCode);
    
    // Progress to next phase
    await transitionToNextPhase(roomCode);
    
  } catch (error) {
    console.error(`Error in manual phase progression for room ${roomCode}:`, error);
  }
};

/**
 * Transition to the next game phase
 * @param {string} roomCode - Room code
 * @returns {Promise<void>}
 */
const transitionToNextPhase = async (roomCode) => {
  try {
    console.log(`Transitioning to next phase for room ${roomCode}`);
    
    // Cancel any existing timers
    cancelPhaseTimer(roomCode);
    
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log(`Game ${roomCode} not in playing state`);
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index ${currentRoundIndex} for game ${roomCode}`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    let nextPhase;
    let phaseDuration;
    
    console.log(`Current phase: ${currentRound.phase}`);
    
    // Determine next phase and duration
    switch (currentRound.phase) {
      case 'category':
        nextPhase = 'submission';
        phaseDuration = PHASE_DURATIONS.submission;
        break;
        
      case 'submission':
        nextPhase = 'playback';
        
        // If no submissions, skip to voting
        if (!currentRound.submissions || currentRound.submissions.length === 0) {
          console.log(`No submissions in room ${roomCode}, skipping to voting`);
          nextPhase = 'voting';
          phaseDuration = PHASE_DURATIONS.voting;
        } else {
          // Start playback sequence (no need to set timeout as sequence handles transitions)
          console.log(`Starting playback sequence with ${currentRound.submissions.length} submissions`);
          currentRound.phase = nextPhase;
          currentRound.phaseEndTime = null; // Playback handles its own timing
          await gameRoom.save();
          
          // Send updated game state
          io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
          
          // Start playback sequence (which will handle the transition to voting)
          startPlaybackSequence(roomCode, currentRound.submissions);
          return;
        }
        break;
        
      case 'playback':
        nextPhase = 'voting';
        phaseDuration = PHASE_DURATIONS.voting;
        break;
        
      case 'voting':
        nextPhase = 'results';
        phaseDuration = PHASE_DURATIONS.results;
        
        // Calculate results before transitioning
        await calculateRoundResults(roomCode);
        break;
        
      case 'results':
        // Check if this was the last round
        if (gameRoom.currentRound >= gameRoom.totalRounds) {
          console.log(`Game ${roomCode} completed after ${gameRoom.totalRounds} rounds`);
          
          // End the game
          gameRoom.status = 'completed';
          await gameRoom.save();
          
          // Notify players
          io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
          return;
        }
        
        // Move to next round
        nextPhase = 'category';
        phaseDuration = PHASE_DURATIONS.category;
        
        // Increment round counter
        gameRoom.currentRound += 1;
        
        // Create new round
        gameRoom.rounds.push({
          number: gameRoom.currentRound,
          category: gameRoom.categories[gameRoom.currentRound - 1],
          phase: nextPhase,
          phaseEndTime: new Date(Date.now() + (phaseDuration * 1000)),
          submissions: []
        });
        
        await gameRoom.save();
        
        // Notify players
        io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
        
        // Schedule next phase transition
        activeTimers[roomCode] = setTimeout(() => {
          transitionToNextPhase(roomCode);
          delete activeTimers[roomCode];
        }, phaseDuration * 1000);
        
        return;
    }
    
    console.log(`Transitioning from ${currentRound.phase} to ${nextPhase} (duration: ${phaseDuration}s)`);
    
    // Update current round
    currentRound.phase = nextPhase;
    currentRound.phaseEndTime = new Date(Date.now() + (phaseDuration * 1000));
    
    await gameRoom.save();
    
    // Notify players
    io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
    
    // Handle bot actions for test mode
    if (nextPhase === 'submission') {
      setTimeout(() => handleBotSubmissions(roomCode), 2000);
    } else if (nextPhase === 'voting') {
      setTimeout(() => handleBotVotes(roomCode), 2000);
    }
    
    // Schedule next phase transition
    activeTimers[roomCode] = setTimeout(() => {
      transitionToNextPhase(roomCode);
      delete activeTimers[roomCode];
    }, phaseDuration * 1000);
    
  } catch (error) {
    console.error(`Error transitioning game phase for room ${roomCode}:`, error);
  }
};

module.exports = {
  init,
  gameStateForClient,
  transitionToNextPhase,
  manualProgressPhase,
  PHASE_DURATIONS
};