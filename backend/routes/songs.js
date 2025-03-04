// routes/songs.js - Song of the day routes

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const SongOfTheDay = mongoose.model('SongOfTheDay');
const User = mongoose.model('User');

// POST - Submit a song of the day
router.post('/', async (req, res) => {
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

// GET - Get today's song for a user
router.get('/', async (req, res) => {
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

// GET - Retrieve a specific song by ID
router.get('/:id', async (req, res) => {
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

// POST - Toggle a like for a Song of the Day
router.post('/:id/like', async (req, res) => {
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

// POST - Add a comment to a Song of the Day
router.post('/:id/comment', async (req, res) => {
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

// GET - Fetch feed for a user (songs from followed users)
router.get('/feed/:spotifyId', async (req, res) => {
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

module.exports = router;