// app/log-exercise/[exerciseId].tsx

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable // Importar Pressable
  ,

  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
// 1. Importar Link
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';
import { calculateEpley1RM } from '../utils/formulas';

interface Log {
  id: string;
  weight: number;
  reps: number;
  note?: string; 
  createdAt: { seconds: number };
}

// 2. NOVO TIPO DE DADO para o histórico agrupado
interface GroupedLog {
  title: string;
  data: Log[];
}

// --- Funções Helper ---

const formatDate = (timestamp: { seconds: number } | undefined | null) => {
  if (!timestamp || typeof timestamp.seconds !== 'number') {
    return '...'; 
  }
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// 3. NOVA FUNÇÃO para agrupar logs por dia
const groupLogsByDate = (logs: Log[]): GroupedLog[] => {
  const groups: { [key: string]: Log[] } = {};
  const todayStr = new Date().toDateString();

  logs.forEach(log => {
    const date = new Date(log.createdAt.seconds * 1000);
    const dateStr = date.toDateString();
    
    let dayLabel: string;
    if (dateStr === todayStr) {
      dayLabel = "Hoje";
    } else {
      // Formata como DD/MM/YYYY
      dayLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    if (!groups[dayLabel]) {
      groups[dayLabel] = [];
    }
    groups[dayLabel].push(log);
  });
  
  // Converte o objeto em um array ordenado
  return Object.keys(groups).map(day => ({
    title: day,
    data: groups[day] // Os dados já estão em ordem (desc) do Firestore
  }));
};

export default function LogExerciseScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { exerciseId, exerciseName, routineId, exerciseSets } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  
  // 4. NOVO ESTADO para os logs agrupados
  const [groupedLogs, setGroupedLogs] = useState<GroupedLog[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false); 

  // Estados dos Inputs
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState(''); 
  const repsInputRef = useRef<TextInput>(null); 
  const noteInputRef = useRef<TextInput>(null); 

  // Estados do Cronômetro
  const [timerDefault, setTimerDefault] = useState(90); 
  const [timeLeft, setTimeLeft] = useState(90);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ... (useEffect de Auth e loadTimerPreference não mudam) ...
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadTimerPreference();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const loadTimerPreference = async () => {
    try {
      const savedTimer = await AsyncStorage.getItem('@EvoFit:timerDefault');
      if (savedTimer) {
        const numTimer = parseInt(savedTimer, 10);
        setTimerDefault(numTimer);
        setTimeLeft(numTimer);
      }
    } catch (e) {
      console.error("Erro ao carregar timer pref: ", e);
    }
  };

  // Efeito para Título da Página
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (exerciseName as string) || "Registrar Treino",
    });
  }, [navigation, exerciseName]);

  // Efeito para buscar os logs
  useEffect(() => {
    if (!user || !routineId || !exerciseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId as string, 'logs');
    const q = query(logsCollection, orderBy('createdAt', 'desc')); // Pega os mais novos primeiro

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      
      // 5. ATUALIZA o estado com os logs agrupados
      setGroupedLogs(groupLogsByDate(logsData));

      // Preenche os inputs com o último treino (se existir)
      if (logsData.length > 0 && weight === '' && reps === '' && logsData[0].weight != null && logsData[0].reps != null) {
        setWeight(logsData[0].weight.toString());
        setReps(logsData[0].reps.toString());
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar logs: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId, exerciseId]);

  // ... (useEffect do Cronômetro e funções do timer não mudam) ...
  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } 
    else if (isTimerActive && timeLeft === 0) {
      setIsTimerActive(false);
      Alert.alert("Descanso Concluído!", "Hora da próxima série.");
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timeLeft]); 
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  const startTimer = () => {
    setTimeLeft(timerDefault); 
    setIsTimerActive(true);
  };
  const stopTimer = () => {
    setIsTimerActive(false);
    setTimeLeft(timerDefault); 
  };
  const addTime = (seconds: number) => {
    setTimeLeft((prevTime) => prevTime + seconds);
  };
  
  // ... (handleSaveLog e handleDeleteLog não mudam) ...
  const handleSaveLog = async () => {
    if (!user || !routineId || !exerciseId || !weight || !reps) {
      Alert.alert("Erro", "Preencha peso e repetições.");
      return;
    }
    setLogLoading(true);
    try {
      const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId as string, 'logs');
      
      await addDoc(logsCollection, {
        weight: parseFloat(weight),
        reps: parseInt(reps, 10),
        createdAt: serverTimestamp(),
        note: note 
      });
      
      setNote(''); 
      repsInputRef.current?.focus();
      
      startTimer(); 

    } catch (error) {
      console.error("Erro ao salvar log: ", error);
      Alert.alert("Erro", "Não foi possível salvar o registro.");
    }
    setLogLoading(false);
  };

  const handleDeleteLog = (logId: string) => {
    if (!user || !routineId || !exerciseId) return;
    
    Alert.alert(
      "Apagar Registro",
      "Tem certeza que deseja apagar esta série?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Apagar", 
          style: "destructive",
          onPress: async () => {
            try {
              const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId as string, 'logs', logId);
              await deleteDoc(logRef);
            } catch (error) {
              console.error("Erro ao apagar log: ", error);
              Alert.alert("Erro", "Não foi possível apagar o registro.");
            }
          }
        }
      ]
    );
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen options={{ title: (exerciseName as string) || 'Registrar' }} />
      
      <ScrollView 
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Informações do Exercício (COM LINK DO GRÁFICO) */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Séries Programadas:</Text>
            <Text style={styles.infoText}>{exerciseSets}</Text>
            
            {/* 6. LINK DO GRÁFICO ADICIONADO DE VOLTA */}
            <Link 
              href={{ 
                pathname: `/charts/${exerciseId}`, 
                params: { 
                  exerciseName: exerciseName, 
                  routineId: routineId 
                } 
              }} 
              asChild
            >
              <Pressable>
                <Text style={styles.chartLink}>Ver Gráfico de Evolução →</Text>
              </Pressable>
            </Link>
          </View>

          {/* Inputs de Registro */}
          <View style={styles.logBox}>
            <TextInput
              style={styles.input}
              placeholder="Peso (kg)"
              placeholderTextColor="#777"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              returnKeyType="next" 
              onSubmitEditing={() => repsInputRef.current?.focus()} 
            />
            <TextInput
              ref={repsInputRef} 
              style={styles.input}
              placeholder="Reps"
              placeholderTextColor="#777"
              value={reps}
              onChangeText={setReps}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => noteInputRef.current?.focus()} 
            />
            
            <TextInput
              ref={noteInputRef}
              style={styles.inputNote}
              placeholder="Adicionar nota (opcional)..."
              placeholderTextColor="#777"
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              onSubmitEditing={handleSaveLog}
            />

            <TouchableOpacity 
              style={[styles.button, logLoading && styles.buttonDisabled]} 
              onPress={handleSaveLog}
              disabled={logLoading}
            >
              {logLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Salvar Série</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Título do Histórico */}
          <Text style={styles.historyTitle}>Histórico</Text>

          {/* 7. LÓGICA DE RENDERIZAÇÃO ATUALIZADA (AGRUPADA) */}
          {groupedLogs.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma série registrada.</Text>
          ) : (
            <View>
              {groupedLogs.map(group => (
                <View key={group.title} style={styles.logGroup}>
                  <Text style={styles.historySubtitle}>{group.title}</Text>
                  {group.data.map((item, index) => {
                    const estimated1RM = calculateEpley1RM(item.weight, item.reps);
                    return (
                      <React.Fragment key={item.id}>
                        <View style={styles.logItem}>
                          <Text style={styles.logIndex}>Série {group.data.length - index}</Text>
                          <Text style={styles.logText}>{item.weight} kg</Text>
                          <Text style={styles.logText}>x</Text>
                          <Text style={styles.logText}>{item.reps} reps</Text>
                          
                          {estimated1RM > 0 && (
                            <Text style={styles.log1RM}>(Est. {estimated1RM} kg)</Text>
                          )}

                          <Text style={styles.logTime}>{formatDate(item.createdAt)}</Text>
                          <TouchableOpacity onPress={() => handleDeleteLog(item.id)} style={styles.deleteButton}>
                            <FontAwesome name="trash-o" size={20} color="#FF4500" />
                          </TouchableOpacity>
                        </View>
                        
                        {item.note && (
                          <View style={styles.logNoteContainer}>
                            <FontAwesome name="comment-o" size={14} color="#B0B0B0" style={{ marginRight: 8 }} />
                            <Text style={styles.logNote}>{item.note}</Text>
                          </View>
                        )}
                      </React.Fragment>
                    )
                  })}
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 50 }} /> 
        </KeyboardAvoidingView>
      </ScrollView>

      {/* O CRONÔMETRO FLUTUANTE */}
      {isTimerActive && (
        <View style={styles.timerContainer}>
          <View>
            <Text style={styles.timerTextLabel}>Descanso:</Text>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
          <View style={styles.timerButtons}>
            <TouchableOpacity style={styles.timerButton} onPress={() => addTime(15)}>
              <Text style={styles.timerButtonText}>+15s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timerButton, styles.timerButtonStop]} onPress={stopTimer}>
              <Text style={styles.timerButtonText}>Parar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

// 8. Estilos ATUALIZADOS
const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#121212',
  },
  infoBox: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 5,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },
  chartLink: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333'
  },
  logBox: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  input: {
    backgroundColor: '#333',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    fontSize: 18,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#555',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 30,
    marginLeft: 20,
    marginBottom: 10,
  },
  // NOVO Estilo para subtítulo de data
  historySubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0B0B0',
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 10,
  },
  logGroup: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 15,
    overflow: 'hidden', // Para os cantos
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexWrap: 'wrap', 
  },
  logIndex: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    width: 70, 
  },
  logText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginHorizontal: 5,
  },
  log1RM: {
    color: '#007AFF', 
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  logTime: {
    color: '#B0B0B0',
    fontSize: 14,
    marginLeft: 'auto', 
    marginRight: 10,
  },
  deleteButton: {
    padding: 5,
  },
  inputNote: {
    backgroundColor: '#333',
    color: '#FFFFFF',
    padding: 10, 
    borderRadius: 8,
    fontSize: 15, 
    marginBottom: 12,
  },
  logNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E', 
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingLeft: 30, 
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logNote: {
    flex: 1, 
    color: '#B0B0B0',
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Estilos do Cronômetro (sem mudança)
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  timerTextLabel: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  timerButtons: {
    flexDirection: 'row',
  },
  timerButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  timerButtonStop: {
    backgroundColor: '#FF4500', 
  },
  timerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
