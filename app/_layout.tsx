// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for token on mount.
  useEffect(() => {
    async function checkAuth() {
      const token = await SecureStore.getItemAsync('spotify_token');
      setIsLoggedIn(!!token);
      setIsAuthChecked(true);
      SplashScreen.hideAsync();
    }
    checkAuth();
  }, []);

  if (!isAuthChecked) {
    return null; // or a splash screen
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        { !isLoggedIn ? (
          // When logged out, show the authentication flow.
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        ) : (
          // When logged in, show the main tabs.
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        )}
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
