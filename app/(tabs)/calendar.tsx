// app/(tabs)/calendar.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native'; // Importar useIsFocused
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteField,
  getDocs,
  query,
  writeBatch // Importar writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

// Configuração de localização
LocaleConfig.locales['br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'br';

// Interfaces
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
const formatDate = (timestamp: { seconds: number }): string => {
  const date = new Date(timestamp.seconds * 1000);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

export default function CalendarScreen() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  
  const isFocused = useIsFocused(); // Hook para saber se a aba está em foco

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  // Efeito para buscar as datas
  useEffect(() => {
    // Só busca se o usuário estiver logado E a tela estiver em foco
    if (user && isFocused) {
      fetchWorkoutDates();
    } else if (!user) {
      // Limpa as datas se o usuário deslogar
      setLoading(false);
      setMarkedDates({}); 
    }
  }, [user, isFocused]); // Depende do foco da tela

  // LÓGICA DE BUSCA ATUALIZADA
  const fetchWorkoutDates = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // 1. Lê a preferência do usuário
      const mode = await AsyncStorage.getItem('@EvoFit:completionMode') || 'any';
      const userId = user.uid;
      const uniqueDates = new Set<string>();
      
      const routinesQuery = query(
        collection(db, 'artifacts', appId, 'users', userId, 'routines')
      );
      const routinesSnapshot = await getDocs(routinesQuery);

      if (mode === 'any') {
        // Lógica Antiga (Modo "Qualquer"): Checa todos os exercícios
        for (const routineDoc of routinesSnapshot.docs) {
          const exercisesQuery = query(
            collection(routineDoc.ref, 'exercises')
          );
          const exercisesSnapshot = await getDocs(exercisesQuery);
          exercisesSnapshot.forEach(doc => {
            const exercise = doc.data() as Exercise;
            if (exercise.lastCompleted) {
              uniqueDates.add(formatDate(exercise.lastCompleted));
            }
          });
        }
      } else {
        // Lógica Nova (Modo "Completo"): Checa apenas o campo da ficha
        routinesSnapshot.forEach(doc => {
          const routine = doc.data() as Routine;
          if (routine.lastFullyCompleted) {
            uniqueDates.add(formatDate(routine.lastFullyCompleted));
          }
        });
      }

      // Formatar para o estado do calendário
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
      console.error("Erro ao buscar datas de treino: ", error);
      Alert.alert("Erro", "Não foi possível carregar as datas de treino.");
    } finally {
      setLoading(false);
    }
  };

  // Handler para Marcar/Desmarcar
  const handleDayPress = async (day: DateData) => {
    const dateString = day.dateString;
    setSelectedDay(dateString);

    const isCurrentlyMarked = !!markedDates[dateString];

    if (isCurrentlyMarked) {
      Alert.alert(
        "Desmarcar Treino",
        `Deseja remover o(s) registro(s) de treino para ${dateString}?`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => setSelectedDay(null) },
          { text: "Remover", style: "destructive", onPress: () => updateDayStatus(dateString, false) },
        ]
      );
    } else {
      Alert.alert(
        "Marcar Treino",
        `Para marcar um treino, vá à aba "Treino do Dia" e complete os exercícios.`,
        [{ text: "OK", onPress: () => setSelectedDay(null) }]
      );
    }
  };

  // LÓGICA DE DESMARCAR ATUALIZADA
  const updateDayStatus = async (dateString: string, mark: boolean) => {
    if (!user) return;
    setLoading(true);
    const userId = user.uid;

    const routinesQuery = query(
      collection(db, 'artifacts', appId, 'users', userId, 'routines')
    );

    try {
      if (!mark) { // DESMARCAR
        const routinesSnapshot = await getDocs(routinesQuery);
        const batch = writeBatch(db); // Usamos um batch

        for (const routineDoc of routinesSnapshot.docs) {
          // Limpa o 'lastFullyCompleted' da ficha
          const routineData = routineDoc.data() as Routine;
          if (routineData.lastFullyCompleted && formatDate(routineData.lastFullyCompleted) === dateString) {
            batch.update(routineDoc.ref, { lastFullyCompleted: deleteField() });
          }

          // Limpa o 'lastCompleted' dos exercícios
          const exercisesRef = collection(routineDoc.ref, 'exercises');
          const exercisesSnapshot = await getDocs(exercisesRef);

          for (const exerciseDoc of exercisesSnapshot.docs) {
            const lastCompleted = exerciseDoc.data().lastCompleted;
            if (lastCompleted && formatDate(lastCompleted) === dateString) {
              batch.update(exerciseDoc.ref, { lastCompleted: deleteField() });
            }
          }
        }
        
        await batch.commit(); // Executa todas as exclusões

        // Remove do estado local
        setMarkedDates(prev => {
          const newDates = { ...prev };
          delete newDates[dateString];
          return newDates;
        });
        Alert.alert("Sucesso", `Registros de ${dateString} removidos.`);
      }
      
    } catch (e) {
      console.error(e);
      Alert.alert("Erro de escrita", "Não foi possível atualizar a data.");
    } finally {
      setLoading(false);
      setSelectedDay(null);
    }
  };


  if (loading) { 
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
           <Text style={styles.emptyText}>Faça login para ver seu calendário de treinos.</Text>
         </View>
       </SafeAreaView>
     );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Frequência de Treino</Text>
        <Text style={styles.subtitle}>Dias marcados indicam que um exercício foi completado.</Text>
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
        <Text style={styles.legendText}>Dia de Treino Registrado</Text>
      </View>

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
    marginTop: 50,
    fontSize: 16,
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
  }
});