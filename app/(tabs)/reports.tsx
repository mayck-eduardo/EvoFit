// app/(tabs)/reports.tsx

import { FontAwesome } from '@expo/vector-icons'; // Importa o FontAwesome
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

export interface Routine {
  id: string;
  name: string;
  order: number;
}

export default function ReportsScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setRoutines([]);
      return;
    }
    setLoading(true);
    const userId = user.uid;
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData: Routine[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar fichas: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Navega para a lista de exercícios da ficha selecionada
  const handleSelectRoutine = (routine: Routine) => {
    router.push({
      pathname: `/report-exercises/${routine.id}`, // Navega para a nova tela
      params: { routineName: routine.name },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Faça login para ver seus relatórios.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatórios</Text>
        <Text style={styles.subtitle}>Selecione uma ficha para ver os exercícios</Text>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => handleSelectRoutine(item)}
          >
            <Text style={styles.cardText}>{item.name}</Text>
            <FontAwesome name="angle-right" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhuma ficha encontrada.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#B0B0B0',
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});