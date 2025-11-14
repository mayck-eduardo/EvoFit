// app/log-exercise/[exerciseId].tsx

import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
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
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';
import { calculateEpley1RM } from '../utils/formulas';

// Configuração do manipulador de Notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, 
    shouldSetBadge: false,
  }),
});

interface Log {
  id: string;
  weight: number;
  reps: number;
  note?: string; 
  createdAt: { seconds: number };
}

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

const groupLogsByDate = (logs: Log[]): GroupedLog[] => {
  const groups: { [key: string]: Log[] } = {};
  const todayStr = new Date().toDateString();

  logs.forEach(log => {
    if (!log.createdAt || typeof log.createdAt.seconds !== 'number') {
      return; 
    }
    const date = new Date(log.createdAt.seconds * 1000);
    const dateStr = date.toDateString();
    
    let dayLabel: string;
    if (dateStr === todayStr) {
      dayLabel = "Hoje";
    } else {
      dayLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    if (!groups[dayLabel]) {
      groups[dayLabel] = [];
    }
    groups[dayLabel].push(log);
  });
  
  return Object.keys(groups).map(day => ({
    title: day,
    data: groups[day]
  }));
};

export default function LogExerciseScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { exerciseId, exerciseName, routineId, exerciseSets } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [groupedLogs, setGroupedLogs] = useState<GroupedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false); 

  // Inputs
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState(''); 
  const repsInputRef = useRef<TextInput>(null); 
  const noteInputRef = useRef<TextInput>(null); 

  // Cronômetro
  const [timerDefault, setTimerDefault] = useState(90); 
  const [timeLeft, setTimeLeft] = useState(90);
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null); 
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Preferências
  const [notificationIds, setNotificationIds] = useState<string[]>([]); 
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [timerSound, setTimerSound] = useState(true);

  
  // --- Efeitos (useEffect) ---
  useEffect(() => {
    requestNotificationPermissions();
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadPreferences(); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const requestNotificationPermissions = async () => {
     const { status } = await Notifications.requestPermissionsAsync();
     if (status !== 'granted') {
       // Opcional: Avisar o usuário
     }
  };
  const loadPreferences = async () => {
    try {
      const savedTimer = await AsyncStorage.getItem('@EvoFit:timerDefault');
      const savedUnit = await AsyncStorage.getItem('@EvoFit:weightUnit');
      const savedSound = await AsyncStorage.getItem('@EvoFit:timerSound');
      
      if (savedTimer) {
        const numTimer = parseInt(savedTimer, 10);
        setTimerDefault(numTimer);
        setTimeLeft(numTimer);
      }
      if (savedUnit === 'kg' || savedUnit === 'lbs') {
        setWeightUnit(savedUnit);
      }
      if (savedSound) {
        setTimerSound(savedSound === 'true');
      }
    } catch (e) {
      console.error("Erro ao carregar prefs: ", e);
    }
  };

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
    const q = query(logsCollection, orderBy('createdAt', 'desc')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setGroupedLogs(groupLogsByDate(logsData));
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

  // EFEITO DO CRONÔMETRO (Preciso)
  useEffect(() => {
    if (isTimerActive && timerEndTime) {
      timerIntervalRef.current = setInterval(() => {
        const remainingMs = timerEndTime - Date.now(); 
        
        if (remainingMs <= 0) {
          setTimeLeft(0);
          setIsTimerActive(false);
          setTimerEndTime(null);
          // O alerta visual só toca se a notificação final (nativa) já tiver sido cancelada
          if (notificationIds.length === 0) { 
             playTimerAlert();
          }
        } else {
          setTimeLeft(Math.ceil(remainingMs / 1000));
        }
      }, 250);
    } 
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerActive, timerEndTime]); 

  // --- Funções do Cronômetro ---
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const playTimerAlert = async () => {
    try {
      if (timerSound) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
          const { sound } = await Audio.Sound.createAsync(
             require('../../assets/timer_complete.mp3') // <-- Verifique se este arquivo existe em /assets
          );
          await sound.playAsync();
        } catch (soundError) {
          console.log("Arquivo de som 'timer_complete.mp3' não encontrado. Usando vibração.");
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      Alert.alert("Descanso Concluído!", "Hora da próxima série.");
    } catch (e) {
      console.log("Erro ao tocar alerta: ", e);
      Alert.alert("Descanso Concluído!", "Hora da próxima série.");
    }
  };

  const startTimer = async () => {
    await stopTimer(); 
    
    const endTime = Date.now() + timerDefault * 1000; 
    setTimeLeft(timerDefault); 
    setTimerEndTime(endTime);  
    setIsTimerActive(true);    

    try {
      const ids: string[] = [];
      const intervals = [60, 30]; 
      
      for (const interval of intervals) {
        if (timerDefault > interval) {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: "EvoFit: Descanso",
              body: `${interval} segundos restantes...`,
              sound: null, 
              vibrate: [0, 100], 
            },
            trigger: { seconds: timerDefault - interval }, 
          });
          ids.push(id);
        }
      }

      const finalId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "EvoFit: Descanso Concluído!",
          body: `Hora de começar a próxima série de ${exerciseName}.`,
          sound: timerSound ? 'default' : null,
          vibrate: timerSound ? undefined : [0, 250, 250, 250],
        },
        trigger: { seconds: timerDefault },
      });
      ids.push(finalId);
      
      setNotificationIds(ids); 

    } catch (e) {
      console.error("Erro ao agendar notificação: ", e);
    }
  };

  const stopTimer = async () => {
    setIsTimerActive(false);
    setTimerEndTime(null);    
    setTimeLeft(timerDefault); 
    
    if (notificationIds.length > 0) {
      for (const id of notificationIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      setNotificationIds([]); 
    }
  };
  
  const addTime = (seconds: number) => {
    setTimerEndTime((prevEndTime) => (prevEndTime ? prevEndTime + seconds * 1000 : null));
    setTimeLeft((prevTime) => prevTime + seconds);
    // Nota: Isso não reagenda as notificações nativas, apenas o timer visual.
  };
  
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
    // O Pai (SafeAreaView) tem flex: 1 e NÃO tem 'edges' na parte de baixo
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen options={{ title: (exerciseName as string) || 'Registrar' }} />
      
      {/* O Filho 1 (ScrollView) NÃO tem flex: 1 */}
      <ScrollView 
        keyboardShouldPersistTaps="handled"
        // Adiciona um padding na parte de baixo igual à altura do timer
        contentContainerStyle={{ paddingBottom: 100 }} 
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Séries Programadas:</Text>
            <Text style={styles.infoText}>{exerciseSets}</Text>
            
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

          <View style={styles.logBox}>
            <TextInput
              style={styles.input}
              placeholder={`Peso (${weightUnit})`}
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
          
          <Text style={styles.historyTitle}>Histórico</Text>

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
                          <Text style={styles.logText}>{item.weight} {weightUnit}</Text>
                          <Text style={styles.logText}>x</Text>
                          <Text style={styles.logText}>{item.reps} reps</Text>
                          
                          {estimated1RM > 0 && (
                            <Text style={styles.log1RM}>(Est. {estimated1RM} {weightUnit})</Text>
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
          {/* Espaçador removido, pois usamos paddingBottom no ScrollView */}
        </KeyboardAvoidingView>
      </ScrollView>

      {/* O CRONÔMETRO (Filho 2) - Agora com 'position: absolute' */}
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

// Estilos
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
  historySubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B0B0B0',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logGroup: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 15,
    overflow: 'hidden', 
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
  
  // *** ESTILO DO TIMER CORRIGIDO (V5) ***
  timerContainer: {
    position: 'absolute', // <--- MUDANÇA
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    // Adiciona padding para a "barra de gestos" do iOS
    paddingBottom: Platform.OS === 'ios' ? 30 : 15, 
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