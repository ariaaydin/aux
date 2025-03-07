// server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Enable CORS and JSON parsing.
app.use(cors());
app.use(express.json());

// MongoDB connection string (using the Aux database).
const mongoURI =
  'mongodb+srv://ariaaydin:nT2LbleDQfZAv8fb@cluster0.hybd8.mongodb.net/Aux?retryWrites=true&w=majority';

mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// =========================
// User Endpoints
// =========================

const userSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema, 'users');

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

const songOfTheDaySchema = new mongoose.Schema({
  spotifyId: { type: String, required: true }, // owner who posted the song
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] }, // store array of user IDs who liked the post
  comments: {
    type: [
      {
        user: { type: String, required: true }, // the commenting user's ID
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

const SongOfTheDay = mongoose.model('SongOfTheDay', songOfTheDaySchema, 'songOfTheDay');

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

// POST endpoint to toggle a like for a Song of the Day
app.post('/api/songOfTheDay/:id/like', async (req, res) => {
  const songId = req.params.id; // This is the _id of the SongOfTheDay document
  const { spotifyId } = req.body; // the user who is liking the song

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
  const songId = req.params.id; // The SongOfTheDay document _id
  const { spotifyId, text } = req.body; // Commenting user's id and comment text

  if (!spotifyId || !text) {
    return res.status(400).json({ error: 'Missing spotifyId or text in request body' });
  }

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song of the Day not found' });
    }
    
    // Append the new comment to the comments array
    song.comments.push({ user: spotifyId, text });
    await song.save();
    
    return res.status(201).json({ message: 'Comment added', comments: song.comments });
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(500).json({ error: 'Server error adding comment' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
