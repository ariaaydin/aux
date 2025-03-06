// server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const http = require('http');
const socketIo = require('socket.io');

const app = express();

// Enable CORS and JSON parsing.
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// MongoDB connection string
const mongoURI =
  'mongodb+srv://ariaaydin:nT2LbleDQfZAv8fb@cluster0.hybd8.mongodb.net/Aux?retryWrites=true&w=majority';

mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// =========================
// Schema Definitions
// =========================

// User Schema - Define right in the main file or import from models/
const userSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  following: { type: [String], default: [] },
  followers: { type: [String], default: [] }
});

const User = mongoose.model('User', userSchema, 'users');

const gameRoomSchema = require('./models/GameRoom');
const GameRoom = mongoose.model('GameRoom', gameRoomSchema, 'gameRooms');


// Import Song of the Day schema with updated comment functionality
require('./models/SongOfTheDay.js');
const SongOfTheDay = mongoose.model('SongOfTheDay');

// =========================
// Routes
// =========================

// Import modular route handlers
const commentRoutes = require('./routes/comments');

// Register routes
app.use('/api', commentRoutes);

// =========================
// User Endpoints
// =========================

// POST endpoint: Create or verify a user.
app.post('/api/users', async (req, res) => {
  const { spotifyId, username } = req.body;
  if (!spotifyId || !username) {
    return res.status(400).json({ error: 'Missing spotifyId or username' });
  }
  try {
    let user = await User.findOne({ spotifyId });
    if (user) {
      return res.status(200).json({ message: 'User already exists', user });
    }
    user = new User({ spotifyId, username });
    await user.save();
    return res.status(201).json({ message: 'User created successfully', user });
  } catch (err) {
    console.error('Error in /api/users:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET endpoint: Retrieve a user by Spotify ID.
app.get('/api/users/:spotifyId', async (req, res) => {
  const spotifyId = req.params.spotifyId.trim();
  try {
    const user = await User.findOne({ spotifyId });
    if (user) {
      return res.status(200).json({ user });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Error fetching user:', err);
    return res.status(500).json({ error: 'Server error fetching user' });
  }
});

// PUT endpoint: Update the username for a user identified by spotifyId.
app.put('/api/users/:spotifyId', async (req, res) => {
  const spotifyIdParam = req.params.spotifyId.trim();
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Missing username' });
  }
  console.log(`Attempting to update user [${spotifyIdParam}] to username: ${username.trim()}`);
  try {
    const user = await User.findOneAndUpdate(
      { spotifyId: spotifyIdParam },
      { username: username.trim() },
      { new: true }
    );
    if (user) {
      console.log('User updated:', user);
      return res.status(200).json({ message: 'User updated successfully', user });
    } else {
      console.log(`User not found for spotifyId: ${spotifyIdParam}`);
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Error updating username:', err);
    return res.status(500).json({ error: 'Server error updating username' });
  }
});

// =========================
// Song of the Day Endpoints
// =========================

app.post('/api/songOfTheDay', async (req, res) => {
  const { spotifyId, trackId, trackName, trackArtist, trackImage } = req.body;
  if (!spotifyId || !trackId || !trackName || !trackArtist) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  try {
    const existing = await SongOfTheDay.findOne({
      spotifyId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });
    if (existing) {
      return res.status(400).json({ error: 'Song of the day already submitted for today' });
    }
    const newPost = new SongOfTheDay({ spotifyId, trackId, trackName, trackArtist, trackImage });
    await newPost.save();
    return res.status(201).json({ message: 'Song of the day submitted', post: newPost });
  } catch (err) {
    console.error('Error submitting song of the day:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/songOfTheDay', async (req, res) => {
  const { spotifyId } = req.query;
  if (!spotifyId) {
    return res.status(400).json({ error: 'Missing spotifyId' });
  }
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  try {
    const post = await SongOfTheDay.findOne({
      spotifyId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });
    if (post) {
      return res.status(200).json({ post });
    } else {
      return res.status(404).json({ error: 'No song submitted today' });
    }
  } catch (err) {
    console.error('Error fetching song of the day:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET endpoint: Retrieve a specific song by ID
app.get('/api/songOfTheDay/:id', async (req, res) => {
  const songId = req.params.id;
  try {
    const song = await SongOfTheDay.findById(songId);
    if (song) {
      return res.status(200).json({ song });
    } else {
      return res.status(404).json({ error: 'Song not found' });
    }
  } catch (err) {
    console.error('Error fetching song:', err);
    return res.status(500).json({ error: 'Server error fetching song' });
  }
});

// POST endpoint to toggle a like for a Song of the Day
app.post('/api/songOfTheDay/:id/like', async (req, res) => {
  const songId = req.params.id;
  const { spotifyId } = req.body;

  if (!spotifyId) {
    return res.status(400).json({ error: 'Missing spotifyId in request body' });
  }

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song of the Day not found' });
    }
    
    // Check if the user already liked the song
    const alreadyLiked = song.likes.includes(spotifyId);
    if (alreadyLiked) {
      // Remove the like (unlike)
      song.likes = song.likes.filter(id => id !== spotifyId);
    } else {
      // Add the like
      song.likes.push(spotifyId);
    }
    
    await song.save();
    return res.status(200).json({ message: 'Like toggled', likes: song.likes });
  } catch (err) {
    console.error('Error toggling like:', err);
    return res.status(500).json({ error: 'Server error toggling like' });
  }
});

// POST endpoint to add a comment to a Song of the Day
app.post('/api/songOfTheDay/:id/comment', async (req, res) => {
  const songId = req.params.id;
  const { spotifyId, text, gifUrl } = req.body;

  // Either text or gifUrl must be provided
  if (!spotifyId || (!text && !gifUrl)) {
    return res.status(400).json({ error: 'Missing required fields. Either text or gifUrl must be provided.' });
  }

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song of the Day not found' });
    }
    
    // Get username for the comment
    const user = await User.findOne({ spotifyId });
    const username = user ? user.username : undefined;
    
    // Create new comment with ID
    const newComment = {
      id: new mongoose.Types.ObjectId().toString(),
      user: spotifyId,
      username,
      text: text || "",
      gifUrl: gifUrl || undefined,
      createdAt: new Date().toISOString(),
      likes: [],
      replies: []
    };
    
    // Append the new comment to the comments array
    song.comments.push(newComment);
    await song.save();
    
    return res.status(201).json({ message: 'Comment added', comment: newComment });
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(500).json({ error: 'Server error adding comment' });
  }
});

// New endpoint to search GIFs through Giphy API with pagination support
app.get('/api/giphy/search', async (req, res) => {
  const { query, page = 1, limit = 24 } = req.query;
  const GIPHY_API_KEY = 'UDAA5IVddvEOxRgFclOncXC2SsVKhxmI';  
  
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const offset = (page - 1) * limit;
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
    
    const data = await response.json();
    
    // Extract only the needed information to reduce payload size
    const gifs = data.data.map(gif => ({
      id: gif.id,
      title: gif.title,
      previewUrl: gif.images.fixed_height_small.url,
      originalUrl: gif.images.original.url
    }));
    
    return res.status(200).json({ 
      gifs,
      pagination: {
        totalCount: data.pagination.total_count,
        count: data.pagination.count,
        offset: data.pagination.offset,
        hasMore: offset + data.pagination.count < data.pagination.total_count
      }
    });
  } catch (error) {
    console.error('Error searching Giphy:', error);
    return res.status(500).json({ error: 'Error fetching GIFs' });
  }
});

// =========================
// Leaderboard Endpoints
// =========================

// GET /api/leaderboard - Get the daily leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get date parameter or use current date
    const dateParam = req.query.date;
    let targetDate;
    
    if (dateParam) {
      targetDate = new Date(dateParam);
    } else {
      targetDate = new Date();
    }
    
    // Set time to midnight for proper date comparison
    targetDate.setHours(0, 0, 0, 0);
    
    // Calculate the next day to get all posts from the specific day
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Find all songs posted on the target date
    const songs = await SongOfTheDay.find({
      createdAt: {
        $gte: targetDate,
        $lt: nextDay
      }
    }).sort({ 'likes.length': -1 });
    
    // Prepare leaderboard data with user information
    const leaderboard = await Promise.all(songs.map(async (song, index) => {
      // Find the user who posted the song
      const user = await User.findOne({ spotifyId: song.spotifyId });
      
      return {
        _id: song._id,
        trackId: song.trackId,
        trackName: song.trackName,
        trackArtist: song.trackArtist,
        trackImage: song.trackImage,
        spotifyId: song.spotifyId,
        username: user ? user.username : 'Unknown User',
        likesCount: song.likes ? song.likes.length : 0,
        rank: index + 1 // Assign rank based on sort order
      };
    }));
    
    res.status(200).json({ leaderboard });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
});

// GET - All-time top songs
app.get('/api/leaderboard/all-time', async (req, res) => {
  try {
    // Find top 20 songs of all time by like count
    const songs = await SongOfTheDay.find()
      .sort({ 'likes.length': -1 })
      .limit(20);
    
    // Prepare leaderboard data with user information
    const leaderboard = await Promise.all(songs.map(async (song, index) => {
      // Find the user who posted the song
      const user = await User.findOne({ spotifyId: song.spotifyId });
      
      return {
        _id: song._id,
        trackId: song.trackId,
        trackName: song.trackName,
        trackArtist: song.trackArtist,
        trackImage: song.trackImage,
        spotifyId: song.spotifyId,
        username: user ? user.username : 'Unknown User',
        likesCount: song.likes ? song.likes.length : 0,
        rank: index + 1, // Assign rank based on sort order
        postDate: song.createdAt
      };
    }));
    
    res.status(200).json({ leaderboard });
    
  } catch (error) {
    console.error('Error fetching all-time leaderboard:', error);
    res.status(500).json({ error: 'Error fetching all-time leaderboard' });
  }
});

// =========================
// Follow/Unfollow Endpoints
// =========================

app.post('/api/users/:spotifyId/follow', async (req, res) => {
  const targetSpotifyId = req.params.spotifyId; // User to follow
  const { currentUserSpotifyId } = req.body; // Current user who is following
  
  if (!currentUserSpotifyId) {
    return res.status(400).json({ error: 'Missing currentUserSpotifyId in request body' });
  }
  
  if (targetSpotifyId === currentUserSpotifyId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  
  try {
    // Find both users
    const targetUser = await User.findOne({ spotifyId: targetSpotifyId });
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    
    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Check if already following
    if (currentUser.following.includes(targetSpotifyId)) {
      return res.status(400).json({ error: 'Already following this user' });
    }
    
    // Update following list for current user
    currentUser.following.push(targetSpotifyId);
    await currentUser.save();
    
    // Update followers list for target user
    targetUser.followers.push(currentUserSpotifyId);
    await targetUser.save();
    
    return res.status(200).json({ 
      message: 'Successfully followed user',
      following: currentUser.following,
      targetUserFollowers: targetUser.followers
    });
  } catch (err) {
    console.error('Error following user:', err);
    return res.status(500).json({ error: 'Server error following user' });
  }
});

// POST endpoint to unfollow a user
app.post('/api/users/:spotifyId/unfollow', async (req, res) => {
  const targetSpotifyId = req.params.spotifyId; // User to unfollow
  const { currentUserSpotifyId } = req.body; // Current user who is unfollowing
  
  if (!currentUserSpotifyId) {
    return res.status(400).json({ error: 'Missing currentUserSpotifyId in request body' });
  }
  
  try {
    // Find both users
    const targetUser = await User.findOne({ spotifyId: targetSpotifyId });
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    
    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Check if actually following
    if (!currentUser.following.includes(targetSpotifyId)) {
      return res.status(400).json({ error: 'Not following this user' });
    }
    
    // Update following list for current user
    currentUser.following = currentUser.following.filter(id => id !== targetSpotifyId);
    await currentUser.save();
    
    // Update followers list for target user
    targetUser.followers = targetUser.followers.filter(id => id !== currentUserSpotifyId);
    await targetUser.save();
    
    return res.status(200).json({ 
      message: 'Successfully unfollowed user',
      following: currentUser.following,
      targetUserFollowers: targetUser.followers
    });
  } catch (err) {
    console.error('Error unfollowing user:', err);
    return res.status(500).json({ error: 'Server error unfollowing user' });
  }
});

// =========================
// User Followers/Following Endpoints
// =========================

// GET endpoint to fetch a user's followers
app.get('/api/users/:spotifyId/followers', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  
  try {
    const user = await User.findOne({ spotifyId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch detailed information for each follower
    const followers = await Promise.all(
      user.followers.map(async (followerId) => {
        const follower = await User.findOne({ spotifyId: followerId });
        return follower ? {
          spotifyId: follower.spotifyId,
          username: follower.username,
          createdAt: follower.createdAt
        } : null;
      })
    );
    
    // Filter out any null values (in case a user was deleted)
    const validFollowers = followers.filter(follower => follower !== null);
    
    return res.status(200).json({ followers: validFollowers });
  } catch (err) {
    console.error('Error fetching followers:', err);
    return res.status(500).json({ error: 'Server error fetching followers' });
  }
});

// GET endpoint to fetch users a user is following
app.get('/api/users/:spotifyId/following', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  
  try {
    const user = await User.findOne({ spotifyId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch detailed information for each followed user
    const following = await Promise.all(
      user.following.map(async (followedId) => {
        const followedUser = await User.findOne({ spotifyId: followedId });
        return followedUser ? {
          spotifyId: followedUser.spotifyId,
          username: followedUser.username,
          createdAt: followedUser.createdAt
        } : null;
      })
    );
    
    // Filter out any null values (in case a user was delete
    // Filter out any null values (in case a user was deleted)
    const validFollowing = following.filter(followed => followed !== null);
    
    return res.status(200).json({ following: validFollowing });
  } catch (err) {
    console.error('Error fetching following:', err);
    return res.status(500).json({ error: 'Server error fetching following' });
  }
});

// GET endpoint to check if a user is following another user
app.get('/api/users/:spotifyId/isFollowing/:targetId', async (req, res) => {
  const currentUserSpotifyId = req.params.spotifyId;
  const targetSpotifyId = req.params.targetId;
  
  try {
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isFollowing = currentUser.following.includes(targetSpotifyId);
    
    return res.status(200).json({ isFollowing });
  } catch (err) {
    console.error('Error checking following status:', err);
    return res.status(500).json({ error: 'Server error checking following status' });
  }
});

// =========================
// User Songs and Feed Endpoints
// =========================

// GET endpoint to fetch a user's songs with most recent first
app.get('/api/users/:spotifyId/songs', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  
  try {
    const songs = await SongOfTheDay.find({ spotifyId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(20); // Limit to 20 most recent songs
      
    return res.status(200).json({ songs });
  } catch (err) {
    console.error('Error fetching user songs:', err);
    return res.status(500).json({ error: 'Server error fetching user songs' });
  }
});

// GET endpoint to fetch songs from users being followed (with enhanced comment data)
app.get('/api/feed/:spotifyId', async (req, res) => {
  const currentUserSpotifyId = req.params.spotifyId;
  
  try {
    // Get the current user
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create an array of all spotifyIds to fetch songs for, including the current user's
    const userIds = [currentUserSpotifyId];
    
    // Only add following users if the array isn't empty
    if (currentUser.following && currentUser.following.length > 0) {
      userIds.push(...currentUser.following);
    }

    console.log(`Fetching songs for userIds: ${userIds.join(', ')}`);
    
    // Get today's songs
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Find songs from these users
    const songs = await SongOfTheDay.find({
      spotifyId: { $in: userIds },
      createdAt: { $gte: startOfDay }
    }).sort({ createdAt: -1 });

    console.log(`Found ${songs.length} songs`);
    
    // Add username to each song and ensure all comment fields are properly populated
    const songsWithUsername = await Promise.all(
      songs.map(async (song) => {
        try {
          const user = await User.findOne({ spotifyId: song.spotifyId });
          
          // Process comments to ensure all have usernames and proper IDs
          const processedComments = await Promise.all(song.comments.map(async (comment) => {
            // If comment doesn't have a username, try to fetch it
            if (!comment.username) {
              const commentUser = await User.findOne({ spotifyId: comment.user });
              comment.username = commentUser ? commentUser.username : 'Unknown User';
            }
            
            // Ensure all replies have proper usernames
            if (comment.replies && comment.replies.length > 0) {
              comment.replies = await Promise.all(comment.replies.map(async (reply) => {
                if (!reply.username) {
                  const replyUser = await User.findOne({ spotifyId: reply.userId });
                  reply.username = replyUser ? replyUser.username : 'Unknown User';
                }
                return reply;
              }));
            }
            
            return {
              ...comment.toObject(),
              id: comment.id || new mongoose.Types.ObjectId().toString()
            };
          }));
          
          return {
            ...song.toObject(),
            username: user ? user.username : 'Unknown User',
            comments: processedComments
          };
        } catch (err) {
          console.error(`Error processing song: ${err}`);
          return {
            ...song.toObject(),
            username: 'Unknown User'
          };
        }
      })
    );
    
    // Always return a feed array, even if empty
    return res.status(200).json({ feed: songsWithUsername || [] });
  } catch (err) {
    console.error('Error fetching feed:', err);
    // Still return an empty feed rather than error
    return res.status(200).json({ feed: [] });
  }
});

// =========================
// User Search Endpoint
// =========================

// GET endpoint to search for users by username
app.get('/api/users/search/:query', async (req, res) => {
  const searchQuery = req.params.query;
  
  if (!searchQuery || searchQuery.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  try {
    // Case-insensitive search for any username containing the query
    const users = await User.find({ 
      username: { $regex: searchQuery, $options: 'i' } 
    }).limit(10);
    
    // Return simplified user objects
    const userResults = users.map(user => ({
      spotifyId: user.spotifyId,
      username: user.username,
      createdAt: user.createdAt
    }));
    
    return res.status(200).json({ users: userResults });
  } catch (err) {
    console.error('Error searching users:', err);
    return res.status(500).json({ error: 'Server error searching users' });
  }
});



// Add this to your server.js file before the server.listen line

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
  "Best song for karaoke"
];

// Phase durations in seconds
const PHASE_DURATIONS = {
  category: 10,    // Increased from 3s
  submission: 10,  // Increased from 15s
  playback: 15,    // Per song duration, will be multiplied by number of submissions
  voting: 10,      // Increased from 15s
  results: 10      // Increased from 10s
};
// Socket to room mapping for quick access
const socketToRoom = {};
const activeTimers = {};

// Helper function to generate a unique room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const gameStateForClient = (gameRoom) => {
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
    timeLeft = Math.max(0, Math.floor((new Date(currentRound.phaseEndTime) - new Date()) / 1000));
    if (currentRound.phase === 'playback' || currentRound.phase === 'voting') {
      submissions = currentRound.submissions.map(sub => ({
        playerId: sub.playerId,
        trackId: sub.trackId
      }));
    }
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

  return {
    roomCode: gameRoom.roomCode,
    status: gameRoom.status,
    players: gameRoom.players.map(p => ({
      spotifyId: p.spotifyId,
      username: p.username,
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


// Helper function to transition to the next game phase
// Replace your existing transitionToNextPhase function with this one
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
        // Always go to playback if there are submissions
        if (!currentRound.submissions || currentRound.submissions.length === 0) {
          console.log(`No submissions in room ${roomCode}, skipping to voting`);
          nextPhase = 'voting';
          phaseDuration = PHASE_DURATIONS.voting;
        } else {
          nextPhase = 'playback';
          // We'll set a longer overall duration for playback based on number of songs
          phaseDuration = PHASE_DURATIONS.playback * currentRound.submissions.length;
          
          // Update phase first to ensure consistency
          currentRound.phase = nextPhase;
          currentRound.phaseEndTime = new Date(Date.now() + (phaseDuration * 1000));
          await gameRoom.save();
          
          // Send updated game state
          io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
          
          // Then start playback sequence in a non-blocking way
          // We'll let the playback sequence finish naturally based on the timer
          startPlaybackSequence(roomCode, currentRound.submissions);
          
          // Set timer for the entire playback phase
          activeTimers[roomCode] = setTimeout(() => {
            // Only transition if we're still in playback phase
            // This prevents race conditions if playback sequence ends early
            GameRoom.findOne({ roomCode }).then(currentRoom => {
              if (currentRoom && 
                  currentRoom.status === 'playing' &&
                  currentRoom.rounds[currentRoundIndex] &&
                  currentRoom.rounds[currentRoundIndex].phase === 'playback') {
                transitionToNextPhase(roomCode);
              }
            });
            delete activeTimers[roomCode];
          }, phaseDuration * 1000);
          
          return; // Exit early after scheduling
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
        
        // Ensure we have a valid category for this round
        const categoryIndex = gameRoom.currentRound - 1;
        if (categoryIndex >= gameRoom.categories.length) {
          console.log(`Warning: Not enough categories for round ${gameRoom.currentRound}. Using fallback.`);
          // Use a fallback category if needed
          gameRoom.categories.push("Mystery Song Challenge");
        }
        
        // Create new round
        gameRoom.rounds.push({
          number: gameRoom.currentRound,
          category: gameRoom.categories[categoryIndex],
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
const roomPlaybackState = {};

const startPlaybackSequence = (roomCode, submissions) => {
  console.log(`Starting playback sequence for room ${roomCode} with ${submissions.length} submissions`);
  
  // Store current playback state in memory
  if (!roomPlaybackState[roomCode]) {
    roomPlaybackState[roomCode] = { 
      currentIndex: 0,
      submissions: submissions,
      startTime: Date.now()
    };
  }
  
  // Initialize with first track
  const state = roomPlaybackState[roomCode];
  state.currentIndex = 0;
  
  // Emit first track to all clients
  io.to(roomCode).emit('playbackUpdate', { 
    index: state.currentIndex,
    remainingTime: PHASE_DURATIONS.playback
  });
  
  // Create interval to cycle through tracks
  if (activeTimers[`${roomCode}-playback`]) {
    clearInterval(activeTimers[`${roomCode}-playback`]);
  }
  
  // Using setInterval but with more robust error handling
  const interval = setInterval(() => {
    try {
      // Get the current state
      const state = roomPlaybackState[roomCode];
      if (!state) {
        // If state is gone, clear the interval
        clearInterval(interval);
        delete activeTimers[`${roomCode}-playback`];
        return;
      }
      
      // Move to next track
      state.currentIndex++;
      
      // Check if we've played all tracks
      if (state.currentIndex >= state.submissions.length) {
        clearInterval(interval);
        delete activeTimers[`${roomCode}-playback`];
        delete roomPlaybackState[roomCode];
        
        // Do NOT directly call transitionToNextPhase here
        // The main timer from transitionToNextPhase will handle it
        console.log(`Playback sequence complete for room ${roomCode}`);
        return;
      }
      
      // Emit current track index
      console.log(`Playing track ${state.currentIndex + 1}/${state.submissions.length} for room ${roomCode}`);
      io.to(roomCode).emit('playbackUpdate', { 
        index: state.currentIndex,
        remainingTime: PHASE_DURATIONS.playback
      });
      
    } catch (error) {
      console.error(`Error in playback sequence for room ${roomCode}:`, error);
      // Continue playback despite error
    }
  }, PHASE_DURATIONS.playback * 1000);
  
  // Save interval reference for cleanup
  activeTimers[`${roomCode}-playback`] = interval;
};



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
  
  // Clean up playback state
  if (roomPlaybackState[roomCode]) {
    delete roomPlaybackState[roomCode];
    console.log(`Cleaned up playback state for room ${roomCode}`);
  }
};


/**
 * Manually progress to the next phase (for test mode)
 * @param {string} roomCode - Room code
 * @returns {Promise<void>}
 */
const manualProgressPhase = async (roomCode) => {
  try {
    // Cancel any existing timer
    cancelPhaseTimer(roomCode);
    
    // Transition immediately
    await transitionToNextPhase(roomCode);
    
    console.log(`Manually progressed phase for room ${roomCode}`);
  } catch (error) {
    console.error('Error in manual phase progression:', error);
  }
};

// Helper function to calculate round results
const calculateRoundResults = async (roomCode) => {
  try {
    console.log(`Calculating round results for room ${roomCode}`);
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log(`Game ${roomCode} not in playing state for results calculation`);
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`Invalid round index ${currentRoundIndex} for results calculation`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    
    // Sort submissions by vote count
    const sortedSubmissions = [...currentRound.submissions].sort(
      (a, b) => (b.votes ? b.votes.length : 0) - (a.votes ? a.votes.length : 0)
    );
    
    console.log(`Sorted submissions for round ${gameRoom.currentRound}/${gameRoom.totalRounds}:`);
    sortedSubmissions.forEach((sub, idx) => {
      const player = gameRoom.players.find(p => p.spotifyId === sub.playerId);
      console.log(`  ${idx+1}. ${player ? player.username : 'Unknown'}: ${sub.votes ? sub.votes.length : 0} votes`);
    });
    
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
      
      const voteCount = submission.votes ? submission.votes.length : 0;
      
      // Award points based on position
      if (index === 0 && voteCount > 0) {
        // Winner gets 3 points
        gameRoom.players[playerIndex].points += 3;
        console.log(`Awarded 3 points to ${gameRoom.players[playerIndex].username} (1st place)`);
      } else if (index === 1 && voteCount > 0) {
        // Runner-up gets 2 points
        gameRoom.players[playerIndex].points += 2;
        console.log(`Awarded 2 points to ${gameRoom.players[playerIndex].username} (2nd place)`);
      } else if (voteCount > 0) {
        // Others with votes get 1 point
        gameRoom.players[playerIndex].points += 1;
        console.log(`Awarded 1 point to ${gameRoom.players[playerIndex].username} (received votes)`);
      }
    });
    
    await gameRoom.save();
    console.log(`Saved updated points for game ${roomCode}`);
    
  } catch (error) {
    console.error(`Error calculating round results for room ${roomCode}:`, error);
  }
};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('enableTestMode', async ({ roomCode, spotifyId, botCount }) => {
    console.log(`Enabling test mode with ${botCount} bots for room ${roomCode}`);
    try {
      // Verify the room exists and is in waiting state
      const gameRoom = await GameRoom.findOne({ roomCode });
      if (!gameRoom) {
        socket.emit('gameError', { message: 'Room not found' });
        return;
      }
      
      if (gameRoom.status !== 'waiting') {
        socket.emit('gameError', { message: 'Cannot add bots, game already started' });
        return;
      }
      
      // This is the key fix - ALWAYS remove existing bots
      gameRoom.players = gameRoom.players.filter(p => !p.spotifyId.startsWith('bot-'));
      
      // Bot player names
      const botNames = ['DJ Bot', 'RhythmMaster', 'BeatBot', 'MelodyAI', 'TuneBot', 'SonicBot', 'GrooveBot'];
      
      // Sample song data - ENSURE ALL REQUIRED FIELDS ARE INCLUDED
      const sampleSongs = [
        {
          trackId: '4cOdK2wGLETKBW3PvgPWqT',
          trackName: 'Bohemian Rhapsody',
          trackArtist: 'Queen',
          trackImage: 'https://i.scdn.co/image/ab67616d0000b273c9f744b5fe8014d3055f8b84'
        },
        {
          trackId: '4u7EnebtmKWzUH433cf5Qv',
          trackName: 'Imagine',
          trackArtist: 'John Lennon',
          trackImage: 'https://i.scdn.co/image/ab67616d0000b27345b1fe93dba79143e8cc22ee'
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
          trackId: '1lCRw5FEZ1gPDNPzy1K4zW',
          trackName: 'Sweet Child O\' Mine',
          trackArtist: 'Guns N\' Roses',
          trackImage: 'https://i.scdn.co/image/ab67616d0000b2736f0643d07329a71d40290983'
        },
        {
          trackId: '5CQ30WqJwcep0pYcV4AMNc',
          trackName: 'Stairway to Heaven',
          trackArtist: 'Led Zeppelin',
          trackImage: 'https://i.scdn.co/image/ab67616d0000b27351c02a77d09dfcd53c8676d0'
        },
        {
          trackId: '1BxfuPKGuaTgP7aM0Bbdwr',
          trackName: 'Smells Like Teen Spirit',
          trackArtist: 'Nirvana',
          trackImage: 'https://i.scdn.co/image/ab67616d0000b273e175a19e530c898d167d39bf'
        }
      ];
      
      // Create bot players
      const actualBotCount = Math.min(botCount, botNames.length);
      
      for (let i = 0; i < actualBotCount; i++) {
        // Generate a fake Spotify ID
        const botSpotifyId = `bot-${i}-${Date.now()}`;
        
        // Create 10 random songs for this bot (ensuring each has required fields)
        const botSongs = [];
        for (let j = 0; j < 10; j++) {
          // Ensure we get a different song for each slot by using modulo
          const songIndex = (i + j) % sampleSongs.length;
          const sampleSong = sampleSongs[songIndex];
          
          // Make a deep copy with a unique ID for this bot
          const botSong = {
            trackId: `${sampleSong.trackId}-bot${i}-${j}`,
            trackName: sampleSong.trackName,
            trackArtist: sampleSong.trackArtist,
            trackImage: sampleSong.trackImage
          };
          
          botSongs.push(botSong);
        }
        
        // Add bot player to game room with isReady explicitly set to true
        gameRoom.players.push({
          spotifyId: botSpotifyId,
          username: botNames[i],
          isHost: false,
          isReady: true, // Ensure this is always true
          selectedSongs: botSongs
        });
      }
      
      await gameRoom.save();
      console.log(`Added ${actualBotCount} bots to room ${roomCode}`);
      
      // Force an immediate update to all clients
      io.to(roomCode).emit('gameState', gameStateForClient(gameRoom));
      
      // Make sure all clients know about the bot's ready status
      for (const player of gameRoom.players) {
        if (player.spotifyId.startsWith('bot-')) {
          io.to(roomCode).emit('playerReady', {
            spotifyId: player.spotifyId,
            isReady: true
          });
        }
      }
      
      socket.emit('testModeEnabled', { success: true });
      
    } catch (error) {
      console.error(`Error enabling test mode for room ${roomCode}:`, error);
      socket.emit('gameError', { message: 'Failed to enable test mode: ' + error.message });
    }
  });
  
  
  // Create a new game room
  socket.on('createRoom', async ({ spotifyId, username }) => {
    try {
      let roomCode, existingRoom;
      
      // Generate a unique room code
      do {
        roomCode = generateRoomCode();
        existingRoom = await GameRoom.findOne({ roomCode });
      } while (existingRoom);
      
      // Shuffle categories and select the needed amount
      const shuffledCategories = [...GAME_CATEGORIES].sort(() => 0.5 - Math.random());
      
      // Create a new game room
      const gameRoom = new GameRoom({
        roomCode,
        players: [{
          spotifyId,
          username,
          isHost: true,
          isReady: false
        }],
        categories: shuffledCategories.slice(0, 10) // Up to 10 rounds
      });
      
      await gameRoom.save();
      
      // Join the socket room
      socket.join(roomCode);
      socketToRoom[socket.id] = roomCode;
      
      // Send back the room code and game state
      socket.emit('roomCreated', { 
        roomCode, 
        gameState: gameRoom 
      });
      
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('gameError', { message: 'Failed to create game room' });
    }
  });
  
  // Join an existing game room
  socket.on('joinRoom', async ({ roomCode, spotifyId, username }) => {
    try {
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
  
 // In the 'setReady' handler in server.js
 socket.on('setReady', async ({ roomCode, spotifyId, selectedSongs }) => {
  try {
    const gameRoom = await GameRoom.findOne({ roomCode });
    if (!gameRoom) {
      return socket.emit('gameError', { message: 'Room not found' });
    }

    const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
    if (playerIndex !== -1) {
      // Explicitly set ready to true
      gameRoom.players[playerIndex].isReady = true;
      
      // Handle songs if provided
      if (selectedSongs && selectedSongs.length > 0) {
        gameRoom.players[playerIndex].selectedSongs = selectedSongs;
      }
      
      await gameRoom.save();
      
      // Send a SIMPLE playerReady event with just the necessary info
      io.to(roomCode).emit('playerReady', { 
        spotifyId, 
        isReady: true 
      });
      
      console.log(`Player ${spotifyId} set ready`);
    } else {
      socket.emit('gameError', { message: 'Player not found in game room' });
    }
  } catch (error) {
    console.error('Error setting player ready:', error);
    socket.emit('gameError', { message: 'Failed to update ready status' });
  }
});
  socket.on('startGame', async ({ roomCode, spotifyId }) => {
    try {
      console.log(`Received startGame request for room ${roomCode} from player ${spotifyId}`);
      
      const gameRoom = await GameRoom.findOne({ roomCode });
      if (!gameRoom) {
        console.log(`Room ${roomCode} not found for startGame`);
        return socket.emit('gameError', { message: 'Room not found' });
      }
      
      // Log current game state
      console.log(`Game state for ${roomCode}: status=${gameRoom.status}, players=${gameRoom.players.length}`);
      
      // Check if this player is the host
      const player = gameRoom.players.find(p => p.spotifyId === spotifyId);
      if (!player || !player.isHost) {
        console.log(`Player ${spotifyId} is not the host of room ${roomCode}`);
        return socket.emit('gameError', { message: 'Only the host can start the game' });
      }
      
      // Check if game is already started
      if (gameRoom.status !== 'waiting') {
        console.log(`Game ${roomCode} already in progress (status: ${gameRoom.status})`);
        return socket.emit('gameError', { message: 'Game already in progress' });
      }
      
      // Check if we have at least 2 players
      if (gameRoom.players.length < 2) {
        console.log(`Game ${roomCode} needs at least 2 players to start (current: ${gameRoom.players.length})`);
        return socket.emit('gameError', { message: 'Need at least 2 players to start' });
      }
      
      // Check if all players are ready
      const allReady = gameRoom.players.every(p => p.isReady);
      if (!allReady) {
        console.log(`Not all players in game ${roomCode} are ready`);
        return socket.emit('gameError', { message: 'Not all players are ready' });
      }
      
      // Log before starting
      console.log(`Starting game ${roomCode} with ${gameRoom.players.length} players (${gameRoom.players.map(p => p.username).join(', ')})`);
      
      // Start the game
      gameRoom.status = 'playing';
      gameRoom.currentRound = 1;
      
      // Create the first round
      gameRoom.rounds.push({
        number: 1,
        category: gameRoom.categories[0],
        phase: 'category',
        phaseEndTime: new Date(Date.now() + (PHASE_DURATIONS.category * 1000)),
        submissions: []
      });
      
      await gameRoom.save();
      
      // Notify all players that the game has started
      io.to(roomCode).emit('gameStarted', { 
        gameState: gameStateForClient(gameRoom) 
      });
      
      // Schedule the transition to the next phase
      activeTimers[roomCode] = setTimeout(() => {
        transitionToNextPhase(roomCode);
        delete activeTimers[roomCode];
      }, PHASE_DURATIONS.category * 1000);
      
      console.log(`Game started in room ${roomCode} with ${gameRoom.players.length} players`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('gameError', { message: 'Failed to start game' });
    }
  });
 

  
  // Join an active game (reconnect)
  socket.on('joinGame', async ({ roomCode, spotifyId }) => {
    try {
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
      
      // IMPORTANT: Remove the selected song from the player's available songs
      const playerIndex = gameRoom.players.findIndex(p => p.spotifyId === spotifyId);
      if (playerIndex !== -1) {
        const player = gameRoom.players[playerIndex];
        if (player.selectedSongs) {
          // Remove the song that was just submitted
          player.selectedSongs = player.selectedSongs.filter(song => song.trackId !== trackId);
          console.log(`Removed song ${trackId} from player ${spotifyId}'s available songs`);
        }
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
        // Cancel any existing timer
        cancelPhaseTimer(roomCode);
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
      const playerVoted = currentRound.submissions.some(s => s.votes && s.votes.includes(spotifyId));
      
      if (playerVoted) {
        // Remove previous vote
        currentRound.submissions.forEach(s => {
          s.votes = s.votes.filter(v => v !== spotifyId);
        });
      }
      
      // Add vote (make sure votes array exists)
      if (!currentRound.submissions[submissionIndex].votes) {
        currentRound.submissions[submissionIndex].votes = [];
      }
      currentRound.submissions[submissionIndex].votes.push(spotifyId);
      
      await gameRoom.save();
      
      // Notify the player their vote was received
      socket.emit('voteSubmitted', { success: true });
      
      // Notify all players of vote count (not which songs)
      const totalVotes = currentRound.submissions.reduce((count, s) => count + (s.votes ? s.votes.length : 0), 0);
      io.to(roomCode).emit('voteUpdate', { 
        voteCount: totalVotes,
        totalPlayers: gameRoom.players.length - currentRound.submissions.length // Don't count players voting for themselves
      });
      
      // Check if all eligible players have voted
      const eligibleVoters = gameRoom.players.length - currentRound.submissions.length;
      if (totalVotes >= eligibleVoters) {
        // Cancel any existing timer
        cancelPhaseTimer(roomCode);
        // Skip to results phase immediately
        transitionToNextPhase(roomCode);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      socket.emit('gameError', { message: 'Failed to submit vote' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    // Get room from socket
    const roomCode = socketToRoom[socket.id];
    
    if (roomCode) {
      delete socketToRoom[socket.id];
      
      // If game hasn't started, we could remove the player from the room
      // For now, we'll leave them in case they reconnect
    }
  });
  // Add these inside the io.on('connection', (socket) => {...}) block
socket.on('rejoinRoom', async ({ roomCode }) => {
  try {
    const gameRoom = await GameRoom.findOne({ roomCode });
    if (gameRoom) {
      socket.join(roomCode);
      socketToRoom[socket.id] = roomCode;
      console.log(`Socket ${socket.id} rejoined room ${roomCode}`);
    }
  } catch (error) {
    console.error('Error rejoining room:', error);
  }
});

socket.on('manualProgressPhase', async ({ roomCode }) => {
  try {
    const gameRoom = await GameRoom.findOne({ roomCode });
    
    if (!gameRoom || gameRoom.status !== 'playing') {
      return socket.emit('gameError', { message: 'Game not in progress' });
    }
    
    console.log(`Manual phase progression requested for room ${roomCode}`);
    // Cancel any existing timers
    cancelPhaseTimer(roomCode);
    // Progress to next phase
    await transitionToNextPhase(roomCode);
  } catch (error) {
    console.error('Error with manual phase progression:', error);
    socket.emit('gameError', { message: 'Failed to progress phase' });
  }
});

});










////bot
// In your server.js file, add this function
// Generate bot players for test mode


// In the createBotPlayers function in server.js
const createBotPlayers = async (roomCode, botCount, userSpotifyId) => {
  try {
    const gameRoom = await GameRoom.findOne({ roomCode });
    if (!gameRoom) return;
    
    // Bot player names
    const botNames = ['DJ Bot', 'RhythmMaster', 'BeatBot', 'MelodyAI', 'TuneBot', 'SonicBot', 'GrooveBot'];
    
    // Limit bot count to available names
    const actualBotCount = Math.min(botCount, botNames.length);  // <-- Add this line
    
    // Rest of your function...
    
    await gameRoom.save();
    console.log(`Added ${actualBotCount} bots to room ${roomCode}`);
    
    // Remove the setTimeout block that was making the game auto-start
  } catch (error) {
    console.error('Error creating bot players:', error);
  }
};


// Handle bot submissions
const handleBotSubmissions = async (roomCode) => {
  try {
    console.log(`🤖 Starting bot submissions for room ${roomCode}`);
    const gameRoom = await GameRoom.findOne({ roomCode });
    if (!gameRoom || gameRoom.status !== 'playing') {
      console.log('❌ Game not in playing state for bot submissions');
      return;
    }
    
    const currentRoundIndex = gameRoom.currentRound - 1;
    if (currentRoundIndex < 0 || currentRoundIndex >= gameRoom.rounds.length) {
      console.log(`❌ Invalid round index for bot submissions: ${currentRoundIndex}`);
      return;
    }
    
    const currentRound = gameRoom.rounds[currentRoundIndex];
    if (currentRound.phase !== 'submission') {
      console.log(`❌ Not in submission phase for bot submissions, current phase: ${currentRound.phase}`);
      return;
    }
    
    // Get bot players
    const botPlayers = gameRoom.players.filter(p => p.spotifyId.startsWith('bot-'));
    console.log(`🤖 Found ${botPlayers.length} bot players to submit songs`);
    
    // Make bots submit songs
    let submissionsChanged = false;
    for (const bot of botPlayers) {
      // Skip if bot has already submitted
      const alreadySubmitted = currentRound.submissions.some(s => s.playerId === bot.spotifyId);
      if (alreadySubmitted) {
        console.log(`Bot ${bot.username} already submitted a song`);
        continue;
      }
      
      // Check if bot has songs available
      if (!bot.selectedSongs || bot.selectedSongs.length === 0) {
        console.log(`Bot ${bot.username} has no songs available`);
        continue;
      }
      
      // Pick a random song from bot's selected songs
      const randomIndex = Math.floor(Math.random() * bot.selectedSongs.length);
      const selectedSong = bot.selectedSongs[randomIndex];
      
      // Add submission
      currentRound.submissions.push({
        playerId: bot.spotifyId,
        trackId: selectedSong.trackId,
        votes: []
      });
      
      // Remove the selected song from the bot's available songs
      bot.selectedSongs = bot.selectedSongs.filter(song => song.trackId !== selectedSong.trackId);
      
      console.log(`Bot ${bot.username} submitted song "${selectedSong.trackName}"`);
      submissionsChanged = true;
    }
    
    if (submissionsChanged) {
      await gameRoom.save();
      
      // Notify all players of submission count
      io.to(roomCode).emit('submissionUpdate', { 
        submissionCount: currentRound.submissions.length,
        totalPlayers: gameRoom.players.length
      });
      
      // Check if all players have submitted
      if (currentRound.submissions.length >= gameRoom.players.length) {
        console.log(`All players in room ${roomCode} have submitted songs, transitioning to playback`);
        cancelPhaseTimer(roomCode);
        transitionToNextPhase(roomCode);
      }
    }
  } catch (error) {
    console.error(`Error handling bot submissions for room ${roomCode}:`, error);
  }
};
// Handle bot votes
const handleBotVotes = async (roomCode) => {
  try {
    console.log(`Starting bot voting process for room ${roomCode}`);
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
    if (currentRound.submissions.length <= 1) {
      console.log('Not enough submissions to vote for');
      return;
    }
    
    // Track if any votes were cast
    let votesCast = 0;
    
    // Make bots vote
    for (const bot of botPlayers) {
      // Check if bot already voted
      const botAlreadyVoted = currentRound.submissions.some(s => 
        s.votes && s.votes.includes(bot.spotifyId)
      );
      
      if (botAlreadyVoted) {
        console.log(`Bot ${bot.username} already voted`);
        continue;
      }
      
      // Bots can't vote for themselves
      const validSubmissions = currentRound.submissions.filter(s => s.playerId !== bot.spotifyId);
      
      if (validSubmissions.length === 0) {
        console.log(`No valid submissions for bot ${bot.username} to vote for`);
        continue;
      }
      
      // Pick a random submission to vote for
      const randomIndex = Math.floor(Math.random() * validSubmissions.length);
      const selectedSubmission = validSubmissions[randomIndex];
      
      // Find the submission in the current round
      const submissionIndex = currentRound.submissions.findIndex(s => 
        s.playerId === selectedSubmission.playerId && s.trackId === selectedSubmission.trackId
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
      console.log(`Bot ${bot.username} voted for player ${selectedSubmission.playerId}`);
      
      votesCast++;
    }
    
    if (votesCast > 0) {
      await gameRoom.save();
      console.log(`Saved ${votesCast} bot votes`);
      
      // Notify all players of vote count
      const totalVotes = currentRound.submissions.reduce(
        (count, s) => count + (s.votes ? s.votes.length : 0), 
        0
      );
      
      // Calculate eligible voters (players who didn't submit)
      const eligibleVoters = gameRoom.players.length - currentRound.submissions.length;
      
      io.to(roomCode).emit('voteUpdate', { 
        voteCount: totalVotes,
        totalPlayers: eligibleVoters
      });
      
      // Check if all eligible players have voted
      if (totalVotes >= eligibleVoters) {
        console.log('All votes received, transitioning to results phase');
        // Cancel any existing timer
        cancelPhaseTimer(roomCode);
        // Transition to results phase
        transitionToNextPhase(roomCode);
      }
    } else {
      console.log('No bot votes were cast');
    }
    
  } catch (error) {
    console.error(`Error handling bot votes for room ${roomCode}:`, error);
  }
};
// =========================
// Server Start
// =========================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});