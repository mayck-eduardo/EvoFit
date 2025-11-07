import { FontAwesome } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Link, useNavigation } from 'expo-router';
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
  updateDoc
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

// --- Interfaces ---
export interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}
interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number }; 
}
interface Log {
  id: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number };
}

// --- Funções Helper ---
const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};
const formatDate = (timestamp: { seconds: number }) => {
  return new Date(timestamp.seconds * 1000).toLocaleDateString('pt-BR');
};


export default function WorkoutScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]); 
  const [exercises, setExercises] = useState<Exercise[]>([]); 
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); 
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estados do Modal de Log
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [history, setHistory] = useState<Log[]>([]);
  const [logLoading, setLogLoading] = useState(false);


  // --- Efeitos (useEffect) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // Efeito para o Header (REMOVIDO o botão de Logout)
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Treino do Dia',
      headerTitleStyle: { fontSize: 30 },
      headerStyle: { backgroundColor: '#1E1E1E' },
      headerTintColor: '#FFFFFF',
      headerRight: () => null, // Botão de Logout removido
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
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData: Routine[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      
      if (!selectedRoutineId && routinesData.length > 0) {
        setSelectedRoutineId(routinesData[0].id);
      }
      setLoadingRoutines(false);
    }, (error) => {
      console.error("Erro ao buscar fichas: ", error);
      setLoadingRoutines(false);
    });
    return () => unsubscribe(); 
  }, [user]); 

  useEffect(() => {
    if (!user || !selectedRoutineId) {
      setExercises([]);
      setLoadingExercises(false);
      return;
    }
    
    setLoadingExercises(true);
    const userId = user.uid;
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines', selectedRoutineId, 'exercises');
    const q = query(exercisesCollection, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoadingExercises(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      Alert.alert("Erro", "Não foi possível carregar os exercícios.");
      setLoadingExercises(false);
    });

    return () => unsubscribe(); 
  }, [user, selectedRoutineId]); 

  // --- Funções de Ação ---
  
  // handleLogout foi REMOVIDO
  // handleAuth foi REMOVIDO (movido para settings.tsx)

  const handleToggleCheck = async (exercise: Exercise) => {
    if (!user || !selectedRoutineId) return;

    const exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId, 'exercises', exercise.id);
    const completed = isToday(exercise.lastCompleted);
    
    setActionLoading(exercise.id);
    try {
      await updateDoc(exerciseRef, {
        lastCompleted: completed ? null : serverTimestamp() 
      });
    } catch (error) {
      console.error("Erro ao marcar exercício: ", error);
      Alert.alert("Erro", "Não foi possível atualizar o exercício.");
    }
    setActionLoading(null);
  };

  const openLogModal = async (exercise: Exercise) => {
    if (!user || !selectedRoutineId) return;
    setCurrentExercise(exercise);
    setLogLoading(true);
    setLogModalVisible(true);
    
    const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId as string, 'exercises', exercise.id, 'logs');
    const q = query(logsCollection, orderBy('createdAt', 'desc'), limit(5));
    
    try {
      const snapshot = await getDocs(q);
      const logsData: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setHistory(logsData);
    } catch (error) {
      console.error("Erro ao buscar histórico: ", error);
      setHistory([]);
    }
    setLogLoading(false);
  };
  
  const handleSaveLog = async () => {
    if (!user || !selectedRoutineId || !currentExercise || !weight || !reps) {
      Alert.alert("Erro", "Preencha peso e repetições.");
      return;
    }
    setLogLoading(true);
    try {
      const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId as string, 'exercises', currentExercise.id, 'logs');
      await addDoc(logsCollection, {
        weight: parseFloat(weight),
        reps: parseInt(reps, 10),
        createdAt: serverTimestamp()
      });
      
      setWeight('');
      setReps('');
      setLogModalVisible(false);
      Alert.alert("Sucesso!", "Treino registrado.");
      
    } catch (error) {
      console.error("Erro ao salvar log: ", error);
      Alert.alert("Erro", "Não foi possível salvar o registro.");
    }
    setLogLoading(false);
  };

  
  // --- Renderização ---
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // TELA DE LOGIN (agora está na tela de Configurações)
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Faça login na aba "Config." para começar.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // TELA PRINCIPAL (LOGADO)
  return (
    <SafeAreaView style={styles.container}>
      {/* Modal de Log */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={logModalVisible}
        onRequestClose={() => setLogModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                  routineId: selectedRoutineId 
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

      {/* Header (Título e Picker) */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>Selecione uma ficha para o treino de hoje:</Text>
      </View>

      {loadingRoutines ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedRoutineId}
            onValueChange={(itemValue) => setSelectedRoutineId(itemValue)}
            style={styles.picker}
            dropdownIconColor="#FFFFFF"
          >
            {routines.map((routine) => (
              <Picker.Item 
                key={routine.id} 
                label={routine.name} 
                value={routine.id} 
                color={Platform.OS === 'android' ? '#797979ff' : '#000000ff'}
              />
            ))}
          </Picker>
        </View>
      )}

      {/* Lista de Exercícios */}
      {loadingExercises ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 2 }}/>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const completed = isToday(item.lastCompleted);
            return (
              <View style={[styles.card, completed && styles.cardCompleted]}>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
                  <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
                </View>
                
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.checkButton} 
                    onPress={() => handleToggleCheck(item)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <ActivityIndicator size="small" color={completed ? "#4CD964" : "#555"} />
                    ) : (
                      <FontAwesome 
                        name={completed ? "check-circle" : "circle-thin"} 
                        size={28} 
                        color={completed ? "#4CD964" : "#555"} 
                      />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.registerButton} onPress={() => openLogModal(item)}>
                    <FontAwesome name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.registerButtonText}>Registrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {loadingRoutines ? "" : "Nenhum exercício encontrado nesta ficha."}
            </Text>
          }
        />
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
  // Estilos de Login (movidos para cá)
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 18,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  inputPassword: {
    flex: 1,
    color: '#FFFFFF',
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  buttonAuth: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleAuth: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleAuthText: {
    color: '#007AFF',
    fontSize: 16,
  },

  // Estilos da Tela Logada
  header: {
    paddingHorizontal: 20,
    paddingTop: 1,
    paddingBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#B0B0B0',
  },
  pickerContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF', 
    height: 60,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardCompleted: {
    backgroundColor: '#2E3A2E', 
    borderColor: '#4CD964',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSets: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#555',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
  },
  checkButton: {
    width: 60, 
    alignItems: 'center',
    paddingRight: 20,
  },
  registerButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Estilos do Modal
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
  cancelText: {
    color: '#FF4500',
    fontSize: 16,
  },
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
});
