import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
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
        name="index" // TELA INICIAL
        options={{
          title: 'Treino do Dia', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="play-circle" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="edit" // Fichas (Gerenciamento)
        options={{
          title: 'Fichas', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="list-alt" size={size} color={color} /> 
          ),
        }}
      />

      {/* NOVA ABA DE RELATÓRIOS */}
      <Tabs.Screen
        name="reports" // o arquivo reports.tsx
        options={{
          title: 'Relatórios', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="bar-chart" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="calendar" // Calendário
        options={{
          title: 'Calendário', 
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="calendar" size={size} color={color} /> 
          ),
        }}
      />
      
      <Tabs.Screen
        name="settings" // Configurações
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