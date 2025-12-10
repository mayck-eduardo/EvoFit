import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteField,
  getDocs,
  query,
  writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

LocaleConfig.locales['br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'br';

interface Routine {
  id: string;
  name: string;
  lastFullyCompleted?: { seconds: number }; 
}
type MarkedDates = {
  [key: string]: {
    selected: boolean;
    marked: boolean;
    dotColor: string;
    selectedColor: string;
  };
};
interface Exercise {
  id: string;
  name: string;
  lastCompleted?: { seconds: number };
}
interface DailyHistoryItem {
  id: string;
  exerciseName: string;
  routineName: string;
}

const formatDate = (timestamp: { seconds: number }): string => {
  const date = new Date(timestamp.seconds * 1000);
  return date.toISOString().split('T')[0]; 
};

const formatDateDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export default function CalendarScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const [currentPlanId, setCurrentPlanId] = useState('default');

  const isFocused = useIsFocused();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user && isFocused) {
      fetchWorkoutDates();
    } else if (!user) {
      setLoading(false);
      setMarkedDates({}); 
    }
  }, [user, isFocused]);

  const fetchWorkoutDates = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const mode = await AsyncStorage.getItem('@EvoFit:completionMode') || 'any';
      
      // 1. Carrega o plano
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      const planId = savedPlan || 'default';
      setCurrentPlanId(planId);

      const userId = user.uid;
      const uniqueDates = new Set<string>();
      
      // 2. Define query baseada no plano
      let routinesQuery;
      if (planId === 'default') {
        routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'routines'));
      } else {
        routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'plans', planId, 'routines'));
      }

      const routinesSnapshot = await getDocs(routinesQuery);

      if (mode === 'any') {
        for (const routineDoc of routinesSnapshot.docs) {
          const exercisesQuery = query(collection(routineDoc.ref, 'exercises'));
          const exercisesSnapshot = await getDocs(exercisesQuery);
          exercisesSnapshot.forEach(doc => {
            const exercise = doc.data() as Exercise;
            if (exercise.lastCompleted) {
              uniqueDates.add(formatDate(exercise.lastCompleted));
            }
          });
        }
      } else {
        routinesSnapshot.forEach(doc => {
          const routine = doc.data() as Routine;
          if (routine.lastFullyCompleted) {
            uniqueDates.add(formatDate(routine.lastFullyCompleted));
          }
        });
      }

      const newMarkedDates: MarkedDates = {};
      uniqueDates.forEach(date => {
        newMarkedDates[date] = {
          selected: false,
          marked: true,
          dotColor: '#4CD964', 
          selectedColor: '#3A3A3A',
        };
      });
      setMarkedDates(newMarkedDates);
      
    } catch (error) {
      console.error("Erro ao buscar datas: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = async (day: DateData) => {
    const dateString = day.dateString;
    setSelectedDay(dateString);

    if (markedDates[dateString]) {
      await fetchDetailsForDate(dateString);
    } else {
      Alert.alert(
        "Sem Treino",
        `Nenhum treino registrado em ${formatDateDisplay(dateString)}.`,
        [{ text: "OK", onPress: () => setSelectedDay(null) }]
      );
    }
  };

  const fetchDetailsForDate = async (dateString: string) => {
    if (!user) return;
    setLoadingDetails(true);
    setDetailsModalVisible(true);
    
    const userId = user.uid;
    const historyItems: DailyHistoryItem[] = [];

    try {
      // 3. Usa o currentPlanId carregado no estado
      let routinesQuery;
      if (currentPlanId === 'default') {
        routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'routines'));
      } else {
        routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines'));
      }

      const routinesSnapshot = await getDocs(routinesQuery);

      for (const routineDoc of routinesSnapshot.docs) {
        const routineData = routineDoc.data() as Routine;
        const exercisesQuery = query(collection(routineDoc.ref, 'exercises'));
        const exercisesSnapshot = await getDocs(exercisesQuery);

        exercisesSnapshot.forEach(exDoc => {
          const exercise = exDoc.data() as Exercise;
          if (exercise.lastCompleted && formatDate(exercise.lastCompleted) === dateString) {
            historyItems.push({
              id: exDoc.id,
              exerciseName: exercise.name,
              routineName: routineData.name
            });
          }
        });
      }
      setDailyHistory(historyItems);
    } catch (error) {
      console.error("Erro ao buscar detalhes:", error);
      Alert.alert("Erro", "Não foi possível carregar os detalhes.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUnmarkDay = () => {
    if (!selectedDay) return;
    Alert.alert(
      "Apagar Registros",
      `Deseja remover todos os registros de conclusão do dia ${formatDateDisplay(selectedDay)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Apagar", 
          style: "destructive",
          onPress: async () => {
            await updateDayStatus(selectedDay, false);
            setDetailsModalVisible(false);
          }
        },
      ]
    );
  };

  const updateDayStatus = async (dateString: string, mark: boolean) => {
    if (!user) return;
    setLoading(true);
    const userId = user.uid;

    // 4. Usa o currentPlanId carregado no estado
    let routinesQuery;
    if (currentPlanId === 'default') {
      routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'routines'));
    } else {
      routinesQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines'));
    }

    try {
      if (!mark) { 
        const routinesSnapshot = await getDocs(routinesQuery);
        const batch = writeBatch(db);

        for (const routineDoc of routinesSnapshot.docs) {
          const routineData = routineDoc.data() as Routine;
          if (routineData.lastFullyCompleted && formatDate(routineData.lastFullyCompleted) === dateString) {
            batch.update(routineDoc.ref, { lastFullyCompleted: deleteField() });
          }

          const exercisesRef = collection(routineDoc.ref, 'exercises');
          const exercisesSnapshot = await getDocs(exercisesRef);

          for (const exerciseDoc of exercisesSnapshot.docs) {
            const lastCompleted = exerciseDoc.data().lastCompleted;
            if (lastCompleted && formatDate(lastCompleted) === dateString) {
              batch.update(exerciseDoc.ref, { lastCompleted: deleteField() });
            }
          }
        }
        
        await batch.commit();
        setMarkedDates(prev => {
          const newDates = { ...prev };
          delete newDates[dateString];
          return newDates;
        });
      }
      
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Não foi possível atualizar.");
    } finally {
      setLoading(false);
      setSelectedDay(null);
    }
  };


  if (loading && !detailsModalVisible) { 
    return (
       <SafeAreaView style={styles.container}>
         <ActivityIndicator size="large" color="#4CD964" style={{ flex: 1 }} />
       </SafeAreaView>
     );
  }
  if (!user) { 
    return (
       <SafeAreaView style={styles.container}>
         <View style={styles.content}>
           <Text style={styles.emptyText}>Faça login para ver seu calendário.</Text>
         </View>
       </SafeAreaView>
     );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailsModalVisible}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay ? formatDateDisplay(selectedDay) : 'Detalhes'}
            </Text>
            
            {loadingDetails ? (
              <ActivityIndicator size="large" color="#007AFF" style={{ margin: 20 }} />
            ) : (
              <FlatList
                data={dailyHistory}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300, width: '100%' }}
                renderItem={({ item }) => (
                  <View style={styles.historyItem}>
                    <View style={styles.historyDot} />
                    <View>
                      <Text style={styles.historyExercise}>{item.exerciseName}</Text>
                      <Text style={styles.historyRoutine}>{item.routineName}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Nenhum detalhe encontrado.</Text>
                }
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setDetailsModalVisible(false)}>
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.deleteButton} onPress={handleUnmarkDay}>
                <FontAwesome name="trash" size={20} color="#FF4500" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.subtitle}>Toque em um dia verde para ver o que foi treinado.</Text>
      </View>

      <View style={styles.calendarWrapper}>
        <Calendar
          current={new Date().toISOString().split('T')[0]}
          monthFormat={'MMMM yyyy'}
          onDayPress={handleDayPress} 
          markedDates={markedDates}
          key={isFocused.toString()} 
          theme={{
            calendarBackground: '#1E1E1E',
            textSectionTitleColor: '#B0B0B0',
            selectedDayBackgroundColor: '#4CD964',
            selectedDayTextColor: '#FFFFFF',
            todayTextColor: '#007AFF',
            dayTextColor: '#FFFFFF',
            textDisabledColor: '#3A3A3A',
            dotColor: '#4CD964',
            arrowColor: '#FFFFFF',
            monthTextColor: '#FFFFFF',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 16,
            textMonthFontSize: 20,
            textDayHeaderFontSize: 14,
          }}
          style={styles.calendar}
        />
      </View>

      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: '#4CD964' }]} />
        <Text style={styles.legendText}>Dia com Treino Concluído</Text>
      </View>

    </SafeAreaView>
  );
}

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
    paddingBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 10,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  calendarWrapper: {
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  calendar: {
    paddingBottom: 10,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    padding: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 14,
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
    padding: 20,
    width: '85%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#1E1E1E',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginRight: 15,
  },
  historyExercise: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  historyRoutine: {
    color: '#B0B0B0',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 15,
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 10,
  }
});