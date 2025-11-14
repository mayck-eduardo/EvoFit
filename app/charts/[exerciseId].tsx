

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

interface Log {
  id: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number };
}

interface ChartData {
  value: number;
  label: string;
  dataPointText: string;
}

// ATUALIZADA: Aceita a unidade
const groupLogsByDay = (logs: Log[], unit: string): ChartData[] => {
  const groups: { [key: string]: number } = {}; 

  logs.forEach(log => {
    const date = new Date(log.createdAt.seconds * 1000);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const label = `${day}/${month}`;
    
    const currentMaxWeight = groups[label] || 0;
    if (log.weight > currentMaxWeight) {
      groups[label] = log.weight;
    }
  });

  return Object.keys(groups).map(label => ({
    value: groups[label],
    label: label,
    dataPointText: `${groups[label]} ${unit}`, // Adiciona a unidade
  }));
};

export default function ChartScreen() {
  const params = useLocalSearchParams();
  const { exerciseId, exerciseName, routineId } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  
  const [weightUnit, setWeightUnit] = useState('kg'); // NOVO ESTADO

  // Efeito de Auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if(currentUser) {
        loadWeightUnit(); 
      }
    });
    return () => unsubscribeAuth();
  }, []);
  
  // NOVA FUNÇÃO
  const loadWeightUnit = async () => {
    try {
      const savedUnit = await AsyncStorage.getItem('@EvoFit:weightUnit');
      if (savedUnit === 'kg' || savedUnit === 'lbs') {
        setWeightUnit(savedUnit);
      }
    } catch (e) {
      console.error("Erro ao carregar weight unit: ", e);
    }
  };

  // Efeito para buscar os Logs
  useEffect(() => {
    if (!user || !routineId || !exerciseId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const fetchLogs = async () => {
      try {
        const logsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'routines', routineId as string, 'exercises', exerciseId as string, 'logs');
        const q = query(logsCollection, orderBy('createdAt', 'asc'));
        
        const snapshot = await getDocs(q);
        const logsData: Log[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));

        // Passa a unidade para a função de agrupamento
        const formattedData = groupLogsByDay(logsData, weightUnit);
        
        setChartData(formattedData);

      } catch (error) {
        console.error("Erro ao buscar logs para gráfico: ", error);
        Alert.alert("Erro", "Não foi possível carregar o gráfico.");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, routineId, exerciseId, weightUnit]); // Recarrega se a unidade mudar

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: exerciseName as string || 'Gráfico' }} />
      
      <View style={styles.content}>
        <Text style={styles.title}>Evolução de Carga</Text>
        {/* Exibe a unidade de peso */}
        <Text style={styles.subtitle}>(Peso Máximo por Dia em {weightUnit})</Text>
        <Text style={styles.exerciseName}>{exerciseName}</Text>

        {chartData.length < 2 ? (
          <Text style={styles.emptyText}>
            Você precisa de pelo menos 2 registros em dias diferentes para montar um gráfico.
          </Text>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              height={250}
              width={Dimensions.get('window').width - 80} 
              
              color="#007AFF" 
              thickness={3}
              
              dataPointsColor="#FFFFFF"
              dataPointsRadius={5}
              
              dataPointLabelShiftY={-20}
              dataPointLabelColor="#FFFFFF"
              
              xAxisColor="#555"
              yAxisColor="#555"
              xAxisLabelColor="#999"
              yAxisLabelColor="#999"
              
              isAnimated
              curved
              yAxisOffset={0}
              startFillColor="rgba(0,122,255,0.2)"
              endFillColor="rgba(0,122,255,0.01)"
            />
          </View>
        )}
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
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  exerciseName: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 40,
  },
  chartContainer: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});
