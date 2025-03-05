
import React, { useState, useEffect, useRef } from 'react';
import socketManager from './socket-manager';
import { PHASES } from './types';

/**
 * A custom hook for managing game state
 * 
 * @param {string} roomCode - The game room code
 * @param {string} spotifyId - The user's Spotify ID
 * @param {Function} onError - Error handler function
 * @param {boolean} testMode - Whether test mode is enabled
 * @param {number} botCount - Number of bot players (for test mode)
 * @returns {Object} Game state and functions
 */
export const useGameState = (roomCode, spotifyId, onError, testMode = false, botCount = 0) => {
  // Game setup state
  const [isWaitingToJoin, setIsWaitingToJoin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  
  // Game phase state
  const [currentPhase, setCurrentPhase] = useState(PHASES.WAITING);
  const [timeLeft, setTimeLeft] = useState(0);
  const [category, setCategory] = useState('');
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);
  const [mySongs, setMySongs] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0);
  const [songProgress, setSongProgress] = useState({});
  const [selectedSongForSubmission, setSelectedSongForSubmission] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [roundResults, setRoundResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isGameCompleted, setIsGameCompleted] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [isManualProgression, setIsManualProgression] = useState(false);
  
  // Refs to track state between renders
  const currentPlayingIndexRef = useRef(0);
  const gameStateRef = useRef(null);
  const hasProcessedRound = useRef(false);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  
  // Init socket connection
  useEffect(() => {
    socketManager.init();
    
    // Cleanup on unmount
    return () => {
      socketManager.disconnect();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Socket event handlers
  useEffect(() => {
    if (!roomCode || !spotifyId) {
      console.log("Missing roomCode or spotifyId");
      return;
    }
    
    console.log(`Setting up socket handlers for room: ${roomCode}, user: ${spotifyId}`);
    
    // Handle connection errors
    socketManager.on('connect_error', (err) => {
      console.error("Socket connection error:", err);
      setError("Could not connect to the game server");
      setIsLoading(false);
    });
    
    // Handle game errors
    socketManager.on('gameError', (data) => {
      console.error("Game error:", data.message);
      setError(data.message);
      setIsLoading(false);
    });
    
    // Handle joining confirmation
    socketManager.on('playerJoined', (data) => {
      console.log("Player joined event received:", data);
      setPlayers(data.gameState.players);
      setIsWaitingToJoin(false);
      setIsLoading(false);
    });
    
    // Handle player ready status change
    socketManager.on('playerReady', (data) => {
      console.log("Player ready event received:", data);
      setPlayers(data.gameState.players);
    });
    
    // Handle game started
    socketManager.on('gameStarted', (data) => {
      console.log("Game started event received:", data);
      setGameState(data.gameState);
      processGameState(data.gameState);
    });
    
    // Handle game state updates
    socketManager.on('gameState', (state) => {
      console.log("Game state update received:", state);
      setGameState(state);
      processGameState(state);
    });
    
    // Handle song submission confirmation
    socketManager.on('songSubmitted', (data) => {
      console.log("Song submitted response:", data);
      if (data.success) {
        setSubmissionComplete(true);
      }
    });
    
    // Handle vote submission confirmation
    socketManager.on('voteSubmitted', (data) => {
      console.log("Vote submitted response:", data);
      if (data.success) {
        setVoteSubmitted(true);
      }
    });
    
    // Handle playback updates
    socketManager.on('playbackUpdate', (data) => {
      console.log("Playback update received:", data);
      currentPlayingIndexRef.current = data.index;
      setCurrentPlayingIndex(data.index);
      
      // Reset song progress for this track
      setSongProgress(prev => ({
        ...prev,
        [data.index]: 30 // Default to 30 seconds
      }));
    });

    // Connect to the game with the provided room code
    console.log(`Rejoining room ${roomCode}`);
    socketManager.emit('rejoinRoom', { roomCode });
    socketManager.emit('joinGame', { roomCode, spotifyId });
    
    // Enable test mode if requested
    if (testMode && botCount > 0) {
      console.log(`Enabling test mode with ${botCount} bots`);
      socketManager.emit('enableTestMode', { roomCode, spotifyId, botCount });
    }
    
    // Cleanup on unmount
    return () => {
      socketManager.off('connect_error');
      socketManager.off('gameError');
      socketManager.off('playerJoined');
      socketManager.off('playerReady');
      socketManager.off('gameStarted');
      socketManager.off('gameState');
      socketManager.off('songSubmitted');
      socketManager.off('voteSubmitted');
      socketManager.off('playbackUpdate');
    };
  }, [roomCode, spotifyId, testMode, botCount]);
  
  // Process game state updates
  const processGameState = (state) => {
    if (!state) return;
    
    console.log('Processing game state:', state);
    gameStateRef.current = state;
    
    // Basic game state
    setRound(state.currentRound || 1);
    setTotalRounds(state.totalRounds || 5);
    setPlayers(state.players || []);
    
    // Current phase info
    const newPhase = mapServerPhaseToClient(state.currentPhase);
    setCurrentPhase(newPhase);
    setTimeLeft(state.timeLeft || 0);
    setCategory(state.category || '');
    
    // Submissions info
    if (state.submissions) {
      console.log('Setting submissions:', state.submissions);
      setSubmissions(state.submissions);
    }
    
    // Results and leaderboard
    if (state.roundResults) {
      console.log('Setting round results:', state.roundResults);
      setRoundResults(state.roundResults);
      hasProcessedRound.current = true;
    }
    
    if (state.leaderboard) {
      console.log('Setting leaderboard:', state.leaderboard);
      setLeaderboard(state.leaderboard);
    }
    
    // Game completion
    if (state.status === 'completed') {
      console.log('Game is completed');
      setIsGameCompleted(true);
    }
    
    // Reset state when phase changes
    if (newPhase !== currentPhase) {
      console.log(`Phase changed from ${currentPhase} to ${newPhase}`);
      
      // Reset submission state on new submission phase
      if (newPhase === PHASES.SUBMISSION) {
        console.log('Resetting submission state');
        setSelectedSongForSubmission(null);
        setSubmissionComplete(false);
        loadPlayerSongs(state);
      }
      
      // Reset voting state on new voting phase
      if (newPhase === PHASES.VOTING) {
        console.log('Resetting voting state');
        setSelectedVote(null);
        setVoteSubmitted(false);
      }
      
      // Reset playback state on new playback phase
      if (newPhase === PHASES.PLAYBACK) {
        console.log('Resetting playback state');
        setCurrentPlayingIndex(0);
        currentPlayingIndexRef.current = 0;
        
        // Initialize song progress for each submission
        const initialProgress = {};
        if (state.submissions) {
          state.submissions.forEach((_, index) => {
            initialProgress[index] = 30; // Default to 30 seconds
          });
        }
        setSongProgress(initialProgress);
        
        // Setup playback timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        timerRef.current = setInterval(() => {
          setSongProgress(prev => {
            const currentIndex = currentPlayingIndexRef.current;
            if (prev[currentIndex] <= 0) {
              return prev;
            }
            
            return {
              ...prev,
              [currentIndex]: Math.max(0, prev[currentIndex] - 1)
            };
          });
        }, 1000);
      } else if (timerRef.current) {
        // Clear playback timer when not in playback phase
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // Loading complete
    setIsLoading(false);
  };
  const startGame = () => {
    if (!roomCode || !spotifyId) {
      onError("Missing roomCode or spotifyId");
      return;
    }
    
    console.log(`Host ${spotifyId} starting game in room ${roomCode}`);
    socketManager.emit('startGame', { roomCode, spotifyId });
  };
  
  // Load player's songs for the current round
  const loadPlayerSongs = (state) => {
    const currentPlayer = state.players.find(p => p.spotifyId === spotifyId);
    if (currentPlayer && currentPlayer.selectedSongs && currentPlayer.selectedSongs.length > 0) {
      console.log('Setting player songs:', currentPlayer.selectedSongs);
      setMySongs(currentPlayer.selectedSongs);
    } else {
      console.log('No songs found for player');
      setMySongs([]);
    }
  };
  
  // Map server phase names to client phase constants
  const mapServerPhaseToClient = (serverPhase) => {
    if (!serverPhase) return PHASES.WAITING;
    
    switch (serverPhase) {
      case 'category':
        return PHASES.CATEGORY;
      case 'submission':
        return PHASES.SUBMISSION;
      case 'playback':
        return PHASES.PLAYBACK;
      case 'voting':
        return PHASES.VOTING;
      case 'results':
        return PHASES.RESULTS;
      default:
        if (gameStateRef.current && gameStateRef.current.status === 'completed') {
          return PHASES.COMPLETED;
        }
        return PHASES.WAITING;
    }
  };
  
  // Function to join a game room
  const joinRoom = (roomCode, username) => {
    console.log(`Joining room ${roomCode} as ${username}`);
    setIsLoading(true);
    socketManager.emit('joinRoom', { roomCode, spotifyId, username });
  };
  
  // Function to set player as ready
  const setPlayerReady = (selectedSongs) => {
    console.log(`Setting player ${spotifyId} as ready with songs:`, selectedSongs);
    socketManager.emit('setReady', { roomCode, spotifyId, selectedSongs });
  };
  
  // Function to submit a song for the current round
  const submitSong = (trackId) => {
    console.log(`Submitting song ${trackId} for player ${spotifyId}`);
    socketManager.emit('submitSong', { roomCode, spotifyId, trackId });
  };
  
  // Function to submit a vote
  const submitVote = (voteForPlayerId) => {
    console.log(`Submitting vote for player ${voteForPlayerId} from player ${spotifyId}`);
    socketManager.emit('submitVote', { roomCode, spotifyId, voteForPlayerId });
  };
  
  // Function to manually progress to the next phase (for test mode)
  const manualProgressPhase = () => {
    console.log('Requesting manual phase progression');
    socketManager.emit('manualProgressPhase', { roomCode });
  };
  
  // Toggle manual progression mode
  const toggleManualProgression = () => {
    setIsManualProgression(prev => !prev);
  };
  
  return {
    currentPhase,
    timeLeft,
    
    category,
    round,
    totalRounds,
    mySongs,
    submissions,
    currentPlayingIndex,
    songProgress,
    selectedSongForSubmission,
    selectedVote,
    roundResults,
    leaderboard,
    isGameCompleted,
    voteSubmitted,
    submissionComplete,
    isManualProgression,
    isLoading,
    error,
    players,
    isWaitingToJoin,
    gameState,
    setSelectedSongForSubmission,
    setSelectedVote,
    startGame,
    submitSong,
    submitVote,
    joinRoom,
    setPlayerReady,
    manualProgressPhase,
    toggleManualProgression
  };
};