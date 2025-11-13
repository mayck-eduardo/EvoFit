
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

interface Exercise {
  id: string;
  name: string;
  order: number;
}

export default function ReportExercisesScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  
  const params = useLocalSearchParams();
  const router = useRouter();
  const { routineId, routineName } = params;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !routineId) {
      setExercises([]);
      return;
    }
    setLoading(true);
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');
    const q = query(exercisesCollection, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId]);

  // Navega para a tela de gráfico
  const handleSelectExercise = (exercise: Exercise) => {
    router.push({
      pathname: `/charts/${exercise.id}`,
      params: { 
        exerciseName: exercise.name,
        routineId: routineId 
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: (routineName as string) || "Exercícios" }} />

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => handleSelectExercise(item)}
          >
            <Text style={styles.cardText}>{item.name}</Text>
            <FontAwesome name="line-chart" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum exercício encontrado nesta ficha.</Text>
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
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
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