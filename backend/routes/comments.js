// routes/comments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Access the SongOfTheDay model
const SongOfTheDay = mongoose.model('SongOfTheDay');

// POST endpoint to like a comment
router.post('/songOfTheDay/:songId/comment/:commentId/like', async (req, res) => {
  const { songId, commentId } = req.params;
  const { spotifyId } = req.body;

  if (!spotifyId) {
    return res.status(400).json({ error: 'Missing spotifyId in request body' });
  }

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Find the comment by ID
    let comment = null;
    let isReply = false;
    let parentCommentIndex = -1;
    let replyIndex = -1;

    // First check main comments
    for (let i = 0; i < song.comments.length; i++) {
      if (song.comments[i].id === commentId) {
        comment = song.comments[i];
        parentCommentIndex = i;
        break;
      }
      
      // If not found, check replies of this comment
      if (song.comments[i].replies) {
        for (let j = 0; j < song.comments[i].replies.length; j++) {
          if (song.comments[i].replies[j].id === commentId) {
            comment = song.comments[i].replies[j];
            isReply = true;
            parentCommentIndex = i;
            replyIndex = j;
            break;
          }
        }
        if (isReply) break;
      }
    }

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Initialize likes array if it doesn't exist
    if (!comment.likes) {
      comment.likes = [];
    }

    // Check if user already liked this comment
    const likeIndex = comment.likes.indexOf(spotifyId);
    
    if (likeIndex !== -1) {
      // User already liked this comment, remove the like
      comment.likes.splice(likeIndex, 1);
    } else {
      // Add new like
      comment.likes.push(spotifyId);  // Just push the spotifyId string

    }

    // Update the comment in the song document
    if (isReply) {
      song.comments[parentCommentIndex].replies[replyIndex] = comment;
    } else {
      song.comments[parentCommentIndex] = comment;
    }

    await song.save();
    
    return res.status(200).json({ 
      message: 'Comment like toggled successfully',
      likes: comment.likes
    });
  } catch (err) {
    console.error('Error toggling comment like:', err);
    return res.status(500).json({ error: 'Server error toggling comment like' });
  }
});

// POST endpoint to add a reply to a comment
router.post('/songOfTheDay/:songId/comment/:commentId/reply', async (req, res) => {
  const { songId, commentId } = req.params;
  const { spotifyId, text } = req.body;

  if (!spotifyId || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Find the comment by ID
    let commentIndex = -1;
    for (let i = 0; i < song.comments.length; i++) {
      if (song.comments[i].id === commentId) {
        commentIndex = i;
        break;
      }
    }

    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Get user information for the reply
    const User = mongoose.model('User');
    const user = await User.findOne({ spotifyId });
    
    const username = user ? user.username : 'User';

    // Create the reply
    const newReply = {
      id: new mongoose.Types.ObjectId().toString(),
      userId: spotifyId,
      username,
      text,
      createdAt: new Date().toISOString(),
      likes: []
    };

    // Initialize replies array if it doesn't exist
    if (!song.comments[commentIndex].replies) {
      song.comments[commentIndex].replies = [];
    }

    // Add the reply
    song.comments[commentIndex].replies.push(newReply);

    await song.save();
    
    return res.status(201).json({ 
      message: 'Reply added successfully',
      reply: newReply
    });
  } catch (err) {
    console.error('Error adding reply:', err);
    return res.status(500).json({ error: 'Server error adding reply' });
  }
});

// GET endpoint to get comment details
router.get('/songOfTheDay/:songId/comment/:commentId', async (req, res) => {
  const { songId, commentId } = req.params;

  try {
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Find the comment by ID
    let comment = null;
    let isReply = false;
    let parentComment = null;

    // First check main comments
    for (const mainComment of song.comments) {
      if (mainComment.id === commentId) {
        comment = mainComment;
        break;
      }
      
      // If not found, check replies of this comment
      if (mainComment.replies) {
        for (const reply of mainComment.replies) {
          if (reply.id === commentId) {
            comment = reply;
            isReply = true;
            parentComment = mainComment;
            break;
          }
        }
        if (isReply) break;
      }
    }

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Return the comment details
    return res.status(200).json({ 
      comment,
      isReply,
      parentComment: isReply ? parentComment : null
    });
  } catch (err) {
    console.error('Error getting comment:', err);
    return res.status(500).json({ error: 'Server error getting comment' });
  }
});

// In routes/comments.js

// POST - Like a comment
router.post('/:songId/comment/:commentId/like', async (req, res) => {
  const { songId, commentId } = req.params;
  const { spotifyId } = req.body;

  if (!spotifyId) {
    return res.status(400).json({ error: 'Missing spotifyId in request body' });
  }

  try {
    const SongOfTheDay = mongoose.model('SongOfTheDay');
    const song = await SongOfTheDay.findById(songId);
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Find the comment (could be a top-level comment or a reply)
    let foundComment = null;
    let isReply = false;
    let parentCommentIndex = -1;
    let replyIndex = -1;

    // First check top-level comments
    const commentIndex = song.comments.findIndex(c => c.id === commentId);
    
    if (commentIndex !== -1) {
      foundComment = song.comments[commentIndex];
    } else {
      // If not found, check replies
      for (let i = 0; i < song.comments.length; i++) {
        if (song.comments[i].replies) {
          replyIndex = song.comments[i].replies.findIndex(r => r.id === commentId);
          if (replyIndex !== -1) {
            foundComment = song.comments[i].replies[replyIndex];
            isReply = true;
            parentCommentIndex = i;
            break;
          }
        }
      }
    }

    if (!foundComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if the user already liked the comment
    if (!foundComment.likes) {
      foundComment.likes = [];
    }

    const existingLikeIndex = foundComment.likes.indexOf(spotifyId);



    if (existingLikeIndex !== -1) {
      // Unlike the comment
      foundComment.likes.splice(existingLikeIndex, 1);
    } else {
      // Like the comment
      foundComment.likes.push(spotifyId);

    }

    // Update the comment in the song document
    if (isReply) {
      song.comments[parentCommentIndex].replies[replyIndex] = foundComment;
    } else {
      song.comments[commentIndex] = foundComment;
    }

    await song.save();
    
    return res.status(200).json({ 
      success: true, 
      likes: foundComment.likes 
    });
  } catch (err) {
    console.error('Error toggling comment like:', err);
    return res.status(500).json({ error: 'Server error toggling comment like' });
  }
});

// POST - Reply to a comment
router.post('/:songId/comment/:commentId/reply', async (req, res) => {
  const { songId, commentId } = req.params;
  const { spotifyId, text } = req.body;

  if (!spotifyId || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const SongOfTheDay = mongoose.model('SongOfTheDay');
    const User = mongoose.model('User');
    
    // Find the song
    const song = await SongOfTheDay.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    // Find the comment to reply to
    const commentIndex = song.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Get username for the reply
    const user = await User.findOne({ spotifyId });
    const username = user ? user.username : undefined;
    
    // Create new reply with unique ID
    const newReply = {
      id: new mongoose.Types.ObjectId().toString(),
      userId: spotifyId,
      username,
      text,
      createdAt: new Date().toISOString(),
      likes: []
    };
    
    // Initialize replies array if it doesn't exist
    if (!song.comments[commentIndex].replies) {
      song.comments[commentIndex].replies = [];
    }
    
    // Add reply to the comment
    song.comments[commentIndex].replies.push(newReply);
    
    await song.save();
    
    return res.status(201).json({ 
      success: true, 
      reply: newReply
    });
  } catch (err) {
    console.error('Error adding reply:', err);
    return res.status(500).json({ error: 'Server error adding reply' });
  }
});

module.exports = router;