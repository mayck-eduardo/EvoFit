import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ErrorBoundary from '../components/ErrorBoundary'; // 1. Importa o ErrorBoundary

export default function RootLayout() {
  let [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    // 2. Envolve tudo com o ErrorBoundary
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack 
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1E1E1E',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontFamily: 'Inter_700Bold'
            },
            contentStyle: {
              backgroundColor: '#121212'
            }
          }}
        >
          {/* Grupo de Abas */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Telas de Navegação */}
          <Stack.Screen 
            name="routine/[id]"
          />
          <Stack.Screen 
            name="charts/[exerciseId]"
          />
          
          {/* A rota "manage-exercises" foi REMOVIDA daqui */}

        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}