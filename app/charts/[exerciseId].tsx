import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';
import { calculateEpley1RM } from '../utils/formulas';

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

const groupLogsByDay = (logs: Log[], unit: string): ChartData[] => {
  const groups: { [key: string]: number } = {};
  logs.forEach((log) => {
    const date = new Date(log.createdAt.seconds * 1000);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    const currentMax = groups[label] || 0;
    if (log.weight > currentMax) groups[label] = log.weight;
  });
  return Object.keys(groups).map((label) => ({
    value: groups[label],
    label,
    dataPointText: `${groups[label]}`,
  }));
};

export default function ChartScreen() {
  const params = useLocalSearchParams();
  const { exerciseId, exerciseName, routineId } = params;

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [maxValue, setMaxValue] = useState(0);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        AsyncStorage.getItem('@EvoFit:weightUnit').then((u) => {
          if (u === 'kg' || u === 'lbs') setWeightUnit(u);
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !routineId || !exerciseId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const fetchLogs = async () => {
      try {
        const logsCollection = collection(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'routines',
          routineId as string,
          'exercises',
          exerciseId as string,
          'logs'
        );
        const q = query(logsCollection, orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        const logsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Log);

        const formattedData = groupLogsByDay(logsData, weightUnit);
        setChartData(formattedData);
        if (formattedData.length > 0) {
          setMaxValue(Math.max(...formattedData.map((d) => d.value)));
        }
      } catch (error) {
        console.error('Erro ao buscar logs:', error);
        Alert.alert('Erro', 'Não foi possível carregar o gráfico.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, routineId, exerciseId, weightUnit]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#EF4444" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: (exerciseName as string) || 'Gráfico' }} />

      <View style={styles.content}>
        <Text style={styles.title}>Evolução de Carga</Text>
        <Text style={styles.exerciseName}>{exerciseName}</Text>

        {chartData.length < 2 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>
              Registre pelo menos 2 séries em dias diferentes para visualizar o gráfico.
            </Text>
          </View>
        ) : (
          <View style={styles.chartContainer}>
            <View style={styles.chartBadge}>
              <Text style={styles.chartBadgeText}>
                Recorde: {maxValue} {weightUnit}
              </Text>
            </View>
            <LineChart
              data={chartData}
              height={220}
              width={Dimensions.get('window').width - 64}
              color="#EF4444"
              thickness={3}
              dataPointsColor="#FFF"
              xAxisColor="#333"
              yAxisColor="#333"
              isAnimated
              curved
              yAxisOffset={0}
              startFillColor="rgba(239,68,68,0.25)"
              endFillColor="rgba(239,68,68,0.02)"
              spacing={50}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, padding: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  exerciseName: { fontSize: 16, color: '#888', marginBottom: 32 },
  chartContainer: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    width: '100%',
  },
  chartBadge: {
    backgroundColor: '#2A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  chartBadgeText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center' },
});
