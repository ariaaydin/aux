// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, View } from 'react-native';

// Backend endpoints
const BACKEND_SONG_ENDPOINT = 'http://localhost:3000/api/songOfTheDay';

// Prevent the splash screen from auto-hiding until authentication is checked.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasSubmittedSOTD, setHasSubmittedSOTD] = useState<boolean | null>(null);
  
  // Check for the Spotify token and SOTD submission status
  useEffect(() => {
    async function checkAuthAndSOTD() {
      try {
        const token = await SecureStore.getItemAsync('spotify_token');
        
        // If no token found, redirect to auth
        if (!token) {
          setIsLoggedIn(false);
          setHasSubmittedSOTD(false);
          setIsAuthChecked(true);
          SplashScreen.hideAsync();
          return;
        }
        
        // Validate token by trying to get user info
        try {
          // Get Spotify user info
          const resUser = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (!resUser.ok) {
            // Token invalid - clear stored tokens and redirect to auth
            console.log('Invalid token, clearing credentials');
            await SecureStore.deleteItemAsync('spotify_token');
            await SecureStore.deleteItemAsync('spotify_id');
            setIsLoggedIn(false);
            setHasSubmittedSOTD(false);
            setIsAuthChecked(true);
            SplashScreen.hideAsync();
            return;
          }
          
          // Token is valid
          const userData = await resUser.json();
          const spotifyId = userData.id;
          
          // Store ID in case it wasn't stored before
          await SecureStore.setItemAsync('spotify_id', spotifyId);
          setIsLoggedIn(true);
          
          // Check SOTD submission status
          try {
            const resSOTD = await fetch(`${BACKEND_SONG_ENDPOINT}?spotifyId=${spotifyId}`);
            if (resSOTD.ok) {
              const data = await resSOTD.json();
              setHasSubmittedSOTD(!!data.post);
            } else {
              // No submission found or backend error
              setHasSubmittedSOTD(false);
            }
          } catch (error) {
            console.error('Error checking SOTD:', error);
            setHasSubmittedSOTD(false);
          }
        } catch (error) {
          console.error('Error validating Spotify token:', error);
          // Network error or other issue - assume user needs to re-authenticate
          setIsLoggedIn(false);
          setHasSubmittedSOTD(false);
        }
      } catch (error) {
        console.error('Error checking auth token:', error);
        setIsLoggedIn(false);
        setHasSubmittedSOTD(false);
      } finally {
        setIsAuthChecked(true);
        SplashScreen.hideAsync();
      }
    }
    
    checkAuthAndSOTD();
  }, []);

  // While checking auth or SOTD status, show a loading indicator
  if (!isAuthChecked || (isLoggedIn && hasSubmittedSOTD === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00FFFF" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {!isLoggedIn ? (
          // When logged out, show the authentication flow
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        ) : !hasSubmittedSOTD ? (
          // When logged in but no SOTD submission, show the SOTD page
          <Stack.Screen name="song-of-the-day" options={{ headerShown: false }} />
        ) : (
          // When logged in and SOTD submitted, show the main tabs
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        {/* Add profile screen with no header shown */}
        <Stack.Screen name="profile/[spotifyId]" options={{ headerShown: false }} />
        {/* A catch-all "not found" screen */}
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </ThemeProvider>
  );
}