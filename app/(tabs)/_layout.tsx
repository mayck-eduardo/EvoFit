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
          borderTopColor: '#333',
        },
      }}>
      {/* 1. Tela de Fichas (existente) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Fichas',
          tabBarIcon: ({ color }) => (
            <FontAwesome name="list-alt" size={24} color={color} />
          ),
        }}
      />
      {/* 2. Tela de Treino do Dia (existente) */}
      <Tabs.Screen
        name="workout" 
        options={{
          title: 'Treino do Dia',
          tabBarIcon: ({ color }) => (
            <FontAwesome name="clipboard" size={24} color={color} />
          ),
        }}
      />
      {/* 3. NOVA Tela de Edição */}
      <Tabs.Screen
        name="edit" // Nome do novo arquivo: edit.tsx
        options={{
          title: 'Editar',
          tabBarIcon: ({ color }) => (
            <FontAwesome name="pencil" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="frequencia" // Nome do novo arquivo: edit.tsx
        options={{
          title: 'Frequencia',
          tabBarIcon: ({ color }) => (
            <FontAwesome name="calendar" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}