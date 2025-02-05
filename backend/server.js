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

// Connect to MongoDB.
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// =========================
// User Endpoints
// =========================

// Define the user schema and model.
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

// Define a SongOfTheDay schema and model.
const songOfTheDaySchema = new mongoose.Schema({
  spotifyId: { type: String, required: true },
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const SongOfTheDay = mongoose.model('SongOfTheDay', songOfTheDaySchema, 'songOfTheDay');

// POST endpoint: Submit Song of the Day.
app.post('/api/songOfTheDay', async (req, res) => {
  const { spotifyId, trackId, trackName, trackArtist, trackImage } = req.body;
  if (!spotifyId || !trackId || !trackName || !trackArtist) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Calculate today's boundaries using server local time.
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

// GET endpoint: Retrieve today's Song of the Day for a user.
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
