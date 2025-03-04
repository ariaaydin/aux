// models/GameRoom.js - Game room model

const mongoose = require('mongoose');

// Song Schema (for player selected songs)
const songSchema = new mongoose.Schema({
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String }
});

// Game Room Player Schema
const playerSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true },
  username: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  selectedSongs: { type: [songSchema], default: [] }
});

// Game Submission Schema
const submissionSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  trackId: { type: String, required: true },
  votes: { type: [String], default: [] }
});

// Game Round Schema
const roundSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  category: { type: String, required: true },
  phase: { 
    type: String, 
    enum: ['category', 'submission', 'playback', 'voting', 'results'],
    default: 'category'
  },
  phaseEndTime: { type: Date },
  submissions: { type: [submissionSchema], default: [] }
});

// Game Room Schema
const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['waiting', 'playing', 'completed'],
    default: 'waiting'
  },
  createdAt: { type: Date, default: Date.now },
  players: { type: [playerSchema], default: [] },
  categories: { type: [String], required: true },
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, default: 10 },
  rounds: { type: [roundSchema], default: [] }
});

const GameRoom = mongoose.model('GameRoom', gameRoomSchema);
module.exports = GameRoom;

module.exports = gameRoomSchema;