// routes/users.js - User routes

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = mongoose.model('User');

// POST endpoint: Create or verify a user
router.post('/', async (req, res) => {
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

// GET endpoint: Retrieve a user by Spotify ID
router.get('/:spotifyId', async (req, res) => {
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

// PUT endpoint: Update the username for a user identified by spotifyId
router.put('/:spotifyId', async (req, res) => {
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

// POST endpoint to follow a user
router.post('/:spotifyId/follow', async (req, res) => {
  const targetSpotifyId = req.params.spotifyId; // User to follow
  const { currentUserSpotifyId } = req.body; // Current user who is following
  
  if (!currentUserSpotifyId) {
    return res.status(400).json({ error: 'Missing currentUserSpotifyId in request body' });
  }
  
  if (targetSpotifyId === currentUserSpotifyId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  
  try {
    // Find both users
    const targetUser = await User.findOne({ spotifyId: targetSpotifyId });
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    
    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Check if already following
    if (currentUser.following.includes(targetSpotifyId)) {
      return res.status(400).json({ error: 'Already following this user' });
    }
    
    // Update following list for current user
    currentUser.following.push(targetSpotifyId);
    await currentUser.save();
    
    // Update followers list for target user
    targetUser.followers.push(currentUserSpotifyId);
    await targetUser.save();
    
    return res.status(200).json({ 
      message: 'Successfully followed user',
      following: currentUser.following,
      targetUserFollowers: targetUser.followers
    });
  } catch (err) {
    console.error('Error following user:', err);
    return res.status(500).json({ error: 'Server error following user' });
  }
});

// POST endpoint to unfollow a user
router.post('/:spotifyId/unfollow', async (req, res) => {
  const targetSpotifyId = req.params.spotifyId; // User to unfollow
  const { currentUserSpotifyId } = req.body; // Current user who is unfollowing
  
  if (!currentUserSpotifyId) {
    return res.status(400).json({ error: 'Missing currentUserSpotifyId in request body' });
  }
  
  try {
    // Find both users
    const targetUser = await User.findOne({ spotifyId: targetSpotifyId });
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    
    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    // Check if actually following
    if (!currentUser.following.includes(targetSpotifyId)) {
      return res.status(400).json({ error: 'Not following this user' });
    }
    
    // Update following list for current user
    currentUser.following = currentUser.following.filter(id => id !== targetSpotifyId);
    await currentUser.save();
    
    // Update followers list for target user
    targetUser.followers = targetUser.followers.filter(id => id !== currentUserSpotifyId);
    await targetUser.save();
    
    return res.status(200).json({ 
      message: 'Successfully unfollowed user',
      following: currentUser.following,
      targetUserFollowers: targetUser.followers
    });
  } catch (err) {
    console.error('Error unfollowing user:', err);
    return res.status(500).json({ error: 'Server error unfollowing user' });
  }
});

// GET endpoint to fetch a user's followers
router.get('/:spotifyId/followers', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  
  try {
    const user = await User.findOne({ spotifyId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch detailed information for each follower
    const followers = await Promise.all(
      user.followers.map(async (followerId) => {
        const follower = await User.findOne({ spotifyId: followerId });
        return follower ? {
          spotifyId: follower.spotifyId,
          username: follower.username,
          createdAt: follower.createdAt
        } : null;
      })
    );
    
    // Filter out any null values (in case a user was deleted)
    const validFollowers = followers.filter(follower => follower !== null);
    
    return res.status(200).json({ followers: validFollowers });
  } catch (err) {
    console.error('Error fetching followers:', err);
    return res.status(500).json({ error: 'Server error fetching followers' });
  }
});

// GET endpoint to fetch users a user is following
router.get('/:spotifyId/following', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  
  try {
    const user = await User.findOne({ spotifyId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch detailed information for each followed user
    const following = await Promise.all(
      user.following.map(async (followedId) => {
        const followedUser = await User.findOne({ spotifyId: followedId });
        return followedUser ? {
          spotifyId: followedUser.spotifyId,
          username: followedUser.username,
          createdAt: followedUser.createdAt
        } : null;
      })
    );
    
    // Filter out any null values (in case a user was deleted)
    const validFollowing = following.filter(followed => followed !== null);
    
    return res.status(200).json({ following: validFollowing });
  } catch (err) {
    console.error('Error fetching following:', err);
    return res.status(500).json({ error: 'Server error fetching following' });
  }
});

// GET endpoint to check if a user is following another user
router.get('/:spotifyId/isFollowing/:targetId', async (req, res) => {
  const currentUserSpotifyId = req.params.spotifyId;
  const targetSpotifyId = req.params.targetId;
  
  try {
    const currentUser = await User.findOne({ spotifyId: currentUserSpotifyId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isFollowing = currentUser.following.includes(targetSpotifyId);
    
    return res.status(200).json({ isFollowing });
  } catch (err) {
    console.error('Error checking following status:', err);
    return res.status(500).json({ error: 'Server error checking following status' });
  }
});

// GET endpoint to fetch a user's songs with most recent first
router.get('/:spotifyId/songs', async (req, res) => {
  const spotifyId = req.params.spotifyId;
  const SongOfTheDay = mongoose.model('SongOfTheDay');
  
  try {
    const songs = await SongOfTheDay.find({ spotifyId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(20); // Limit to 20 most recent songs
      
    return res.status(200).json({ songs });
  } catch (err) {
    console.error('Error fetching user songs:', err);
    return res.status(500).json({ error: 'Server error fetching user songs' });
  }
});

// GET endpoint to search for users by username
router.get('/search/:query', async (req, res) => {
  const searchQuery = req.params.query;
  
  if (!searchQuery || searchQuery.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  try {
    // Case-insensitive search for any username containing the query
    const users = await User.find({ 
      username: { $regex: searchQuery, $options: 'i' } 
    }).limit(10);
    
    // Return simplified user objects
    const userResults = users.map(user => ({
      spotifyId: user.spotifyId,
      username: user.username,
      createdAt: user.createdAt
    }));
    
    return res.status(200).json({ users: userResults });
  } catch (err) {
    console.error('Error searching users:', err);
    return res.status(500).json({ error: 'Server error searching users' });
  }
});

module.exports = router;