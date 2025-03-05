// models/GameRoom.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define schemas from most nested to least nested
const voteSchema = new Schema({
  playerId: { type: String, required: true }
});

const submissionSchema = new Schema({
  playerId: { type: String, required: true },
  trackId: { type: String, required: true },
  votes: [{ type: String }]
});

const roundSchema = new Schema({
  number: { type: Number, required: true },
  category: { type: String, required: true },
  phase: { 
    type: String, 
    enum: ['category', 'submission', 'playback', 'voting', 'results'],
    required: true
  },
  phaseEndTime: { type: Date },
  submissions: [submissionSchema]
});

const songSchema = new Schema({
  trackId: { type: String, required: true },
  trackName: { type: String, required: true },
  trackArtist: { type: String, required: true },
  trackImage: { type: String }
});

const playerSchema = new Schema({
  spotifyId: { type: String, required: true },
  username: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  selectedSongs: [songSchema]
});

// Main game room schema
const gameRoomSchema = new Schema({
  roomCode: { 
    type: String, 
    required: true,
    unique: true,
    uppercase: true
  },
  status: { 
    type: String, 
    enum: ['waiting', 'playing', 'completed'],
    default: 'waiting'
  },
  createdAt: { type: Date, default: Date.now },
  players: [playerSchema],
  categories: [{ type: String }],
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, default: 5 },
  rounds: [roundSchema]
});

module.exports = gameRoomSchema;