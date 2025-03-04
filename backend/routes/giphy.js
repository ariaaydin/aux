// routes/giphy.js - Giphy API routes

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Giphy API key
const GIPHY_API_KEY = 'UDAA5IVddvEOxRgFclOncXC2SsVKhxmI';  

// GET - Search GIFs through Giphy API with pagination support
router.get('/search', async (req, res) => {
  const { query, page = 1, limit = 24 } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const offset = (page - 1) * limit;
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
    
    const data = await response.json();
    
    // Extract only the needed information to reduce payload size
    const gifs = data.data.map(gif => ({
      id: gif.id,
      title: gif.title,
      previewUrl: gif.images.fixed_height_small.url,
      originalUrl: gif.images.original.url
    }));
    
    return res.status(200).json({ 
      gifs,
      pagination: {
        totalCount: data.pagination.total_count,
        count: data.pagination.count,
        offset: data.pagination.offset,
        hasMore: offset + data.pagination.count < data.pagination.total_count
      }
    });
  } catch (error) {
    console.error('Error searching Giphy:', error);
    return res.status(500).json({ error: 'Error fetching GIFs' });
  }
});

module.exports = router;