// models/User.js - User model

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  following: { type: [String], default: [] },
  followers: { type: [String], default: [] }
});

module.exports = mongoose.model('User', userSchema, 'users');