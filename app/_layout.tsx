// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding until authentication is checked.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for the Spotify token to determine if the user is logged in.
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await SecureStore.getItemAsync('spotify_token');
        setIsLoggedIn(!!token);
      } catch (error) {
        console.error('Error checking auth token:', error);
      } finally {
        setIsAuthChecked(true);
        SplashScreen.hideAsync();
      }
    }
    checkAuth();
  }, []);

  // While authentication is being checked, render nothing or a loading indicator.
  if (!isAuthChecked) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        { !isLoggedIn ? (
          // When logged out, show the authentication flow.
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        ) : (
          // When logged in, show the main tabs (which conditionally render SOTD vs. Feed/Account).
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        {/* A catch-all "not found" screen */}
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </ThemeProvider>
  );
}
