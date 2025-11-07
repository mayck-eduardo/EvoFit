import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
// 1. IMPORTAR DraggableFlatList e writeBatch
import { FontAwesome } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number };
  order: number; // Campo de ordem é obrigatório
}

interface Log {
  id: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number };
}

const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const formatDate = (timestamp: { seconds: number }) => {
  return new Date(timestamp.seconds * 1000).toLocaleDateString('pt-BR');
};

export default function RoutineScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { id: routineId, name: routineName } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);

  // Estado para Edição
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Formulário de Exercício
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');

  // Formulário de Log
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [history, setHistory] = useState<Log[]>([]);

  // Loadings
  const [saveLoading, setSaveLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Efeito para Auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // Efeito para buscar Exercícios
  useEffect(() => {
    if (!user || !routineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');
    // 2. MUDAR A QUERY
    const q = query(exercisesCollection, orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId]);

  // Efeito para configurar o Título e o botão de Adicionar
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (routineName as string) || 'Gerenciar Exercícios',
      headerRight: () => (
        <TouchableOpacity onPress={openAddExerciseModal} style={{ marginRight: 15 }}>
          <FontAwesome name="plus" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, routineName]);

  // Funções para abrir modais (Adicionar vs Editar Exercício)
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

  // Salvar Exercício (Atualizado para Adicionar e Editar)
  const handleSaveExercise = async () => {
    if (!user || !routineId || !newExerciseName || !newExerciseSets) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }
    setSaveLoading(true);
    try {
      const exercisesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises');

      if (editingExercise) {
        // Modo Edição
        const exerciseRef = doc(db, exercisesCollection.path, editingExercise.id);
        await updateDoc(exerciseRef, {
          name: newExerciseName,
          sets: newExerciseSets,
        });
      } else {
        // Modo Adição
        // 3. MUDAR A CRIAÇÃO
        await addDoc(exercisesCollection, {
          name: newExerciseName,
          sets: newExerciseSets,
          createdAt: serverTimestamp(),
          order: exercises.length, // Adiciona o campo 'order'
        });
      }
      setExerciseModalVisible(false);
      setEditingExercise(null);
    } catch (error) {
      console.error('Erro ao salvar exercício: ', error);
      Alert.alert('Erro', 'Não foi possível salvar o exercício.');
    }
    setSaveLoading(false);
  };

  // Deletar Exercício
  const handleDeleteExercise = (exerciseId: string) => {
    if (!user || !routineId) return;
    Alert.alert(
      'Deletar Exercício',
      'Tem certeza? Todos os logs de progresso deste exercício serão apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(exerciseId);
            try {
              const exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId);
              
              const logsCollection = collection(exerciseRef, 'logs');
              const logsSnapshot = await getDocs(logsCollection);
              
              const batch = writeBatch(db);
              logsSnapshot.forEach(logDoc => {
                batch.delete(logDoc.ref);
              });
              batch.delete(exerciseRef);
              await batch.commit();
              
            } catch (error) {
              console.error('Erro ao deletar exercício: ', error);
              Alert.alert('Erro', 'Não foi possível deletar o exercício.');
            }
            setActionLoading(null);
          }
        }
      ]
    );
  };
  
  // Lógica do Check
  const handleToggleCheck = async (exercise: Exercise) => {
    if (!user || !routineId) return;
    const exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exercise.id);
    const completed = isToday(exercise.lastCompleted);
    
    setActionLoading(exercise.id);
    try {
      await updateDoc(exerciseRef, {
        lastCompleted: completed ? null : serverTimestamp() 
      });
    } catch (error) {
      console.error('Erro ao marcar exercício: ', error);
    }
    setActionLoading(null);
  };


  // --- LÓGICA DO MODAL DE LOG ---
  const openLogModal = async (exercise: Exercise) => {
    if (!user || !routineId) return;
    setCurrentExercise(exercise);
    setLogLoading(true);
    setLogModalVisible(true);
    
    const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exercise.id, 'logs');
    const q = query(logsCollection, orderBy('createdAt', 'desc'), limit(5));
    
    try {
      const snapshot = await getDocs(q);
      const logsData: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setHistory(logsData);
    } catch (error) {
      console.error('Erro ao buscar histórico: ', error);
      setHistory([]);
    }
    setLogLoading(false);
  };
  
  const handleSaveLog = async () => {
    if (!user || !routineId || !currentExercise || !weight || !reps) {
      Alert.alert('Erro', 'Preencha peso e repetições.');
      return;
    }
    setLogLoading(true);
    try {
      const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', currentExercise.id, 'logs');
      await addDoc(logsCollection, {
        weight: parseFloat(weight),
        reps: parseInt(reps, 10),
        createdAt: serverTimestamp()
      });
      
      setWeight('');
      setReps('');
      setLogModalVisible(false);
      Alert.alert('Sucesso!', 'Treino registrado.');
      
    } catch (error) {
      console.error('Erro ao salvar log: ', error);
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
    }
    setLogLoading(false);
  };

  // 6. ADICIONAR A FUNÇÃO DE DRAG END
  const handleDragEndExercises = async ({ data }: { data: Exercise[] }) => {
    if (!user || !routineId) return;
    setExercises(data); 
    const batch = writeBatch(db);
    const userId = user.uid;
    data.forEach((exercise, index) => {
      const exerciseRef = doc(db, 'artifacts', appId, 'users', userId, 'routines', routineId as string, 'exercises', exercise.id);
      batch.update(exerciseRef, { order: index });
    });
    try {
      await batch.commit();
    } catch (error) {
      console.error('Erro ao reordenar exercícios: ', error);
      Alert.alert('Erro', 'Não foi possível salvar a nova ordem.');
    }
  };
  
  // ----- RENDERIZAÇÃO -----

  if (loading) {
    return <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1, backgroundColor: '#121212' }} />;
  }

  // 4. TROCAR O <FlatList>
  const renderDraggableItem = ({ item, drag, isActive }: RenderItemParams<Exercise>) => {
    const completed = isToday(item.lastCompleted);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          completed && styles.cardCompleted,
          isActive && styles.cardDragging,
        ]}
        onLongPress={drag}
        disabled={isActive}
      >
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
          <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
        </View>
        
        {/* Botões de Ação (Check e Registrar) */}
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.checkButton} 
            onPress={() => handleToggleCheck(item)}
            disabled={actionLoading === item.id}
          >
            {actionLoading === item.id ? (
               <ActivityIndicator size="small" color={completed ? '#4CD964' : '#555'} />
            ) : (
               <FontAwesome 
                 name={completed ? 'check-circle' : 'circle-thin'} 
                 size={28} 
                 color={completed ? '#4CD964' : '#555'} 
               />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => openLogModal(item)}>
            <Text style={styles.buttonText}>Registrar</Text>
          </TouchableOpacity>
        </View>
        
        {/* Botões de Admin (Editar e Deletar) */}
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
      </TouchableOpacity>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: (routineName as string) || 'Gerenciar Exercícios' }} />
      
      {/* Modal de Adicionar/Editar Exercício */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={exerciseModalVisible}
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingExercise ? 'Editar Exercício' : 'Novo Exercício'}</Text>
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

      {/* Modal de Registrar Log */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={logModalVisible}
        onRequestClose={() => setLogModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentExercise?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder="Peso (kg)"
              placeholderTextColor="#777"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Repetições"
              placeholderTextColor="#777"
              value={reps}
              onChangeText={setReps}
              keyboardType="numeric"
            />
            {logLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setLogModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveLog}>
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.historyContainer}>
              <Text style={styles.historyTitle}>Últimos 5 Registros:</Text>
              {history.length === 0 && !logLoading && (
                <Text style={styles.historyEmpty}>Nenhum registro encontrado.</Text>
              )}
              {history.map(log => (
                <Text key={log.id} style={styles.historyItem}>
                  {formatDate(log.createdAt)}: {log.weight} kg x {log.reps} reps
                </Text>
              ))}
            </View>
            
            <Link 
              href={{ 
                pathname: `/charts/${currentExercise?.id}`, 
                params: { 
                  exerciseName: currentExercise?.name, 
                  routineId: routineId 
                } 
              }} 
              asChild
            >
              <Pressable onPress={() => setLogModalVisible(false)}>
                <Text style={styles.chartLink}>Ver Gráfico de Evolução →</Text>
              </Pressable>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. TROCAR <FlatList> por <DraggableFlatList> */}
      <DraggableFlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderDraggableItem} // Usa a nova função de render
        onDragEnd={handleDragEndExercises} // 5. ADICIONAR A PROP
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

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  // Estilos de Modal
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
  // Histórico no Modal
  historyContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 15,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  historyItem: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 5,
  },
  historyEmpty: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
  },
  chartLink: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600'
  },
  // Estilos de Card
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
  cardCompleted: {
    backgroundColor: '#2E3A2E', 
    borderColor: '#4CD964',
  },
  cardDragging: { // Estilo para quando está sendo arrastado
    opacity: 0.8,
    transform: [{ scale: 1.05 }],
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardSets: {
    fontSize: 16,
    color: '#B0B0B0',
    marginTop: 5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  checkButton: {
    paddingRight: 20, 
    width: 60, 
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1, 
    alignItems: 'center',
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