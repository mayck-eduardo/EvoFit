import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appId, db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface StudentProfile {
  email: string;
  height?: number;
  weight?: number;
  birthdate?: string;
}

interface ActivityItem {
  id: string;
  exerciseName: string;
  routineName: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number };
}

interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}

const ROUTINE_ICONS = ['heartbeat', 'fire', 'star', 'bolt', 'trophy', 'heart', 'medkit', 'flag'];

function calculateAge(birthdate: string): number | null {
  if (!birthdate) return null;
  const parts = birthdate.split('/');
  if (parts.length !== 3) return null;
  const birth = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calculateIMC(height: number, weight: number): number | null {
  if (!height || !weight) return null;
  const heightM = height / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}

export default function StudentDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isPersonal } = useAuth();
  const params = useLocalSearchParams();
  const { studentId } = params;

  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!studentId) {
      setRecentActivity([]);
      return;
    }
    const activityCollection = collection(db, 'artifacts', appId, 'users', studentId as string, 'recentActivity');
    const q = query(activityCollection, orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentActivity(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ActivityItem)
      );
    }, (error) => {
      console.error('Erro ao buscar atividade recente:', error);
    });
    return () => unsubscribe();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const loadProfile = async () => {
      try {
        const studentDoc = await getDoc(doc(db, 'artifacts', appId, 'users', studentId as string));
        if (studentDoc.exists()) {
          setStudentProfile(studentDoc.data() as StudentProfile);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil do aluno:', error);
      }
      setLoadingProfile(false);
    };
    loadProfile();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const routinesPath = collection(db, 'artifacts', appId, 'users', studentId as string, 'routines');
    const q = query(routinesPath, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoutines(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Routine));
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar fichas:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [studentId]);

  const openAddModal = () => {
    setEditingRoutine(null);
    setNewRoutineName('');
    setRoutineModalVisible(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setNewRoutineName(routine.name);
    setRoutineModalVisible(true);
  };

  const handleSaveRoutine = async () => {
    if (!studentId || !newRoutineName) {
      Alert.alert('Erro', 'Digite um nome para a ficha.');
      return;
    }
    setSaveLoading(true);
    try {
      const routinesCollection = collection(db, 'artifacts', appId, 'users', studentId as string, 'routines');
      if (editingRoutine) {
        await updateDoc(doc(routinesCollection, editingRoutine.id), { name: newRoutineName });
      } else {
        await addDoc(routinesCollection, {
          name: newRoutineName,
          order: Date.now(),
          createdAt: serverTimestamp(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewRoutineName('');
      setRoutineModalVisible(false);
      setEditingRoutine(null);
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      Alert.alert('Erro', 'Não foi possível salvar a ficha.');
    }
    setSaveLoading(false);
  };

  const handleDeleteRoutine = (routineId: string) => {
    if (!studentId) return;
    Alert.alert('Deletar Ficha', 'Isso apagará a ficha e todos os exercícios e registros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(routineId);
          try {
            const routineRef = doc(db, 'artifacts', appId, 'users', studentId as string, 'routines', routineId);
            const exercisesCollection = collection(routineRef, 'exercises');
            const exercisesSnapshot = await getDocs(exercisesCollection);
            const batch = writeBatch(db);
            for (const exerciseDoc of exercisesSnapshot.docs) {
              const logsCollection = collection(exerciseDoc.ref, 'logs');
              const logsSnapshot = await getDocs(logsCollection);
              logsSnapshot.forEach((logDoc) => batch.delete(logDoc.ref));
              batch.delete(exerciseDoc.ref);
            }
            batch.delete(routineRef);
            await batch.commit();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            console.error('Erro ao deletar ficha:', error);
            Alert.alert('Erro', 'Não foi possível deletar a ficha.');
          }
          setActionLoading(null);
        },
      },
    ]);
  };

  const navigateToExercises = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: `/students/${studentId}/routine/${routine.id}` as any,
      params: { name: routine.name, studentId },
    });
  };

  const navigateToReport = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: `/students/${studentId}/report-exercises/${routine.id}` as any,
      params: { routineName: routine.name, studentId },
    });
  };

  if (!user || !isPersonal) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Acesso restrito</Text>
        </View>
      </View>
    );
  }

  const age = studentProfile?.birthdate ? calculateAge(studentProfile.birthdate) : null;
  const imc = (studentProfile?.height && studentProfile?.weight) ? calculateIMC(studentProfile.height, studentProfile.weight) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Modal animationType="slide" transparent visible={routineModalVisible} onRequestClose={() => setRoutineModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingRoutine ? 'Editar Ficha' : 'Nova Ficha'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Ex: Segunda - Peito/Tríceps"
              placeholderTextColor={colors.textMuted}
              value={newRoutineName}
              onChangeText={setNewRoutineName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setRoutineModalVisible(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancelar</Text>
              </Pressable>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveRoutine}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.saveBtnText, { color: '#FFF' }]}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {studentProfile?.email || 'Aluno'}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Detalhes do aluno
        </Text>
      </View>

      {loadingProfile ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : studentProfile ? (
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {age !== null && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{age} anos</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Idade</Text>
            </View>
          )}
          {imc !== null && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{imc}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>IMC</Text>
            </View>
          )}
          {studentProfile.height && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{studentProfile.height} cm</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Altura</Text>
            </View>
          )}
          {studentProfile.weight && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{studentProfile.weight} kg</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Peso</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Perfil não encontrado.</Text>
        </View>
      )}

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const iconIndex = index % ROUTINE_ICONS.length;
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Pressable style={styles.cardMain} onPress={() => navigateToExercises(item)}>
                <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
                  <FontAwesome name={ROUTINE_ICONS[iconIndex] as any} size={22} color={colors.primary} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.cardHint, { color: colors.textMuted }]}>Toque para gerenciar exercícios</Text>
                </View>
                <FontAwesome name="angle-right" size={20} color={colors.textMuted} />
              </Pressable>
              <View style={[styles.cardActions, { borderTopColor: colors.cardBorder }]}>
                <Pressable
                  style={[styles.actionBtn, { borderRightColor: colors.cardBorder }]}
                  onPress={() => openEditModal(item)}
                  disabled={actionLoading === item.id}
                >
                  <FontAwesome name="pencil" size={16} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderRightColor: colors.cardBorder }]}
                  onPress={() => navigateToReport(item)}
                  disabled={actionLoading === item.id}
                >
                  <FontAwesome name="bar-chart" size={16} color={colors.success} />
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderRightColor: colors.cardBorder }]}
                  onPress={() => handleDeleteRoutine(item.id)}
                  disabled={actionLoading === item.id}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <FontAwesome name="trash" size={16} color={colors.primary} />
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        ListHeaderComponent={
          <View>
            {recentActivity.length > 0 && (
              <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <View style={styles.activityHeader}>
                  <FontAwesome name="bolt" size={16} color={colors.success} />
                  <Text style={[styles.activityTitle, { color: colors.text }]}>Atividade Recente</Text>
                </View>
                {recentActivity.map((item) => (
                  <View key={item.id} style={[styles.activityRow, { borderTopColor: colors.cardBorder }]}>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityExercise, { color: colors.text }]}>{item.exerciseName}</Text>
                      <Text style={[styles.activityRoutine, { color: colors.textMuted }]}>{item.routineName}</Text>
                    </View>
                    <Text style={[styles.activitySets, { color: colors.success }]}>
                      {item.weight}kg x {item.reps}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fichas de Treino</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma ficha</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Crie a primeira ficha para este aluno.
              </Text>
            </View>
          )
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAddModal}>
        <Text style={[styles.fabText, { color: colors.text }]}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  headerSubtitle: { fontSize: 15 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  statItem: { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  listContent: { paddingHorizontal: 16 },
  card: {
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', marginBottom: 3 },
  cardHint: { fontSize: 13 },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRightWidth: 1,
  },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: '#FFF', fontWeight: '300', lineHeight: 28 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  modalInput: { padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  activityCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  activityHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  activityTitle: { fontSize: 15, fontWeight: '700' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1,
  },
  activityInfo: { flex: 1 },
  activityExercise: { fontSize: 14, fontWeight: '600' },
  activityRoutine: { fontSize: 12, marginTop: 1 },
  activitySets: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
});
