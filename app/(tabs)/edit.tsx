import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
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
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}

const ROUTINE_ICONS: string[] = ['heartbeat', 'fire', 'star', 'bolt', 'trophy', 'heart', 'medkit', 'flag'];

export default function EditScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState('default');

  const isFocused = useIsFocused();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user && isFocused) loadCurrentPlan();
  }, [user, isFocused]);

  const loadCurrentPlan = async () => {
    try {
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      setCurrentPlanId(savedPlan || 'default');
    } catch (e) {
      console.error('Erro ao ler plano:', e);
    }
  };

  useEffect(() => {
    if (!user) {
      setRoutines([]);
      return;
    }
    setLoading(true);
    const userId = user.uid;
    const routinesPath =
      currentPlanId === 'default'
        ? collection(db, 'artifacts', appId, 'users', userId, 'routines')
        : collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines');

    const q = query(routinesPath, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoutines(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Routine));
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar fichas:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, currentPlanId]);

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
    if (!user || !newRoutineName) {
      Alert.alert('Erro', 'Digite um nome para a ficha.');
      return;
    }
    setSaveLoading(true);
    try {
      const userId = user.uid;
      const routinesCollection =
        currentPlanId === 'default'
          ? collection(db, 'artifacts', appId, 'users', userId, 'routines')
          : collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines');

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
    if (!user) return;
    Alert.alert('Deletar Ficha', 'Isso apagará a ficha e todos os exercícios e registros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(routineId);
          try {
            const userId = user.uid;
            const routineRef =
              currentPlanId === 'default'
                ? doc(db, 'artifacts', appId, 'users', userId, 'routines', routineId)
                : doc(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines', routineId);

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

  const navigateToManageExercises = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: `/routine/${routine.id}` as any,
      params: { name: routine.name },
    });
  };

  if (loading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AuthForm />
      </View>
    );
  }

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
              <Pressable onPress={() => setRoutineModalVisible(false)} style={styles.modalCancel}>
                <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancelar</Text>
              </Pressable>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleSaveRoutine}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Fichas</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {currentPlanId === 'default' ? 'Plano Padrão' : 'Plano Personalizado'}
        </Text>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const iconIndex = routines.indexOf(item) % ROUTINE_ICONS.length;
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Pressable
                style={styles.cardMain}
                onPress={() => navigateToManageExercises(item)}
              >
                <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
                  <FontAwesome
                    name={ROUTINE_ICONS[iconIndex] as any}
                    size={22}
                    color={colors.primary}
                  />
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma ficha criada</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Toque no botão + para criar sua primeira ficha de treino.
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  headerSubtitle: { fontSize: 15, color: '#888' },
  listContent: { paddingHorizontal: 16 },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    backgroundColor: '#2A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  cardHint: { fontSize: 13, color: '#666' },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#2A2A2A',
  },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: '#FFF', fontWeight: '300', lineHeight: 28 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#2A2A2A', borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 20 },
  modalInput: { backgroundColor: '#1E1E1E', color: '#FFF', padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#3A3A3A', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalCancel: { padding: 10 },
  modalCancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalSave: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  modalSaveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
