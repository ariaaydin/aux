// game/botPlayers.js - Bot player logic

const mongoose = require('mongoose');
const { BOT_NAMES, SAMPLE_SONGS } = require('./constants');
const { gameStateForClient } = require('./stateManager');
const { startGameCountdown } = require('./phaseTransitions');

let io; // Will be set when module is initialized

/**
 * Initialize the module with socket.io instance
 * @param {Object} socketIo - Socket.io instance
 */
const init = (socketIo) => {
  io = socketIo;
};

/**
 * Create bot players for a game room
 * @param {string} roomCode - Room code
 * @param {number} botCount - Number of bots to create
 * @param {string} userSpotifyId - User Spotify ID to set ready after bots join
 * @returns {Promise<void>}
 */
const createBotPlayers = async (roomCode, botCount, userSpotifyId) => {
  try {
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    if (!gameRoom) return;
    
    // Create bot players
    for (let i = 0; i < botCount && i < BOT_NAMES.length; i++) {
      // Generate a fake Spotify ID
      const botSpotifyId = `bot-${i}-${Date.now()}`;
      
      // Create a selection of random songs for this bot
      const botSongs = [];
      // Create a set to ensure we don't get duplicate songs
      const trackIdSet = new Set();
      
      while (botSongs.length < 5) { // Each bot needs 5 songs
        const randomIndex = Math.floor(Math.random() * SAMPLE_SONGS.length);
        const randomSong = SAMPLE_SONGS[randomIndex];
        
        // Only add the song if we haven't added it already
        if (!trackIdSet.has(randomSong.trackId)) {
          trackIdSet.add(randomSong.trackId);
          botSongs.push({ ...randomSong });
        }
      }
      
      // Add bot player to game room
      gameRoom.players.push({
        spotifyId: botSpotifyId,
        username: BOT_NAMES[i],
        isHost: false,
        isReady: true, // Bots are always ready
        selectedSongs: botSongs
      });
    }
    
    await gameRoom.save();
    
    // Notify all clients about new players
    io.to(roomCode).emit('playerJoined', { 
      gameState: gameStateForClient(gameRoom)
    });
    
    // Simulate starting the game after a short delay
    setTimeout(async () => {
      if (gameRoom.status === 'waiting') {
        // Fake a "setReady" call for the real player
        const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === userSpotifyId);
        if (playerIndex !== -1) {
          gameRoom.players[playerIndex].isReady = true;
          await gameRoom.save();
          
          // Start the game countdown
          startGameCountdown(roomCode);
        }
      }
    }, 1500); // Short delay to simulate real player also hitting ready
  } catch (error) {
    console.error('Error creating bot players:', error);
  }
};

/**
 * Handle bot song submissions
 * @param {string} roomCode - Room code
 * @returns {Promise<void>}
 */
const handleBotSubmissions = async (roomCode) => {
  try {
    console.log(`Starting bot submissions for room ${roomCode}`);
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log('Game not in playing state for bot submissions');
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index for bot submissions: ${currentRoundIndex}`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    if (currentRound.phase !== 'submission') {
      console.log(`Not in submission phase for bot submissions, current phase: ${currentRound.phase}`);
      return;
    }
    
    // Get bot players
    const botPlayers = gameRoom.players.filter(p => p.spotifyId.startsWith('bot-'));
    console.log(`Bot players found: ${botPlayers.length}`);
    
    // Make bots submit songs with a slight delay between them
    let botsSubmitted = 0;
    
    for (const bot of botPlayers) {
      // Add some randomized delay for more realistic behavior
      const delay = 500 + Math.floor(Math.random() * 2000); // 0.5-2.5 second delay
      
      setTimeout(async () => {
        try {
          // Ensure bot has selected songs
          if (!bot.selectedSongs || bot.selectedSongs.length === 0) {
            console.log(`Bot ${bot.username} has no selected songs!`);
            return;
          }
          
          // Pick a random song from bot's selected songs
          const randomSongIndex = Math.floor(Math.random() * bot.selectedSongs.length);
          const randomSong = bot.selectedSongs[randomSongIndex];
          
          console.log(`Bot ${bot.username} selecting song: ${randomSong.trackName}`);
          
          // Check if bot already submitted
          const existingSubmissionIndex = currentRound.submissions.findIndex(s => s.playerId === bot.spotifyId);
          
          if (existingSubmissionIndex !== -1) {
            // Update existing submission
            currentRound.submissions[existingSubmissionIndex].trackId = randomSong.trackId;
            console.log(`Updated existing submission for bot ${bot.username}`);
          } else {
            // Add new submission
            currentRound.submissions.push({
              playerId: bot.spotifyId,
              trackId: randomSong.trackId,
              votes: []
            });
            console.log(`Added new submission for bot ${bot.username}`);
          }
          
          await gameRoom.save();
          
          // Notify all players of submission count
          io.to(roomCode).emit('submissionUpdate', { 
            submissionCount: currentRound.submissions.length,
            totalPlayers: gameRoom.players.length
          });
          
          botsSubmitted++;
          console.log(`Submissions: ${currentRound.submissions.length}/${gameRoom.players.length} (Bots submitted: ${botsSubmitted})`);
        } catch (error) {
          console.error(`Error during bot ${bot.username} submission:`, error);
        }
      }, delay);
    }
  } catch (error) {
    console.error('Error with bot submissions:', error);
  }
};

/**
 * Handle bot votes
 * @param {string} roomCode - Room code
 * @returns {Promise<void>}
 */
const handleBotVotes = async (roomCode) => {
  try {
    console.log(`Starting bot voting process for room ${roomCode}`);
    const GameRoom = mongoose.model('GameRoom');
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log('Game not in playing state for bot voting');
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log('Invalid round index for bot voting:', currentRoundIndex);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    if (currentRound.phase !== 'voting') {
      console.log('Not in voting phase for bot voting, current phase:', currentRound.phase);
      return;
    }
    
    // Get bot players
    const botPlayers = gameRoom.players.filter(p => p.spotifyId.startsWith('bot-'));
    console.log(`Found ${botPlayers.length} bot players to vote`);
    
    // Check if there are submissions to vote for
    if (currentRound.submissions.length === 0) {
      console.log('No submissions to vote for');
      return;
    }
    
    // Track if any votes were cast
    let votesCast = 0;
    
    // Make bots vote with varying delays
    for (const bot of botPlayers) {
      // Add some randomized delay for more realistic behavior
      const delay = 1000 + Math.floor(Math.random() * 4000); // 1-5 second delay
      
      setTimeout(async () => {
        try {
          // Bots can't vote for themselves
          const validSubmissions = currentRound.submissions.filter(s => s.playerId !== bot.spotifyId);
          
          console.log(`Bot ${bot.username} has ${validSubmissions.length} valid submissions to vote for`);
          
          if (validSubmissions.length > 0) {
            // Pick a random submission to vote for
            const randomSubmissionIndex = Math.floor(Math.random() * validSubmissions.length);
            const randomSubmission = validSubmissions[randomSubmissionIndex];
            
            // Add bot's vote
            const submissionIndex = currentRound.submissions.findIndex(s => s.playerId === randomSubmission.playerId);
            if (submissionIndex !== -1) {
              // Make sure bot hasn't already voted
              if (!currentRound.submissions[submissionIndex].votes.includes(bot.spotifyId)) {
                currentRound.submissions[submissionIndex].votes.push(bot.spotifyId);
                votesCast++;
                console.log(`Bot ${bot.username} voted for player ${randomSubmission.playerId}`);
                
                await gameRoom.save();
                
                // Notify all players of vote count
                const totalVotes = currentRound.submissions.reduce((count, s) => count + s.votes.length, 0);
                const validVoters = gameRoom.players.length - currentRound.submissions.length;
                
                io.to(roomCode).emit('voteUpdate', { 
                  voteCount: totalVotes,
                  totalPlayers: validVoters
                });
                
                // Check if all players have voted
                if (totalVotes >= validVoters) {
                  console.log('All votes received, transitioning to results phase');
                  const { transitionToNextPhase } = require('./phaseTransitions');
                  transitionToNextPhase(roomCode);
                }
              } else {
                console.log(`Bot ${bot.username} already voted for player ${randomSubmission.playerId}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error during bot ${bot.username} voting:`, error);
        }
      }, delay);
    }
  } catch (error) {
    console.error('Error with bot voting:', error);
  }
};

module.exports = {
  init,
  createBotPlayers,
  handleBotSubmissions,
  handleBotVotes
};