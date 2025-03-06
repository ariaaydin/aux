// utils/socket-manager.js
import { io } from 'socket.io-client';

let socket = null;
let isConnecting = false;
let eventQueue = [];
let connectionCallbacks = [];
let isDisconnecting = false;


/**
 * Socket manager to handle Socket.io connections
 */
const socketManager = {
  /**
   * Initialize and connect to Socket.io server
   * @param {string} [token] - Optional authentication token
   * @returns {Promise} - Promise that resolves when connection is established
   */
  init: (token = '') => {
    // Return existing promise if already connecting
    if (isConnecting) {
      return new Promise(resolve => connectionCallbacks.push(resolve));
    }
    
    // Return immediately if already connected
    if (socket && socket.connected) {
      console.log('Socket already initialized and connected');
      return Promise.resolve(socket);
    }
    
    isConnecting = true;
    
    return new Promise((resolve, reject) => {
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
        isConnecting = false;
        
        // Process any queued events
        while (eventQueue.length > 0) {
          const { event, data } = eventQueue.shift();
          socket.emit(event, data);
        }
        
        // Resolve all pending connection promises
        resolve(socket);
        connectionCallbacks.forEach(cb => cb(socket));
        connectionCallbacks = [];
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
      
      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        isConnecting = false;
        reject(error);
        connectionCallbacks.forEach(cb => cb(null, error));
        connectionCallbacks = [];
      });
    });
  },
  
  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {Promise} - Promise that resolves when event is emitted
   */
  emit: (event, data) => {
    return new Promise((resolve, reject) => {

      if (isDisconnecting) {
        console.log(`Ignoring emit during disconnect: ${event}`);
        resolve(); // Resolve but don't send
        return;
      }
      if (!socket) {
        // Queue the event if socket isn't initialized yet
        console.log(`Socket not initialized, queuing event: ${event}`);
        eventQueue.push({ event, data });
        
        // Auto-initialize the socket
        socketManager.init()
          .then(() => resolve())
          .catch(reject);
        return;
      }
      
      if (!socket.connected) {
        // Queue the event if socket isn't connected yet
        console.log(`Socket not connected, queuing event: ${event}`);
        eventQueue.push({ event, data });
        return;
      }
      
      // Emit the event
      socket.emit(event, data);
      resolve();
    });
  },
  
  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on: (event, callback) => {
    // Auto-initialize if socket doesn't exist
    if (!socket) {
      socketManager.init().catch(err => console.error('Failed to auto-initialize socket:', err));
    }
    
    // Create an initialization promise if the socket is still connecting
    const initPromise = isConnecting ? 
      new Promise(resolve => connectionCallbacks.push(resolve)) : 
      Promise.resolve();
    
    // Register the event handler once the socket is initialized
    initPromise.then(() => {
      socket.on(event, callback);
    });
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
      console.log('Socket already disconnected');
      return;
    }
    
    // Set disconnecting flag
    isDisconnecting = true;
    
    // Clear queues
    eventQueue = [];
    connectionCallbacks = [];
    isConnecting = false;
    
    socket.disconnect();
    socket = null;
    
    // Reset flag after a short delay to allow pending operations to complete
    setTimeout(() => {
      isDisconnecting = false;
    }, 500);
  },
  
  /**
   * Wait for socket connection
   * @returns {Promise} Promise that resolves when socket is connected
   */
  waitForConnection: () => {
    if (!socket) {
      return socketManager.init();
    }
    
    if (socket.connected) {
      return Promise.resolve(socket);
    }
    
    return new Promise(resolve => {
      const onConnect = () => {
        socket.off('connect', onConnect);
        resolve(socket);
      };
      socket.on('connect', onConnect);
    });
  },
  
  /**
   * Get socket instance
   * @returns {Object|null} Socket.io client instance
   */
  getSocket: () => {
    return socket;
  },
  
  /**
   * Check if socket is connected
   * @returns {boolean} True if socket is connected
   */
  isConnected: () => {
    return socket && socket.connected;
  }
};

export default socketManager;