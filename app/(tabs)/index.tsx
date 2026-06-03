import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, useNavigation } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm';
import { appId, db } from '../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
  lastFullyCompleted?: { seconds: number };
}

interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number };
}

const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  return new Date(timestamp.seconds * 1000).toDateString() === new Date().toDateString();
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getTodayDate = () =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export default function WorkoutScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const progressAnim = useRef(new Animated.Value(0)).current;

  const { user, loading: authLoading } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [completionMode, setCompletionMode] = useState<'any' | 'full'>('any');
  const [simpleMode, setSimpleMode] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState('default');

  useEffect(() => {
    if (isFocused) loadPreferences();
  }, [user, isFocused]);

  const loadPreferences = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('@EvoFit:completionMode');
      if (savedMode === 'full' || savedMode === 'any') setCompletionMode(savedMode);
      const savedSimple = await AsyncStorage.getItem('@EvoFit:simpleMode');
      setSimpleMode(savedSimple === 'true');
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      setCurrentPlanId(savedPlan || 'default');
    } catch (e) {
      console.error('Erro ao carregar prefs:', e);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !!user,
      headerTitle: () => (
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{getGreeting()}!</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{getTodayDate()}</Text>
        </View>
      ),
      headerStyle: { backgroundColor: colors.background, height: 100 },
      headerTintColor: colors.text,
    });
  }, [navigation, user]);

  useEffect(() => {
    if (!user) {
      setRoutines([]);
      setExercises([]);
      setLoadingRoutines(false);
      return;
    }
    setLoadingRoutines(true);
    const userId = user.uid;
    const routinesPath =
      currentPlanId === 'default'
        ? collection(db, 'artifacts', appId, 'users', userId, 'routines')
        : collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines');

    const q = query(routinesPath, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }) as Routine);
      setRoutines(routinesData);
      if (routinesData.length > 0) {
        const exists = routinesData.find((r) => r.id === selectedRoutineId);
        if (!selectedRoutineId || !exists) {
          setSelectedRoutineId(routinesData[0].id);
        }
      } else {
        setSelectedRoutineId(null);
      }
      setLoadingRoutines(false);
    }, (error) => {
      console.error('Erro ao buscar fichas:', error);
      setLoadingRoutines(false);
    });
    return () => unsubscribe();
  }, [user, currentPlanId]);

  useEffect(() => {
    if (!user || !selectedRoutineId) {
      setExercises([]);
      setLoadingExercises(false);
      return;
    }
    setLoadingExercises(true);
    const userId = user.uid;
    const exercisesCollection =
      currentPlanId === 'default'
        ? collection(db, 'artifacts', appId, 'users', userId, 'routines', selectedRoutineId, 'exercises')
        : collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines', selectedRoutineId, 'exercises');

    const q = query(exercisesCollection, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }) as Exercise);
      setExercises(exercisesData);
      setLoadingExercises(false);
      checkAndUpdateRoutineCompletion(exercisesData);
    }, (error) => {
      console.error('Erro ao buscar exercícios:', error);
      setLoadingExercises(false);
    });
    return () => unsubscribe();
  }, [user, selectedRoutineId, currentPlanId]);

  const checkAndUpdateRoutineCompletion = async (currentExercises: Exercise[]) => {
    if (!user || !selectedRoutineId || completionMode !== 'full') return;
    const totalCount = currentExercises.length;
    const completedCount = currentExercises.filter((ex) => isToday(ex.lastCompleted)).length;
    if (totalCount === 0) return;
    try {
      const routineRef =
        currentPlanId === 'default'
          ? doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId)
          : doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', selectedRoutineId);
      if (completedCount === totalCount) {
        await updateDoc(routineRef, { lastFullyCompleted: serverTimestamp() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await updateDoc(routineRef, { lastFullyCompleted: deleteField() });
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleToggleCheck = async (exercise: Exercise) => {
    if (!user || !selectedRoutineId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const exerciseRef =
      currentPlanId === 'default'
        ? doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId, 'exercises', exercise.id)
        : doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', selectedRoutineId, 'exercises', exercise.id);

    const completed = isToday(exercise.lastCompleted);
    setActionLoading(exercise.id);
    try {
      await updateDoc(exerciseRef, {
        lastCompleted: completed ? deleteField() : serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar.');
    }
    setActionLoading(null);
  };

  useEffect(() => {
    const completedCount = exercises.filter((ex) => isToday(ex.lastCompleted)).length;
    const totalCount = exercises.length;
    const progress = totalCount > 0 ? completedCount / totalCount : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [exercises]);

  const completedCount = exercises.filter((ex) => isToday(ex.lastCompleted)).length;
  const totalCount = exercises.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <AuthForm />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Routine Picker */}
      <View style={styles.pickerSection}>
        {loadingRoutines ? (
          <ActivityIndicator color={colors.primary} />
        ) : routines.length > 0 ? (
          <View style={[styles.pickerWrapper, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Picker
              selectedValue={selectedRoutineId}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setSelectedRoutineId(v);
              }}
              style={[styles.picker, { color: colors.text }]}
              dropdownIconColor={colors.primary}
              mode="dropdown"
              itemStyle={{ color: '#1F2937', backgroundColor: '#FFFFFF' }}
            >
              {routines.map((r) => (
                <Picker.Item key={r.id} label={r.name} value={r.id} color="#1F2937" />
              ))}
            </Picker>
          </View>
        ) : (
          <Text style={[styles.noRoutinesText, { color: colors.textSecondary }]}>
            Nenhuma ficha encontrada. Crie uma na aba "Fichas".
          </Text>
        )}
      </View>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Progresso</Text>
            <Text style={[styles.progressCount, { color: colors.text }]}>
              {completedCount}/{totalCount}
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceAlt }]}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: progressPercent === 100 ? colors.success : colors.primary,
                },
              ]}
            />
          </View>
          {progressPercent === 100 && (
            <Text style={[styles.completeText, { color: colors.success }]}>Treino concluído! Parabéns!</Text>
          )}
        </View>
      )}

      {/* Exercise List */}
      {loadingExercises ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const completed = isToday(item.lastCompleted);
            return (
              <View
                style={[
                  styles.exerciseCard,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  completed && { backgroundColor: colors.successBg, borderColor: colors.success },
                ]}
              >
                <Pressable
                  style={styles.checkButton}
                  onPress={() => handleToggleCheck(item)}
                  disabled={actionLoading === item.id}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color={colors.success} />
                  ) : (
                    <View
                      style={[
                        styles.checkCircle,
                        { borderColor: isDark ? colors.textMuted : colors.cardBorder },
                        completed && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                    >
                        {completed && (
                        <Text style={[styles.checkMark, { color: colors.text }]}>✓</Text>
                      )}
                    </View>
                  )}
                </Pressable>
                {simpleMode ? (
                  <View style={styles.exerciseInfo}>
                    <Text
                      style={[
                        styles.exerciseName,
                        { color: colors.text },
                        completed && { color: colors.textMuted, textDecorationLine: 'line-through' },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                ) : (
                  <Link
                    href={{
                      pathname: `/log-exercise/${item.id}`,
                      params: {
                        exerciseName: item.name,
                        routineId: selectedRoutineId,
                        routineName: routines.find((r) => r.id === selectedRoutineId)?.name || '',
                        exerciseSets: item.sets,
                      },
                    } as any}
                    asChild
                  >
                    <Pressable style={styles.exerciseInfo}>
                      <Text
                        style={[
                          styles.exerciseName,
                          { color: colors.text },
                          completed && { color: colors.textMuted, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  </Link>
                )}
                <Text style={[styles.exerciseSets, { color: colors.textSecondary }]}>{item.sets}</Text>
              </View>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🏋️</Text>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                Nenhum exercício nesta ficha
              </Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Adicione exercícios na aba "Fichas".
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSubtitle: { fontSize: 13 },
  pickerSection: { paddingHorizontal: 16, paddingTop: 8 },
  pickerWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: { height: Platform.OS === 'ios' ? 120 : 50 },
  noRoutinesText: { textAlign: 'center', marginTop: 10 },
  progressSection: { paddingHorizontal: 16, paddingTop: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600' },
  progressCount: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  completeText: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, gap: 0 },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkButton: { padding: 4, marginRight: 12 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 16, fontWeight: '700' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '600' },
  exerciseSets: { fontSize: 14, fontWeight: '500', marginLeft: 12 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyStateText: { fontSize: 14, textAlign: 'center' },
});
