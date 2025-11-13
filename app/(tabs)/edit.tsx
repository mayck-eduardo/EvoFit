// app/(tabs)/edit.tsx

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView // Mudamos para ScrollView para comportar as duas listas
  ,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. Importações Novas (trazidas de routine/[id].tsx)
import { FontAwesome } from '@expo/vector-icons';
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
  writeBatch
} from 'firebase/firestore';
import DraggableFlatList from 'react-native-draggable-flatlist'; // Para as duas listas
import { appId, auth, db } from '../../firebaseConfig';

// --- Interfaces ---
export interface Routine {
  id: string;
  name: string;
  order: number;
  createdAt?: { seconds: number };
}

// 2. Interface de Exercício (trazida de routine/[id].tsx)
interface Exercise {
  id: string;
  name: string;
  sets: string;
  order: number;
  createdAt?: { seconds: number };
}

export default function EditScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loadingRoutines, setLoadingRoutines] = useState(true);

  // Estados da Ficha
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

  // 3. NOVOS ESTADOS (para Exercícios)
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');
  
  // Loadings
  const [saveLoading, setSaveLoading] = useState(false); 
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Para Fichas
  const [exerciseActionLoading, setExerciseActionLoading] = useState<string | null>(null); // Para Exercícios

  // --- Efeitos (useEffect) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoadingRoutines(false);
        setRoutines([]);
        setExercises([]);
        setSelectedRoutine(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Efeito para buscar FICHAS
  useEffect(() => {
    if (!user) return;
    setLoadingRoutines(true);
    const userId = user.uid;
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData: Routine[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      setLoadingRoutines(false);
    }, (error) => {
      console.error("Erro ao buscar fichas: ", error);
      setLoadingRoutines(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 4. NOVO EFEITO (para buscar EXERCÍCIOS)
  useEffect(() => {
    if (!user || !selectedRoutine) {
      setExercises([]); // Limpa a lista se nenhuma ficha estiver selecionada
      return;
    }
    setLoadingExercises(true);
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutine.id, 'exercises');
    const q = query(exercisesCollection, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoadingExercises(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoadingExercises(false);
    });
    return () => unsubscribe(); // Limpa a escuta quando o componente ou a ficha mudar
  }, [user, selectedRoutine]); // Roda de novo se o usuário ou a ficha selecionada mudar


  // --- Funções CRUD de FICHAS ---
  const openAddRoutineModal = () => {
    setEditingRoutine(null);
    setNewRoutineName('');
    setRoutineModalVisible(true);
  };
  const openEditRoutineModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setNewRoutineName(routine.name);
    setRoutineModalVisible(true);
  };
  const handleSaveRoutine = async () => {
    if (!user || !newRoutineName) return;
    setSaveLoading(true);
    try {
      const routinesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines');
      if (editingRoutine) {
        const routineRef = doc(routinesCollection, editingRoutine.id);
        await updateDoc(routineRef, { name: newRoutineName });
      } else {
        await addDoc(routinesCollection, {
          name: newRoutineName,
          createdAt: serverTimestamp(),
          order: routines.length 
        });
      }
      setRoutineModalVisible(false);
      setEditingRoutine(null);
    } catch (error) {
      console.error("Erro ao salvar ficha: ", error);
    }
    setSaveLoading(false);
  };
  const handleDeleteRoutine = (routineId: string) => {
    if (!user) return;
    Alert.alert(
      "Deletar Ficha",
      "Tem certeza? TODOS os exercícios e logs serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          style: "destructive",
          onPress: async () => {
            setActionLoading(routineId); 
            try {
              const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId);
              const exercisesCollection = collection(routineRef, 'exercises');
              const exercisesSnapshot = await getDocs(exercisesCollection);
              const batch = writeBatch(db);
              for (const exerciseDoc of exercisesSnapshot.docs) {
                const logsCollection = collection(exerciseDoc.ref, 'logs');
                const logsSnapshot = await getDocs(logsCollection);
                logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));
                batch.delete(exerciseDoc.ref);
              }
              batch.delete(routineRef);
              await batch.commit();
              if (selectedRoutine?.id === routineId) {
                setSelectedRoutine(null); // Limpa a seleção se a ficha ativa for deletada
              }
            } catch (error) {
              console.error("Erro ao deletar ficha: ", error);
            }
            setActionLoading(null); 
          }
        }
      ]
    );
  };
  const handleDragEndRoutines = async ({ data }: { data: Routine[] }) => {
    if (!user) return;
    setRoutines(data); 
    const batch = writeBatch(db);
    data.forEach((routine, index) => {
      const routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routine.id);
      batch.update(routineRef, { order: index });
    });
    try {
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar fichas: ", error);
    }
  };

  // 5. NOVAS FUNÇÕES (CRUD de EXERCÍCIOS) - Copiadas de routine/[id].tsx
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
    if (!user || !selectedRoutine || !newExerciseName || !newExerciseSets) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }
    setSaveLoading(true);
    try {
      // Usa o 'selectedRoutine.id' do estado
      const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutine.id, 'exercises');
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
          order: exercises.length 
        });
      }
      setExerciseModalVisible(false);
      setEditingExercise(null);
    } catch (error) {
      console.error("Erro ao salvar exercício: ", error);
    }
    setSaveLoading(false);
  };
  const handleDeleteExercise = (exerciseId: string) => {
    if (!user || !selectedRoutine) return;
    Alert.alert(
      "Deletar Exercício",
      "Tem certeza? Todos os logs de progresso serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            setExerciseActionLoading(exerciseId);
            try {
              const exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutine.id, 'exercises', exerciseId);
              const logsCollection = collection(exerciseRef, 'logs');
              const logsSnapshot = await getDocs(logsCollection);
              const batch = writeBatch(db);
              logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));
              batch.delete(exerciseRef);
              await batch.commit();
            } catch (error) {
              console.error("Erro ao deletar exercício: ", error);
            }
            setExerciseActionLoading(null);
          }
        }
      ]
    );
  };
  const handleDragEndExercises = async ({ data }: { data: Exercise[] }) => {
    if (!user || !selectedRoutine) return;
    setExercises(data); 
    const batch = writeBatch(db);
    data.forEach((exercise, index) => {
      const exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutine.id, 'exercises', exercise.id);
      batch.update(exerciseRef, { order: index });
    });
    try {
      await batch.commit();
    } catch (error) {
      console.error("Erro ao reordenar exercícios: ", error);
    }
  };


  // --- Renderização ---
  if (loadingRoutines && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Faça login para gerenciar suas fichas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 6. OS DOIS MODAIS (Ficha e Exercício) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={routineModalVisible}
        onRequestClose={() => setRoutineModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingRoutine ? "Editar Ficha" : "Nova Ficha"}</Text>
            <TextInput style={styles.input} placeholder="Ex: Segunda: Peito/Tríceps" placeholderTextColor="#777" value={newRoutineName} onChangeText={setNewRoutineName} />
            {saveLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setRoutineModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveRoutine}><Text style={styles.buttonText}>Salvar</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={exerciseModalVisible}
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingExercise ? "Editar Exercício" : "Novo Exercício"}</Text>
            <TextInput style={styles.input} placeholder="Nome do Exercício (Ex: Supino Reto)" placeholderTextColor="#777" value={newExerciseName} onChangeText={setNewExerciseName} />
            <TextInput style={styles.input} placeholder="Séries (Ex: 4x 10-12)" placeholderTextColor="#777" value={newExerciseSets} onChangeText={setNewExerciseSets} />
            {saveLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setExerciseModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveExercise}><Text style={styles.buttonText}>Salvar</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 7. JSX ATUALIZADO (com ScrollView) */}
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gerenciar Fichas</Text>
          <Text style={styles.subtitle}>Adicione, edite ou reordene suas fichas.</Text>
        </View>

        {loadingRoutines ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <DraggableFlatList
            data={routines}
            keyExtractor={(item) => item.id}
            onDragEnd={handleDragEndRoutines}
            containerStyle={{ flex: 1 }}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma ficha encontrada.</Text>}
            renderItem={({ item, drag, isActive }) => {
              const isSelected = selectedRoutine?.id === item.id;
              return (
                <View style={[styles.cardContainer, isActive && styles.cardDragging]}>
                  <TouchableOpacity 
                    style={[styles.card, isSelected && styles.cardSelected]} 
                    onPress={() => setSelectedRoutine(item)} // 8. MUDANÇA (Seta o estado)
                    onLongPress={drag}
                  >
                    <Text style={styles.cardText}>{item.name}</Text>
                    <Text style={styles.cardSubtext}>{isSelected ? "Visualizando exercícios..." : "Toque para ver os exercícios"}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.iconButton} onPress={() => openEditRoutineModal(item)} disabled={actionLoading === item.id}>
                    <FontAwesome name="pencil" size={24} color="#007AFF" /> 
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteRoutine(item.id)} disabled={actionLoading === item.id}>
                    {actionLoading === item.id ? <ActivityIndicator size="small" color="#FF4500" /> : <FontAwesome name="trash" size={24} color="#FF4500" />}
                  </TouchableOpacity>
                </View>
              )
            }}
          />
        )}

        {/* 9. NOVA SEÇÃO DE EXERCÍCIOS */}
        {selectedRoutine && (
          <View style={styles.exerciseSection}>
            <View style={styles.divider}>
              <Text style={styles.title}>Exercícios</Text>
              <TouchableOpacity onPress={openAddExerciseModal} style={styles.addButton}>
                <Text style={styles.addButtonText}>Adicionar</Text>
                <FontAwesome name="plus" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Gerenciar exercícios de: {selectedRoutine.name}</Text>
            
            {loadingExercises ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 20 }} />
            ) : (
              <DraggableFlatList
                data={exercises}
                keyExtractor={(item) => item.id}
                onDragEnd={handleDragEndExercises}
                ListEmptyComponent={<Text style={styles.emptyText}>Nenhum exercício nesta ficha.</Text>}
                renderItem={({ item, drag, isActive }) => (
                  <View style={[styles.exerciseCardContainer, isActive && styles.cardDragging]}>
                    <TouchableOpacity 
                      style={styles.exerciseCard}
                      onLongPress={drag}
                    >
                      <View>
                        <Text style={styles.exerciseText}>{item.name}</Text>
                        <Text style={styles.exerciseSets}>{item.sets}</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconButton} onPress={() => openEditExerciseModal(item)} disabled={exerciseActionLoading === item.id}>
                      <FontAwesome name="pencil" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteExercise(item.id)} disabled={exerciseActionLoading === item.id}>
                      {exerciseActionLoading === item.id ? <ActivityIndicator size="small" color="#FF4500" /> : <FontAwesome name="trash" size={20} color="#FF4500" />}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Botão Flutuante (FAB) para ADICIONAR FICHA */}
      {!selectedRoutine && ( // Só mostra o FAB de Ficha se nenhuma ficha estiver selecionada
         <TouchableOpacity
            style={styles.fab}
            onPress={openAddRoutineModal}
          >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
     
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28, // Reduzido para caber
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16, // Reduzido
    color: '#B0B0B0',
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    flex: 1, 
  },
  cardSelected: {
    borderColor: '#007AFF', // Destaque azul
    backgroundColor: '#2A2A3A',
  },
  cardDragging: {
    opacity: 0.7,
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cardSubtext: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 5,
  },
  iconButton: {
    padding: 10, // Reduzido
    width: 50, // Reduzido
    alignItems: 'center'
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginVertical: 40,
    fontSize: 16,
  },
  // FAB (Botão de Adicionar Ficha)
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 30,
    color: 'white',
    lineHeight: 30, 
  },
  
  // Modais (Estilos genéricos)
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

  // --- Seção de Exercícios (Nova) ---
  exerciseSection: {
    marginTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#333',
    paddingTop: 10,
  },
  divider: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginRight: 8,
  },
  exerciseCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginHorizontal: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseCard: {
    flex: 1,
    padding: 20,
  },
  exerciseText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  exerciseSets: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
  },
});