// config/api.ts

// Find your computer's local IP address
// For Mac: System Preferences > Network > WiFi > Advanced > TCP/IP > IPv4 Address
// For Windows: Run cmd > ipconfig > Look for IPv4 Address

// Replace with your computer's local IP address when testing on a physical device
// Use localhost or 10.0.2.2 when testing on an emulator
export const API_BASE_URL = 'http://192.168.1.30:3000';

// URL paths for different endpoints
export const ENDPOINTS = {
  // User endpoints
  users: `${API_BASE_URL}/api/users`,
  user: (spotifyId: string) => `${API_BASE_URL}/api/users/${spotifyId}`,
  
  // Song of the Day endpoints
  songOfTheDay: `${API_BASE_URL}/api/songOfTheDay`,
  songById: (id: string) => `${API_BASE_URL}/api/songOfTheDay/${id}`,
  likeSong: (id: string) => `${API_BASE_URL}/api/songOfTheDay/${id}/like`,
  commentSong: (id: string) => `${API_BASE_URL}/api/songOfTheDay/${id}/comment`,
  
  // Leaderboard endpoints
  leaderboard: `${API_BASE_URL}/api/leaderboard`,
  leaderboardDate: (date: string) => `${API_BASE_URL}/api/leaderboard?date=${date}`,
  leaderboardAllTime: `${API_BASE_URL}/api/leaderboard/all-time`,
};

// Helper function for API calls
export async function fetchApi(
  url: string, 
  options: RequestInit = {}
): Promise<any> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}