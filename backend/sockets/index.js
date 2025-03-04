// Fixes for the socket handlers (to be added to your socket index.js file)

// Import necessary modules and functions
const { gameStateForClient } = require('../game/stateManager');
const { startGameCountdown, transitionToNextPhase } = require('../game/phaseTransitions');

module.exports = (server) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Initialize the game phase transition module
  require('../game/phaseTransitions').init(io);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a game room
    socket.on('joinRoom', async ({ roomCode, spotifyId, username }) => {
      try {
        // Join the socket room
        socket.join(roomCode);
        
        // Find or create player in the room
        const GameRoom = mongoose.model('GameRoom');
        const gameRoom = await GameRoom.findOne({ roomCode });
        
        if (!gameRoom) {
          socket.emit('gameError', { message: 'Game room not found' });
          return;
        }
        
        // Find if player is already in the room
        const existingPlayerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
        
        if (existingPlayerIndex === -1) {
          // Add player to the room
          gameRoom.players.push({
            spotifyId,
            username,
            isHost: false,
            isReady: false,
            points: 0,
            selectedSongs: [] // Initialize empty songs array
          });
        } else {
          // Update player data
          gameRoom.players[existingPlayerIndex].username = username;
        }
        
        await gameRoom.save();
        
        // Notify all players in the room
        io.to(roomCode).emit('playerJoined', {
          gameState: gameStateForClient(gameRoom)
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('gameError', { message: 'Failed to join game room' });
      }
    });
    
    // Submit a song for the current round
    socket.on('submitSong', async ({ roomCode, spotifyId, trackId }) => {
      try {
        // Submit the song
        const success = await require('../game/stateManager').submitSong(roomCode, spotifyId, trackId);
        
        // Send result to the player
        socket.emit('songSubmitted', { success });
        
        // If successful, update game state for all players
        if (success) {
          const GameRoom = mongoose.model('GameRoom');
          const gameRoom = await GameRoom.findOne({ roomCode });
          
          if (gameRoom) {
            io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
            
            // Check if all players have submitted their songs
            const currentRoundIndex = gameRoom.currentRound - 1;
            if (currentRoundIndex >= 0 && currentRoundIndex < gameRoom.rounds.length) {
              const currentRound = gameRoom.rounds[currentRoundIndex];
              const allSubmitted = gameRoom.players.every(player => {
                return currentRound.submissions.some(sub => sub.playerId === player.spotifyId);
              });
              
              // If all players have submitted, transition to next phase early
              if (allSubmitted) {
                console.log('All players submitted songs, transitioning to next phase');
                transitionToNextPhase(roomCode);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error submitting song:', error);
        socket.emit('gameError', { message: 'Failed to submit song' });
      }
    });
  });
  
  return io;
};