// models/SongOfTheDay.js - Song of the day model

const mongoose = require('mongoose');

// Reply Schema (used in comments)
const replySchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] }
});

// Comment Schema
const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user: { type: String, required: true },
  username: { type: String },
  text: { type: String, default: '' },
  gifUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] },
  replies: { type: [replySchema], default: [] }
});

// Song of the Day Schema
const songOfTheDaySchema = new mongoose.Schema({
  spotifyId: { type: String, required: true },
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] }
});

module.exports = mongoose.model('SongOfTheDay', songOfTheDaySchema);