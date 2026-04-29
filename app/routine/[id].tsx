import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number };
}

const EXERCISE_ICONS = ['dumbbell', 'flag', 'star', 'fire', 'trophy', 'bolt', 'heart', 'medkit'];

export default function RoutineScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { id: routineId, name: routineName } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState('default');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) loadCurrentPlan();
    });
    return () => unsubscribeAuth();
  }, []);

  const loadCurrentPlan = async () => {
    try {
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      setCurrentPlanId(savedPlan || 'default');
    } catch (e) {
      console.error('Erro ao ler plano:', e);
    }
  };

  useEffect(() => {
    if (!user || !routineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const exercisesPath =
      currentPlanId === 'default'
        ? collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises')
        : collection(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises');

    const q = query(exercisesPath, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExercises(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Exercise));
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar exercícios:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId, currentPlanId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (routineName as string) || 'Ficha',
      headerRight: () => (
        <TouchableOpacity onPress={openAddExerciseModal} style={{ marginRight: 12 }}>
          <FontAwesome name="plus" size={22} color="#EF4444" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, routineName]);

  const openAddExerciseModal = () => {
    setEditingExercise(null);
    setNewExerciseName('');
    setNewExerciseSets('');
    setExerciseModalVisible(true);
  };

  const openEditExerciseModal = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setNewExerciseName(exercise.name);
    setNewExerciseSets(exercise.sets);
    setExerciseModalVisible(true);
  };

  const handleSaveExercise = async () => {
    if (!user || !routineId || !newExerciseName || !newExerciseSets) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    setSaveLoading(true);
    try {
      const exercisesCollection =
        currentPlanId === 'default'
          ? collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises')
          : collection(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises');

      if (editingExercise) {
        await updateDoc(doc(exercisesCollection, editingExercise.id), {
          name: newExerciseName,
          sets: newExerciseSets,
        });
      } else {
        await addDoc(exercisesCollection, {
          name: newExerciseName,
          sets: newExerciseSets,
          order: Date.now(),
          createdAt: serverTimestamp(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExerciseModalVisible(false);
      setEditingExercise(null);
    } catch (error) {
      console.error('Erro ao salvar exercício:', error);
      Alert.alert('Erro', 'Não foi possível salvar o exercício.');
    }
    setSaveLoading(false);
  };

  const handleDeleteExercise = (exerciseId: string) => {
    if (!user || !routineId) return;
    Alert.alert('Deletar Exercício', 'Isso apagará o exercício e todos os registros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(exerciseId);
          try {
            const exerciseRef =
              currentPlanId === 'default'
                ? doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId)
                : doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises', exerciseId);

            const logsCollection = collection(exerciseRef, 'logs');
            const logsSnapshot = await getDocs(logsCollection);
            const batch = writeBatch(db);
            logsSnapshot.forEach((logDoc) => batch.delete(logDoc.ref));
            batch.delete(exerciseRef);
            await batch.commit();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            console.error('Erro ao deletar:', error);
            Alert.alert('Erro', 'Não foi possível deletar.');
          }
          setActionLoading(null);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#EF4444" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Modal animationType="slide" transparent visible={exerciseModalVisible} onRequestClose={() => setExerciseModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingExercise ? 'Editar Exercício' : 'Novo Exercício'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome (Ex: Supino Reto)"
              placeholderTextColor="#666"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Séries (Ex: 4x 10-12)"
              placeholderTextColor="#666"
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setExerciseModalVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveExercise} disabled={saveLoading}>
                {saveLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const iconIndex = index % EXERCISE_ICONS.length;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <FontAwesome name={EXERCISE_ICONS[iconIndex] as any} size={18} color="#EF4444" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardSets}>{item.sets}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.actionBtn} onPress={() => openEditExerciseModal(item)}>
                  <FontAwesome name="pencil" size={14} color="#888" />
                  <Text style={styles.actionText}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDeleteExercise(item.id)}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <FontAwesome name="trash" size={14} color="#EF4444" />
                      <Text style={styles.actionText}>Deletar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💪</Text>
            <Text style={styles.emptyTitle}>Nenhum exercício</Text>
            <Text style={styles.emptyText}>
              Toque no + no canto superior para adicionar exercícios a esta ficha.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#2A2A2A', borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 20 },
  modalInput: { backgroundColor: '#1E1E1E', color: '#FFF', padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#3A3A3A', marginBottom: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: '#EF4444', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  listContent: { padding: 16 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2A1A1A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#FFF', marginBottom: 3 },
  cardSets: { fontSize: 14, color: '#888' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRightWidth: 1, borderRightColor: '#2A2A2A' },
  deleteBtn: { borderRightWidth: 0 },
  actionText: { color: '#888', fontSize: 14, marginLeft: 6 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});
