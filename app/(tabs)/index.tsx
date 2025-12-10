import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
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
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm'; // 1. Importa o componente de Login
import { appId, auth, db } from '../../firebaseConfig';

// --- Interfaces ---
export interface Routine {
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

// --- Funções Helper ---
const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getTodayDate = () => {
  const date = new Date();
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};


export default function WorkoutScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); 

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

  // --- Efeitos (useEffect) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);
  
  // Recarrega prefs sempre que a tela ganha foco
  useEffect(() => {
    if (isFocused) {
      loadPreferences();
    }
  }, [user, isFocused]);

  const loadPreferences = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('@EvoFit:completionMode');
      if (savedMode === 'full' || savedMode === 'any') setCompletionMode(savedMode);
      
      const savedSimple = await AsyncStorage.getItem('@EvoFit:simpleMode');
      // Converte explicitamente para booleano
      setSimpleMode(savedSimple === 'true');
      
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      setCurrentPlanId(savedPlan || 'default');

    } catch (e) {
      console.error("Erro ao carregar prefs: ", e);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !!user, // Esconde o header se não estiver logado
      headerTitle: () => (
        <View>
          <Text style={styles.headerTitle}>Bom treino!</Text>
          <Text style={styles.headerSubtitle}>{getTodayDate()}</Text>
        </View>
      ),
      headerStyle: { backgroundColor: '#1E1E1E', height: 110 },
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
    
    let routinesPath;
    if (currentPlanId === 'default') {
      routinesPath = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    } else {
      routinesPath = collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines');
    }

    const q = query(routinesPath, orderBy("order", "asc")); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData: Routine[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      
      if (routinesData.length > 0) {
        const exists = routinesData.find(r => r.id === selectedRoutineId);
        if (!selectedRoutineId || !exists) {
             setSelectedRoutineId(routinesData[0].id);
        }
      } else {
        setSelectedRoutineId(null);
      }
      setLoadingRoutines(false);
    }, (error) => {
      console.error("Erro ao buscar fichas: ", error);
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
    
    let exercisesCollection;
    if (currentPlanId === 'default') {
       exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines', selectedRoutineId, 'exercises');
    } else {
       exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines', selectedRoutineId, 'exercises');
    }

    const q = query(exercisesCollection, orderBy("order", "asc")); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoadingExercises(false);
      
      checkAndUpdateRoutineCompletion(exercisesData); 
      
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoadingExercises(false);
    });

    return () => unsubscribe(); 
  }, [user, selectedRoutineId, currentPlanId]); 

  // --- Funções de Ação ---
  
  const checkAndUpdateRoutineCompletion = async (currentExercises: Exercise[]) => {
    if (!user || !selectedRoutineId || completionMode !== 'full') return;
    
    const totalCount = currentExercises.length;
    const completedCount = currentExercises.filter(ex => isToday(ex.lastCompleted)).length;
    
    if (totalCount === 0) return;

    try {
      let routineRef;
      if (currentPlanId === 'default') {
         routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId);
      } else {
         routineRef = doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', selectedRoutineId);
      }

      if (completedCount === totalCount) {
        await updateDoc(routineRef, { lastFullyCompleted: serverTimestamp() });
      } else {
        await updateDoc(routineRef, { lastFullyCompleted: deleteField() });
      }
    } catch (error) {
      console.error("Erro ao atualizar status: ", error);
    }
  };
  
  const handleToggleCheck = async (exercise: Exercise) => {
    if (!user || !selectedRoutineId) return;

    let exerciseRef;
    if (currentPlanId === 'default') {
       exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', selectedRoutineId, 'exercises', exercise.id);
    } else {
       exerciseRef = doc(db, 'artifacts', appId, 'users', user.uid, 'plans', currentPlanId, 'routines', selectedRoutineId, 'exercises', exercise.id);
    }

    const completed = isToday(exercise.lastCompleted);
    
    setActionLoading(exercise.id);
    try {
      await updateDoc(exerciseRef, {
        lastCompleted: completed ? null : serverTimestamp() 
      });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível atualizar.");
    }
    setActionLoading(null);
  };
  
  const completedCount = exercises.filter(ex => isToday(ex.lastCompleted)).length;
  const totalCount = exercises.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // 2. SE NÃO ESTIVER LOGADO, MOSTRA O AUTHFORM
  if (!user) {
    return (
      // Não usamos SafeAreaView aqui pois o AuthForm já cuida disso ou pode ser centralizado
      <View style={styles.container}>
        <AuthForm />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Selecione uma ficha ({currentPlanId === 'default' ? 'Padrão' : 'Personalizado'}):</Text>
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
                color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'}
              />
            ))}
          </Picker>
        </View>
      )}

      {totalCount > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Progresso: {completedCount} / {totalCount}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {loadingExercises ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const completed = isToday(item.lastCompleted);
            
            // Conteúdo do Card
            const CardContent = (
               <View style={[styles.card, completed && styles.cardCompleted]}>
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

                  <View style={styles.cardContent}>
                    <View style={styles.cardTextContainer}>
                      <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
                      <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
                    </View>
                    {/* Esconde seta se modo simples ativo */}
                    {!simpleMode && <FontAwesome name="angle-right" size={24} color="#555" />}
                  </View>
                </View>
            );

            // 3. LÓGICA DE NAVEGAÇÃO CORRIGIDA
            if (simpleMode) {
              return (
                <TouchableOpacity activeOpacity={1}>
                  {CardContent}
                </TouchableOpacity>
              );
            } else {
              return (
                <Link 
                  href={{ 
                    pathname: `/log-exercise/${item.id}`, 
                    params: { 
                      exerciseName: item.name, 
                      routineId: selectedRoutineId,
                      exerciseSets: item.sets
                    } 
                  }}
                  asChild
                >
                  <TouchableOpacity>
                     {CardContent}
                  </TouchableOpacity>
                </Link>
              );
            }
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 14, color: '#B0B0B0' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
  subtitle: { fontSize: 18, color: '#B0B0B0' },
  pickerContainer: { backgroundColor: '#1E1E1E', borderRadius: 8, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  picker: { color: '#FFFFFF', height: 60 },
  progressContainer: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  progressLabel: { color: '#B0B0B0', fontSize: 14, marginBottom: 8 },
  progressBarBackground: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#007AFF', borderRadius: 4 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  cardCompleted: { backgroundColor: '#2E3A2E', borderColor: '#4CD964' },
  checkButton: { padding: 20, borderRightWidth: 1, borderRightColor: '#333' },
  cardContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '500', color: '#FFFFFF', marginBottom: 4 },
  cardSets: { fontSize: 16, color: '#B0B0B0' },
  completedText: { textDecorationLine: 'line-through', color: '#555' },
  emptyText: { color: '#B0B0B0', textAlign: 'center', marginTop: 50, fontSize: 16 },
});