// server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fetch = require('node-fetch');

const app = express();

// Enable CORS and JSON parsing.
app.use(cors());
app.use(express.json());

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

// =========================
// Server Start
// =========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});