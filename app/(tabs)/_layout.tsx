// app/(tabs)/_layout.tsx

import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

export default function TabLayout() {
  const [showReports, setShowReports] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    const loadPrefs = async () => {
      const val = await AsyncStorage.getItem('@EvoFit:showReportsTab');
      // Se for nulo (padrão), é true
      setShowReports(val === null ? true : val === 'true');
    };
    if (isFocused) loadPrefs();
  }, [isFocused]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false, 
        tabBarActiveTintColor: '#007AFF', 
        tabBarInactiveTintColor: '#8E8E93', 
        tabBarStyle: {
          backgroundColor: '#1E1E1E', 
          borderTopColor: '#3A3A3A', 
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        }
      }}
    >
      <Tabs.Screen
        name="index" 
        options={{
          title: 'Treino do Dia', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="play-circle" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="edit" 
        options={{
          title: 'Fichas', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="list-alt" size={size} color={color} /> 
          ),
        }}
      />

      <Tabs.Screen
        name="reports" 
        options={{
          title: 'Relatórios', 
          // Se showReports for false, escondemos o botão da tab
          href: showReports ? '/reports' : null, 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bar-chart" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="calendar" 
        options={{
          title: 'Calendário', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="calendar" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="settings" 
        options={{
          title: 'Config.', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="cog" size={size} color={color} /> 
          ),
        }}
      />
      
    </Tabs>
  );
}