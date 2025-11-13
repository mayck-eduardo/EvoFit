import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ErrorBoundary from '../components/ErrorBoundary';

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
          
          {/* ADICIONAR A NOVA ROTA DE RELATÓRIOS */}
          <Stack.Screen 
            name="report-exercises/[routineId]" 
          />

        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}