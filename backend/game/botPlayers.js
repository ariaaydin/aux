/**
 * Create bot players for test mode without automatically starting the game
 * @param {string} roomCode - Room code
 * @param {number} botCount - Number of bots to create
 * @param {string} userSpotifyId - Real user's Spotify ID
 * @returns {Promise<void>}
 */
const createBotPlayers = async (roomCode, botCount, userSpotifyId) => {
  try {
    console.log(`Creating ${botCount} bot players for room ${roomCode}`);
    
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom) {
      console.log(`Room ${roomCode} not found`);
      return;
    }
    
    // Limit bot count to available names
    const botNames = [
      'DJ Bot', 'RhythmMaster', 'BeatBot', 'MelodyAI', 'TuneBot', 'SonicBot', 'GrooveBot',
      'AudioBot', 'VinylBot', 'RockBot'
    ];
    
    const actualBotCount = Math.min(botCount, botNames.length);
    
    // Check how many rounds we need songs for
    const totalRounds = gameRoom.totalRounds || 5;
    const songsPerBot = totalRounds + 1; // One extra song as buffer
    
    // Sample songs for bots to use
    const sampleSongs = [
      {
        trackId: '4cOdK2wGLETKBW3PvgPWqT',
        trackName: 'Bohemian Rhapsody',
        trackArtist: 'Queen',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b273c9f744b5fe8014d3055f8b84'
      },
      {
        trackId: '1BxfuPKGuaTgP7aM0Bbdwr',
        trackName: 'Smells Like Teen Spirit',
        trackArtist: 'Nirvana',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b273e175a19e530c898d167d39bf'
      },
      {
        trackId: '5CQ30WqJwcep0pYcV4AMNc',
        trackName: 'Stairway to Heaven',
        trackArtist: 'Led Zeppelin',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b27351c02a77d09dfcd53c8676d0'
      },
      {
        trackId: '1lCRw5FEZ1gPDNPzy1K4zW',
        trackName: 'Sweet Child O\' Mine',
        trackArtist: 'Guns N\' Roses',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b2736f0643d07329a71d40290983'
      },
      {
        trackId: '7tFiyTwD0nx5a1eklYtX2J',
        trackName: 'Don\'t Stop Believin\'',
        trackArtist: 'Journey',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b2736c40899b6c6e566129e5e989'
      },
      {
        trackId: '3z8h0TU7ReDPLIbEnYhWZb',
        trackName: 'Billie Jean',
        trackArtist: 'Michael Jackson',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b273de437d960dda1ac0a3586d97'
      },
      {
        trackId: '5HNCy40Ni5BZJFw1TKzRsC',
        trackName: 'Hotel California',
        trackArtist: 'Eagles',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b2735656d4cddee2233abc300a6e'
      },
      {
        trackId: '4u7EnebtmKWzUH433cf5Qv',
        trackName: 'Imagine',
        trackArtist: 'John Lennon',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b27345b1fe93dba79143e8cc22ee'
      },
      {
        trackId: '3EYOJ48Et32uATr9ZmLnAo',
        trackName: 'Thriller',
        trackArtist: 'Michael Jackson',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b2736e3fa5995ff0a3c32b33bae4'
      },
      {
        trackId: '0pqnGHJpmpxLKifKRmU6WP',
        trackName: 'Superstition',
        trackArtist: 'Stevie Wonder',
        trackImage: 'https://i.scdn.co/image/ab67616d0000b273e63e0756e77a1a5eb3b5820c'
      }
    ];
    
    // Make the track IDs unique for bots by adding identifiers
    const uniqueSampleSongs = sampleSongs.map((song, index) => ({
      ...song,
      trackId: `${song.trackId}-sample-${index}`
    }));
    
    // Create bot players
    for (let i = 0; i < actualBotCount; i++) {
      // Generate a unique bot ID
      const botSpotifyId = `bot-${i}-${Date.now()}`;
      const botName = botNames[i];
      
      // Create songs for this bot by shuffling and selecting some
      const shuffledSongs = [...uniqueSampleSongs].sort(() => Math.random() - 0.5);
      const botSongs = [];
      
      // Make sure each bot has songsPerBot unique songs with unique IDs
      for (let j = 0; j < songsPerBot; j++) {
        const songIndex = j % shuffledSongs.length;
        const baseSong = shuffledSongs[songIndex];
        
        // Create a copy with a unique ID for this bot and song
        const botSong = {
          ...baseSong,
          trackId: `${baseSong.trackId}-bot${i}-${j}`
        };
        
        botSongs.push(botSong);
      }
      
      // Add bot to game room
      gameRoom.players.push({
        spotifyId: botSpotifyId,
        username: botName,
        isHost: false,
        isReady: true, // Bots are always ready
        points: 0,
        selectedSongs: botSongs
      });
      
      console.log(`Added bot ${botName} (${botSpotifyId}) with ${botSongs.length} songs`);
    }
    
    await gameRoom.save();
    console.log(`Added ${actualBotCount} bots to room ${roomCode}`);
    
    // NO AUTOMATIC GAME START
  } catch (error) {
    console.error(`Error creating bot players for room ${roomCode}:`, error);
  }
};