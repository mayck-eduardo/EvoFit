import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appId, db } from '../../../../firebaseConfig';
import { useTheme } from '../../../../context/ThemeContext';

interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number };
}

const EXERCISE_ICONS = ['heartbeat', 'flag', 'star', 'fire', 'trophy', 'bolt', 'heart', 'medkit'];

export default function StudentRoutineScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { studentId, routineId, name: routineName } = params;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !routineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const exercisesPath = collection(db, 'artifacts', appId, 'users', studentId as string, 'routines', routineId as string, 'exercises');
    const q = query(exercisesPath, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExercises(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Exercise));
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar exercícios:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [studentId, routineId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (routineName as string) || 'Ficha',
      headerRight: () => (
        <TouchableOpacity onPress={openAddExerciseModal} style={{ marginRight: 12 }}>
          <FontAwesome name="plus" size={22} color={colors.primary} />
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
    if (!studentId || !routineId || !newExerciseName || !newExerciseSets) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    setSaveLoading(true);
    try {
      const exercisesCollection = collection(db, 'artifacts', appId, 'users', studentId as string, 'routines', routineId as string, 'exercises');
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
    if (!studentId || !routineId) return;
    Alert.alert('Deletar Exercício', 'Isso apagará o exercício e todos os registros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(exerciseId);
          try {
            const exerciseRef = doc(db, 'artifacts', appId, 'users', studentId as string, 'routines', routineId as string, 'exercises', exerciseId);
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <Modal animationType="slide" transparent visible={exerciseModalVisible} onRequestClose={() => setExerciseModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingExercise ? 'Editar Exercício' : 'Novo Exercício'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Nome (Ex: Supino Reto)"
              placeholderTextColor={colors.textMuted}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Séries (Ex: 4x 10-12)"
              placeholderTextColor={colors.textMuted}
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setExerciseModalVisible(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancelar</Text>
              </Pressable>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveExercise} disabled={saveLoading}>
                {saveLoading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.saveBtnText, { color: '#FFF' }]}>Salvar</Text>}
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
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.cardTop}>
                <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
                  <FontAwesome name={EXERCISE_ICONS[iconIndex] as any} size={18} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.cardSets, { color: colors.textSecondary }]}>{item.sets}</Text>
                </View>
              </View>
              <View style={[styles.cardActions, { borderTopColor: colors.cardBorder }]}>
                <Pressable style={[styles.actionBtn, { borderRightColor: colors.cardBorder }]} onPress={() => openEditExerciseModal(item)}>
                  <FontAwesome name="pencil" size={14} color={colors.textSecondary} />
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderRightWidth: 0 }]}
                  onPress={() => handleDeleteExercise(item.id)}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <FontAwesome name="trash" size={14} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Deletar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💪</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum exercício</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Toque no + no canto superior para adicionar exercícios a esta ficha.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  modalInput: { padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, marginBottom: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  listContent: { padding: 16 },
  card: { borderRadius: 14, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', marginBottom: 3 },
  cardSets: { fontSize: 14 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRightWidth: 1 },
  actionText: { fontSize: 14, marginLeft: 6 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
