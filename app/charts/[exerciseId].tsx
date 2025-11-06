import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, auth, appId } from '../../firebaseConfig'; 
import { LineChart } from 'react-native-gifted-charts';

interface Log {
  id: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number; nanoseconds: number; } | null;
}
interface ChartData {
  value: number; 
  label: string; 
}

const { width } = Dimensions.get('window'); 

export default function ChartScreen() {
  const { routineId, exerciseId, name } = useLocalSearchParams<{
    routineId: string;
    exerciseId: string;
    name: string;
  }>();

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userId = auth.currentUser?.uid; 

  const formatDate = (timestamp: Log['createdAt']) => {
    if (!timestamp) return '...';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  useEffect(() => {
    if (!userId || !routineId || !exerciseId) {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setLoading(true);
      const logCollection = collection(
        db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises', exerciseId, 'logs'
      );
      const q = query(logCollection, orderBy('createdAt', 'asc'));

      try {
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map(doc => ({ ...doc.data() } as Log));

        const dataForChart: ChartData[] = logsData.map(log => ({
          value: log.weight,
          label: formatDate(log.createdAt),
        }));

        setChartData(dataForChart);
      } catch (error) {
        console.error("Erro ao buscar logs para o gráfico: ", error);
      }
      setLoading(false);
    };

    fetchLogs();
  }, [userId, routineId, exerciseId]); 

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `Evolução: ${name}` }} />
      <View style={styles.content}>
        <Text style={styles.header}>Progressão de Carga (kg)</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 50 }} />
        ) : chartData.length < 2 ? (
          <Text style={styles.emptyText}>
            Você precisa de pelo menos 2 registros para ver um gráfico.
          </Text>
        ) : (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              height={250}
              width={width - 80} 
              color="#007AFF" 
              thickness={3}
              dataPointsColor="#FFFFFF"
              dataPointsRadius={5}
              xAxisLabelTextStyle={styles.axisLabel}
              xAxisColor="#555"
              yAxisLabelTextStyle={styles.axisLabel}
              yAxisColor="#555"
              yAxisTextStyle={styles.axisLabel}
              rulesColor="#333"
              showDataPointOnFocus
              focusEnabled
              dataPointLabelShiftY={-20}
              dataPointLabelShiftX={-10}
              dataPointLabelComponent={(item: ChartData) => (
                 <View style={styles.tooltip}>
                   <Text style={styles.tooltipText}>{item.value} kg</Text>
                 </View>
              )}
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
    padding: 20,
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  axisLabel: {
    color: '#B0B0B0',
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  tooltip: {
    backgroundColor: '#333',
    padding: 5,
    borderRadius: 4,
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
  }
});