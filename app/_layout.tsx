import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ErrorBoundary from '../components/ErrorBoundary';
import { ThemeProvider } from '../context/ThemeContext';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_700Bold });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#121212' }}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#121212' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: 'bold', fontFamily: 'Inter_700Bold' },
                contentStyle: { backgroundColor: '#121212' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="routine/[id]" />
              <Stack.Screen name="charts/[exerciseId]" />
              <Stack.Screen name="report-exercises/[routineId]" />
              <Stack.Screen name="log-exercise/[exerciseId]" />
            </Stack>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
