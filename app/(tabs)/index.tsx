import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Link, useNavigation } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';
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
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [completionMode, setCompletionMode] = useState<'any' | 'full'>('any');
  const [simpleMode, setSimpleMode] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState('default');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

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
          <Text style={styles.headerTitle}>{getGreeting()}!</Text>
          <Text style={styles.headerSubtitle}>{getTodayDate()}</Text>
        </View>
      ),
      headerStyle: { backgroundColor: '#121212', height: 100 },
      headerTintColor: '#FFFFFF',
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

  if (initialLoading) {
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
              style={styles.picker}
              dropdownIconColor={colors.primary}
            >
              {routines.map((r) => (
                <Picker.Item key={r.id} label={r.name} value={r.id} color={colors.text} />
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
              <Link
                href={
                  simpleMode
                    ? undefined
                    : ({
                        pathname: `/log-exercise/${item.id}`,
                        params: {
                          exerciseName: item.name,
                          routineId: selectedRoutineId,
                          exerciseSets: item.sets,
                        },
                      } as any)
                }
                asChild
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.exerciseCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    completed && { backgroundColor: colors.successBg, borderColor: colors.success },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={[styles.exerciseNumber, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.exerciseNumberText, { color: colors.textSecondary }]}>{index + 1}</Text>
                  </View>
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
                    <Text style={[styles.exerciseSets, { color: colors.textSecondary }]}>{item.sets}</Text>
                  </View>
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
                          { borderColor: isDark ? '#444' : colors.cardBorder },
                          completed && { backgroundColor: colors.success, borderColor: colors.success },
                        ]}
                      >
                        {completed && (
                          <Text style={styles.checkMark}>✓</Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                </Pressable>
              </Link>
            );
          }}
          contentContainerStyle={styles.listContent}
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
  container: { flex: 1, backgroundColor: '#121212' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#888' },
  pickerSection: { paddingHorizontal: 16, paddingTop: 8 },
  pickerWrapper: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  picker: { color: '#FFFFFF', height: Platform.OS === 'ios' ? 120 : 50 },
  noRoutinesText: { color: '#888', textAlign: 'center', marginTop: 10 },
  progressSection: { paddingHorizontal: 16, paddingTop: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#888', fontSize: 14, fontWeight: '600' },
  progressCount: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  completeText: { color: '#10B981', fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, gap: 0 },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 14,
  },
  exerciseCardCompleted: {
    backgroundColor: '#1A2E1A',
    borderColor: '#2D5A2D',
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2C2C2C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseNumberText: { color: '#888', fontSize: 14, fontWeight: '700' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  exerciseNameCompleted: { textDecorationLine: 'line-through', color: '#555' },
  exerciseSets: { fontSize: 14, color: '#888' },
  checkButton: { padding: 4 },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkMark: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 16 },
  emptyStateTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyStateText: { color: '#888', fontSize: 14, textAlign: 'center' },
});
