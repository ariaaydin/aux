// models/GameRoom.js
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true },
  username: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  selectedSongs: [{
    trackId: String,
    trackName: String,
    trackArtist: String,
    trackImage: String
  }],
  points: { type: Number, default: 0 }
});

const submissionSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  trackId: { type: String, required: true },
  votes: [String] // Array of voter IDs
});

const roundSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  category: { type: String, required: true },
  submissions: [submissionSchema],
  phase: { 
    type: String, 
    enum: ['category', 'submission', 'playback', 'voting', 'results'],
    default: 'category'
  },
  phaseEndTime: { type: Date }
});

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['waiting', 'selecting', 'playing', 'completed'], 
    default: 'waiting'
  },
  players: [playerSchema],
  rounds: [roundSchema],
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, default: 5 },
  categories: [String],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24*60*60*1000) } // 24 hours
});

module.exports = gameRoomSchema;