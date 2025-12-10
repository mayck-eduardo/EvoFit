import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 1. Importar
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
  writeBatch
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

export default function RoutineScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { id: routineId, name: routineName } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');

  // Loadings
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 2. Estado do Plano
  const [currentPlanId, setCurrentPlanId] = useState('default');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) loadCurrentPlan();
    });
    return () => unsubscribeAuth();
  }, []);

  // 3. Carregar Plano
  const loadCurrentPlan = async () => {
    try {
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      setCurrentPlanId(savedPlan || 'default');
    } catch (e) {
      console.error("Erro ao ler plano", e);
    }
  };

  // 4. Buscar Exercícios (Caminho dinâmico)
  useEffect(() => {
    if (!user || !routineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    let exercisesPath;
    if (currentPlanId === 'default') {
      exercisesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');
    } else {
      exercisesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises');
    }

    const q = query(exercisesPath, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId, currentPlanId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (routineName as string) || "Gerenciar Exercícios",
      headerRight: () => (
        <TouchableOpacity onPress={openAddExerciseModal} style={{ marginRight: 15 }}>
          <FontAwesome name="plus" size={24} color="#007AFF" />
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

  // 5. Salvar Exercício (Caminho dinâmico)
  const handleSaveExercise = async () => {
    if (!user || !routineId || !newExerciseName || !newExerciseSets) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }
    setSaveLoading(true);
    try {
      let exercisesCollection;
      if (currentPlanId === 'default') {
        exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');
      } else {
        exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises');
      }

      if (editingExercise) {
        const exerciseRef = doc(exercisesCollection, editingExercise.id);
        await updateDoc(exerciseRef, {
          name: newExerciseName,
          sets: newExerciseSets,
        });
      } else {
        await addDoc(exercisesCollection, {
          name: newExerciseName,
          sets: newExerciseSets,
          createdAt: serverTimestamp(),
        });
      }
      setExerciseModalVisible(false);
      setEditingExercise(null);
    } catch (error) {
      console.error("Erro ao salvar exercício: ", error);
      Alert.alert("Erro", "Não foi possível salvar o exercício.");
    }
    setSaveLoading(false);
  };

  // 6. Deletar Exercício (Caminho dinâmico)
  const handleDeleteExercise = (exerciseId: string) => {
    if (!user || !routineId) return;
    Alert.alert(
      "Deletar Exercício",
      "Tem certeza? Todos os logs de progresso deste exercício serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            setActionLoading(exerciseId);
            try {
              let exerciseRef;
              if (currentPlanId === 'default') {
                 exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId);
              } else {
                 exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', routineId as string, 'exercises', exerciseId);
              }
              
              const logsCollection = collection(exerciseRef, 'logs');
              const logsSnapshot = await getDocs(logsCollection);
              
              const batch = writeBatch(db);
              logsSnapshot.forEach(logDoc => {
                batch.delete(logDoc.ref);
              });
              batch.delete(exerciseRef);
              await batch.commit();
              
            } catch (error) {
              console.error("Erro ao deletar exercício: ", error);
              Alert.alert("Erro", "Não foi possível deletar o exercício.");
            }
            setActionLoading(null);
          }
        }
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1, backgroundColor: '#121212' }} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: (routineName as string) || 'Ficha' }} />
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={exerciseModalVisible}
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingExercise ? "Editar Exercício" : "Novo Exercício"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do Exercício (Ex: Supino Reto)"
              placeholderTextColor="#777"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            <TextInput
              style={styles.input}
              placeholder="Séries (Ex: 4x 10-12)"
              placeholderTextColor="#777"
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
            />
            {saveLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setExerciseModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveExercise}>
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          return (
            <View style={styles.card}>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSets}>{item.sets}</Text>
              </View>
              
              <View style={styles.adminActions}>
                <TouchableOpacity 
                  style={styles.adminButton}
                  onPress={() => openEditExerciseModal(item)}
                >
                  <FontAwesome name="pencil" size={18} color="#007AFF" />
                  <Text style={styles.adminButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.adminButton, { borderLeftWidth: 1, borderLeftColor: '#3A3A3A'}]}
                  onPress={() => handleDeleteExercise(item.id)}
                >
                  <FontAwesome name="trash" size={18} color="#FF4500" />
                  <Text style={styles.adminButtonText}>Deletar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhum exercício encontrado. Clique no + no canto superior para adicionar.
          </Text>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 24,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelText: {
    color: '#FF4500',
    fontSize: 16,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden', 
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSets: {
    fontSize: 16,
    color: '#B0B0B0',
    marginTop: 5,
  },
  adminActions: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderTopWidth: 1,
    borderTopColor: '#3A3A3A',
  },
  adminButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    flexDirection: 'row',
  },
  adminButtonText: {
    color: '#B0B0B0',
    fontSize: 14,
    marginLeft: 10,
  }
});