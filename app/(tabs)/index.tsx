// app/(tabs)/workout.tsx

import { FontAwesome } from '@expo/vector-icons';
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

import { Picker } from '@react-native-picker/picker';
import { Link, useNavigation } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
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

// --- Funções Helper ---
const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

// 1. NOVA FUNÇÃO HELPER (para a data no header)
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
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]); 
  const [exercises, setExercises] = useState<Exercise[]>([]); 
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); 
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- Efeitos (useEffect) ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // Efeito para o Header (AGORA É DINÂMICO)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      // 2. HEADER ATUALIZADO
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
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("order", "asc")); 

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
    const q = query(exercisesCollection, orderBy("order", "asc")); 
    
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
  
  // --- Funções de Cálculo (para UI) ---
  // 3. NOVAS FUNÇÕES DE CÁLCULO DE PROGRESSO
  const completedCount = exercises.filter(ex => isToday(ex.lastCompleted)).length;
  const totalCount = exercises.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  
  // --- Renderização ---
  if (initialLoading) {
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
          <Text style={styles.emptyText}>Faça login na aba "Config." para começar.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
                // 4. CORREÇÃO da cor do item no Android
                color={Platform.OS === 'android' ? '#000000ff' : '#ffffffff'}
              />
            ))}
          </Picker>
        </View>
      )}

      {/* 5. NOVA BARRA DE PROGRESSO */}
      {totalCount > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Progresso: {completedCount} / {totalCount}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}


      {/* Lista de Exercícios (FlatList) ATUALIZADA */}
      {loadingExercises ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const completed = isToday(item.lastCompleted);
            
            return (
              // 6. LAYOUT DO CARD ATUALIZADO
              // O card principal agora é uma View normal
              <View style={[styles.card, completed && styles.cardCompleted]}>
                
                {/* Botão de Check (separado) */}
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

                {/* O Link agora envolve apenas o conteúdo clicável */}
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
                  <TouchableOpacity style={styles.cardContent}>
                    {/* Conteúdo do Card */}
                    <View style={styles.cardTextContainer}>
                      <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
                      <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
                    </View>
                    
                    {/* Chevron (seta) para indicar navegação */}
                    <FontAwesome name="angle-right" size={24} color="#555" />
                  </TouchableOpacity>
                </Link>
              </View>
            );
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

// 7. ESTILOS ATUALIZADOS
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
  
  // Estilos de Header (NOVOS)
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B0B0B0',
  },

  // Estilos da Tela Logada
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
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

  // Barra de Progresso (NOVOS)
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  progressLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },

  // Estilos de Card (ATUALIZADOS)
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row', // Mudança Principal
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardCompleted: {
    backgroundColor: '#2E3A2E', 
    borderColor: '#4CD964',
  },
  // Botão de Check agora é separado
  checkButton: {
    padding: 20, // Área de toque
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  // Conteúdo clicável (para navegar)
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  cardTextContainer: {
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
});