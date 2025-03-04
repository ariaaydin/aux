// routes/leaderboard.js - Leaderboard routes

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const SongOfTheDay = mongoose.model('SongOfTheDay');
const User = mongoose.model('User');

// GET - Get the daily leaderboard
router.get('/', async (req, res) => {
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
router.get('/all-time', async (req, res) => {
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

module.exports = router;