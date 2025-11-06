import { Inter_400Regular, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  let [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
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
        {/* 1. O grupo de Abas */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        {/* 2. A tela de Fichas */}
        <Stack.Screen 
          name="routine/[id]" 
        />
        
        {/* 3. A TELA DE GRÁFICOS */}
        <Stack.Screen 
          name="charts/[exerciseId]" 
          options={{
            presentation: 'modal', 
          }}
        />
        
      </Stack>
    </GestureHandlerRootView>
  );
}