import { Stack, useLocalSearchParams } from 'expo-router';
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
import { appId, db } from '../../../../firebaseConfig';
import { useTheme } from '../../../../context/ThemeContext';

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

const groupLogsByDay = (logs: Log[]): ChartData[] => {
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

export default function StudentChartScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const { studentId, exerciseId, exerciseName, routineId } = params;

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [maxValue, setMaxValue] = useState(0);

  useEffect(() => {
    if (!studentId || !routineId || !exerciseId) {
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
          studentId as string,
          'routines',
          routineId as string,
          'exercises',
          exerciseId as string,
          'logs'
        );
        const q = query(logsCollection, orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        const logsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Log);

        const formattedData = groupLogsByDay(logsData);
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
  }, [studentId, routineId, exerciseId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ title: (exerciseName as string) || 'Gráfico' }} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Evolução de Carga</Text>
        <Text style={[styles.exerciseName, { color: colors.textSecondary }]}>{exerciseName}</Text>

        {chartData.length < 2 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Registre pelo menos 2 séries em dias diferentes para visualizar o gráfico.
            </Text>
          </View>
        ) : (
          <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.chartBadge, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.chartBadgeText, { color: colors.primary }]}>
                Recorde: {maxValue} kg
              </Text>
            </View>
            <LineChart
              data={chartData}
              height={220}
              width={Dimensions.get('window').width - 64}
              color={colors.primary}
              thickness={3}
              dataPointsColor={colors.text}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
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
  container: { flex: 1 },
  content: { flex: 1, padding: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  exerciseName: { fontSize: 16, marginBottom: 32 },
  chartContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  chartBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  chartBadgeText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
