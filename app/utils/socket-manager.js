// utils/socket-manager.js

import { io } from 'socket.io-client';

let socket = null;

/**
 * Socket manager to handle Socket.io connections
 */
const socketManager = {
  /**
   * Initialize and connect to Socket.io server
   * @param {string} [token] - Optional authentication token
   */
  init: (token = '') => {
    if (socket) {
      console.log('Socket already initialized');
      return;
    }

    // Connect to Socket.io server
    const socketUrl = process.env.SOCKET_URL || 'http://localhost:3000';
    socket = io(socketUrl, {
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Log connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  },

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit: (event, data) => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    socket.emit(event, data);
  },

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on: (event, callback) => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    socket.on(event, callback);
  },

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} [callback] - Optional specific callback to remove
   */
  off: (event, callback) => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  },

  /**
   * Disconnect socket
   */
  disconnect: () => {
    if (!socket) {
      console.error('Socket not initialized');
      return;
    }

    socket.disconnect();
    socket = null;
  },

  /**
   * Get socket instance
   * @returns {Object|null} Socket.io client instance
   */
  getSocket: () => {
    return socket;
  }
};

export default socketManager;