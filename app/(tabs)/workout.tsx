import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, query, getDocs, orderBy } from 'firebase/firestore'; 
import { db, auth, appId } from '../../firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Picker } from '@react-native-picker/picker';
import { FontAwesome } from '@expo/vector-icons'; // 1. Importar ícones

export interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}
// 2. Adicionar 'lastCompleted'
interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number }; 
}

// 3. Função para verificar se é hoje
const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export default function WorkoutScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]); 
  const [exercises, setExercises] = useState<Exercise[]>([]); 
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setRoutines([]);
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

  // useEffect de buscar exercícios (agora usa onSnapshot)
  useEffect(() => {
    if (!user || !selectedRoutineId) {
      setExercises([]);
      return;
    }
    
    setLoadingExercises(true);
    const userId = user.uid;
    const exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines', selectedRoutineId, 'exercises');
    const q = query(exercisesCollection, orderBy("createdAt", "asc"));
    
    // 4. Mudar para onSnapshot para ver o "check" em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoadingExercises(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      Alert.alert("Erro", "Não foi possível carregar os exercícios.");
      setLoadingExercises(false);
    });

    return () => unsubscribe(); // Limpa o ouvinte
  }, [user, selectedRoutineId]); 

  
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
          <Text style={styles.emptyText}>Faça login na aba "Fichas" para ver seus treinos.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Treino do Dia</Text>
        <Text style={styles.subtitle}>Selecione uma ficha para ver os exercícios</Text>
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
                color="#000000" // Cor do texto no dropdown (iOS)
              />
            ))}
          </Picker>
        </View>
      )}

      {loadingExercises ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // 5. Verificar se está completo
            const completed = isToday(item.lastCompleted);
            return (
              <View style={[styles.card, completed && styles.cardCompleted]}>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
                  <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
                </View>
                {/* 6. Mostrar o ícone de check */}
                {completed && (
                  <FontAwesome name="check-circle" size={24} color="#4CD964" />
                )}
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
  header: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
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
  },
  picker: {
    color: '#FFFFFF', // Cor do texto (Android)
    height: 60,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row', // Para alinhar o check
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // 7. Novos estilos
  cardCompleted: {
    backgroundColor: '#181818', 
    borderColor: '#222',
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
});