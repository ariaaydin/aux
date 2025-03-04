// game/constants.js - Game constants

// Game categories
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
    "Best song for karaoke",
    "Best breakup song",
    "Song you'd play at a party",
    "Song with the best lyrics",
    "Song with the best beat",
    "Best song to listen to when sad",
    "Song that represents you",
    "Most inspiring song",
    "Song that reminds you of summer"
  ];
  
  // Phase durations in seconds
  const PHASE_DURATIONS = {
    category: 10,    // Time to review category
    submission: 20,  // Time to submit song
    playback: 15,    // Per song duration, will be multiplied by number of submissions
    voting: 15,      // Time to vote
    results: 15      // Time to view results
  };
  
  // Sample song data for bots
  const SAMPLE_SONGS = [
    {
      trackId: '4cOdK2wGLETKBW3PvgPWqT', // Bohemian Rhapsody
      trackName: 'Bohemian Rhapsody',
      trackArtist: 'Queen',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273c9f744b5fe8014d3055f8b84'
    },
    {
      trackId: '1lCRw5FEZ1gPDNPzy1K4zW', // Sweet Child O' Mine
      trackName: 'Sweet Child O\' Mine',
      trackArtist: 'Guns N\' Roses',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b2736f0643d07329a71d40290983'
    },
    {
      trackId: '5CQ30WqJwcep0pYcV4AMNc', // Stairway to Heaven
      trackName: 'Stairway to Heaven - Remaster',
      trackArtist: 'Led Zeppelin',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b27351c02a77d09dfcd53c8676d0'
    },
    {
      trackId: '1BxfuPKGuaTgP7aM0Bbdwr', // Smells Like Teen Spirit
      trackName: 'Smells Like Teen Spirit',
      trackArtist: 'Nirvana',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273e175a19e530c898d167d39bf'
    },
    {
      trackId: '7GhIk7Il098yCjg4BQjzvb', // Don't Stop Believin'
      trackName: 'Don\'t Stop Believin\'',
      trackArtist: 'Journey',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273c5653f9038e42efad2b337af'
    },
    {
      trackId: '4Io5vWtmV1rFj4ASTYVm8Q', // Hotel California
      trackName: 'Hotel California',
      trackArtist: 'Eagles',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273e02d9fbfc7772a5c6a142211'
    },
    {
      trackId: '3z8h0TU7ReDPLIbEnYhWZb', // Bohemian Rhapsody
      trackName: 'Bohemian Rhapsody',
      trackArtist: 'Queen',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b'
    },
    {
      trackId: '5ChkMS8OtdzJeqyybCc9R5', // Billie Jean
      trackName: 'Billie Jean',
      trackArtist: 'Michael Jackson',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273de437d960dda1ac0a3586d97'
    },
    {
      trackId: '3SdTKo2uVsxFblQjpScoHy', // Imagine
      trackName: 'Imagine',
      trackArtist: 'John Lennon',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273ee99e641faf4a8281c36dd2a'
    },
    {
      trackId: '2QfiRTz5Yc8DdShCxG1tB2', // Respect
      trackName: 'Respect',
      trackArtist: 'Aretha Franklin',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b2737dd8f95320e9d15fcd250566'
    },
    {
      trackId: '7snQQk1zcKl8gZ92AnueZW', // Thriller
      trackName: 'Thriller',
      trackArtist: 'Michael Jackson',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273c084fc5baa7d13d6bdc189a8'
    },
    {
      trackId: '3GfOAdcoc3X5GPiiXmpBjK', // Dancing Queen
      trackName: 'Dancing Queen',
      trackArtist: 'ABBA',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273d263e1c12cab7f1b83c06bcb'
    },
    {
      trackId: '0KzAbK6nItSqNh8q70tb0K', // What's Going On
      trackName: 'What\'s Going On',
      trackArtist: 'Marvin Gaye',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b273119e4094f07a8123b471ac0d'
    },
    {
      trackId: '5g7sDjBhZ4I3gcFIpkrLuI', // Wonderwall
      trackName: 'Wonderwall',
      trackArtist: 'Oasis',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b2736b5e15e1d07f497a6d138c65'
    },
    {
      trackId: '7ytR5pFWmSjzHJIeQkgog4', // Where Is My Mind?
      trackName: 'Where Is My Mind?',
      trackArtist: 'Pixies',
      trackImage: 'https://i.scdn.co/image/ab67616d0000b2733d92b2ad5af9fbc8637425f0'
    }
  ];
  
  // Bot names
  const BOT_NAMES = [
    'DJ Bot',
    'RhythmMaster',
    'BeatBot',
    'MelodyAI',
    'TuneBot',
    'SonicBot',
    'GrooveBot',
    'MixMaster',
    'VinylBot',
    'TempoBot'
  ];
  
  module.exports = {
    GAME_CATEGORIES,
    PHASE_DURATIONS,
    SAMPLE_SONGS,
    BOT_NAMES
  };