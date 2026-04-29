import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';

interface Exercise { id: string; name: string; order: number; }

const EXERCISE_ICONS = ['dumbbell', 'flag', 'star', 'fire', 'trophy', 'bolt', 'heart', 'medkit'];

export default function ReportExercisesScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useLocalSearchParams();
  const router = useRouter();
  const { routineId, routineName } = params;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !routineId) { setExercises([]); return; }
    setLoading(true);
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');
    const q = query(exercisesCollection, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExercises(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Exercise));
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    return () => unsubscribe();
  }, [user, routineId]);

  const handleSelectExercise = (exercise: Exercise) => {
    router.push({ pathname: `/charts/${exercise.id}` as any, params: { exerciseName: exercise.name, routineId } });
  };

  if (!user) return <View style={styles.container}><AuthForm /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: (routineName as string) || 'Exercícios' }} />
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            onPress={() => handleSelectExercise(item)}
          >
            <View style={styles.cardIcon}>
              <FontAwesome name={EXERCISE_ICONS[index % EXERCISE_ICONS.length] as any} size={18} color="#EF4444" />
            </View>
            <Text style={styles.cardText}>{item.name}</Text>
            <FontAwesome name="line-chart" size={18} color="#555" />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum exercício nesta ficha.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  listContent: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2A1A1A', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 },
});
