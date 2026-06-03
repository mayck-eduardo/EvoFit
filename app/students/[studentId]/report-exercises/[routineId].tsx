import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appId, db } from '../../../../firebaseConfig';
import { useTheme } from '../../../../context/ThemeContext';

interface Exercise { id: string; name: string; order: number; }

const EXERCISE_ICONS = ['heartbeat', 'flag', 'star', 'fire', 'trophy', 'bolt', 'heart', 'medkit'];

export default function StudentReportExercisesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { studentId, routineId, routineName } = params;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !routineId) { setExercises([]); return; }
    setLoading(true);
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', studentId as string, 'routines', routineId as string, 'exercises');
    const q = query(exercisesCollection, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExercises(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Exercise));
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    return () => unsubscribe();
  }, [studentId, routineId]);

  const handleSelectExercise = (exercise: Exercise) => {
    router.push({
      pathname: `/students/${studentId}/charts/${exercise.id}` as any,
      params: { exerciseName: exercise.name, routineId, studentId },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ title: (routineName as string) || 'Exercícios' }} />
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => handleSelectExercise(item)}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
              <FontAwesome name={EXERCISE_ICONS[index % EXERCISE_ICONS.length] as any} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.cardText, { color: colors.text }]}>{item.name}</Text>
            <FontAwesome name="line-chart" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Carregando...</Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum exercício nesta ficha.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, fontSize: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
});
