// models/SongOfTheDay.js
const mongoose = require('mongoose');

const commentLikeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const commentReplySchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  userId: { type: String, required: true },
  username: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [commentLikeSchema], default: [] }
});

const commentSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  user: { type: String, required: true }, // the commenting user's ID
  username: { type: String }, // Add username field for easier display
  text: { type: String }, // Text is now optional if there's a gif
  gifUrl: { type: String }, // URL of the GIF from Giphy
  createdAt: { type: Date, default: Date.now },
  likes: { type: [commentLikeSchema], default: [] },
  replies: { type: [commentReplySchema], default: [] }
});

const songOfTheDaySchema = new mongoose.Schema({
  spotifyId: { type: String, required: true }, // owner who posted the song
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] }, // store array of user IDs who liked the post
  comments: { type: [commentSchema], default: [] }
});

module.exports = mongoose.model('SongOfTheDay', songOfTheDaySchema, 'songOfTheDay');