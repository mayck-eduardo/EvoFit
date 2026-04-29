import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteField,
  getDocs,
  query,
  writeBatch,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

LocaleConfig.locales['br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'br';

interface Routine { id: string; name: string; lastFullyCompleted?: { seconds: number }; }
interface Exercise { id: string; name: string; lastCompleted?: { seconds: number }; }
interface DailyHistoryItem { id: string; exerciseName: string; routineName: string; }
type MarkedDates = { [key: string]: { selected: boolean; marked: boolean; dotColor: string; selectedColor: string; } };

const formatDate = (ts: { seconds: number }) => new Date(ts.seconds * 1000).toISOString().split('T')[0];
const formatDateDisplay = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState('default');
  const [workoutDays, setWorkoutDays] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const isFocused = useIsFocused();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user && isFocused) fetchWorkoutDates();
    else if (!user) { setLoading(false); setMarkedDates({}); }
  }, [user, isFocused]);

  const fetchWorkoutDates = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const mode = await AsyncStorage.getItem('@EvoFit:completionMode') || 'any';
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      const planId = savedPlan || 'default';
      setCurrentPlanId(planId);

      const userId = user.uid;
      const uniqueDates = new Set<string>();
      const routinesQuery = planId === 'default'
        ? query(collection(db, 'artifacts', appId, 'users', userId, 'routines'))
        : query(collection(db, 'artifacts', appId, 'users', userId, 'plans', planId, 'routines'));

      const routinesSnapshot = await getDocs(routinesQuery);
      if (mode === 'any') {
        for (const routineDoc of routinesSnapshot.docs) {
          const exercisesSnapshot = await getDocs(query(collection(routineDoc.ref, 'exercises')));
          exercisesSnapshot.forEach((doc) => {
            const ex = doc.data() as Exercise;
            if (ex.lastCompleted) uniqueDates.add(formatDate(ex.lastCompleted));
          });
        }
      } else {
        routinesSnapshot.forEach((doc) => {
          const r = doc.data() as Routine;
          if (r.lastFullyCompleted) uniqueDates.add(formatDate(r.lastFullyCompleted));
        });
      }

      const sorted = Array.from(uniqueDates).sort();
      setWorkoutDays(sorted.length);
      calcStreak(sorted);

      const newMarked: MarkedDates = {};
      sorted.forEach((date) => {
        newMarked[date] = { selected: false, marked: true, dotColor: '#EF4444', selectedColor: '#3A3A3A' };
      });
      setMarkedDates(newMarked);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calcStreak = (dates: string[]) => {
    let streak = 0;
    let current = new Date();
    current.setHours(0, 0, 0, 0);
    const dateSet = new Set(dates);
    for (let i = 0; i < 365; i++) {
      const key = current.toISOString().split('T')[0];
      if (dateSet.has(key)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else break;
    }
    setCurrentStreak(streak);
  };

  const handleDayPress = async (day: DateData) => {
    const dateString = day.dateString;
    setSelectedDay(dateString);
    if (markedDates[dateString]) await fetchDetailsForDate(dateString);
    else Alert.alert('Sem Treino', `Nenhum treino em ${formatDateDisplay(dateString)}.`, [{ text: 'OK', onPress: () => setSelectedDay(null) }]);
  };

  const fetchDetailsForDate = async (dateString: string) => {
    if (!user) return;
    setLoadingDetails(true);
    setDetailsModalVisible(true);
    const userId = user.uid;
    const historyItems: DailyHistoryItem[] = [];
    try {
      const routinesQuery = currentPlanId === 'default'
        ? query(collection(db, 'artifacts', appId, 'users', userId, 'routines'))
        : query(collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines'));
      const routinesSnapshot = await getDocs(routinesQuery);
      for (const routineDoc of routinesSnapshot.docs) {
        const routineData = routineDoc.data() as Routine;
        const exercisesSnapshot = await getDocs(query(collection(routineDoc.ref, 'exercises')));
        exercisesSnapshot.forEach((exDoc) => {
          const ex = exDoc.data() as Exercise;
          if (ex.lastCompleted && formatDate(ex.lastCompleted) === dateString) {
            historyItems.push({ id: exDoc.id, exerciseName: ex.name, routineName: routineData.name });
          }
        });
      }
      setDailyHistory(historyItems);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível carregar detalhes.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUnmarkDay = () => {
    if (!selectedDay) return;
    Alert.alert('Apagar Registros', `Remover registros de ${formatDateDisplay(selectedDay)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await updateDayStatus(selectedDay, false); setDetailsModalVisible(false); } },
    ]);
  };

  const updateDayStatus = async (dateString: string, mark: boolean) => {
    if (!user) return;
    setLoading(true);
    const userId = user.uid;
    try {
      const routinesQuery = currentPlanId === 'default'
        ? query(collection(db, 'artifacts', appId, 'users', userId, 'routines'))
        : query(collection(db, 'artifacts', appId, 'users', userId, 'plans', currentPlanId, 'routines'));
      if (!mark) {
        const routinesSnapshot = await getDocs(routinesQuery);
        const batch = writeBatch(db);
        for (const routineDoc of routinesSnapshot.docs) {
          const r = routineDoc.data() as Routine;
          if (r.lastFullyCompleted && formatDate(r.lastFullyCompleted) === dateString) {
            batch.update(routineDoc.ref, { lastFullyCompleted: deleteField() });
          }
          const exercisesSnapshot = await getDocs(query(collection(routineDoc.ref, 'exercises')));
          for (const exerciseDoc of exercisesSnapshot.docs) {
            const lc = exerciseDoc.data().lastCompleted;
            if (lc && formatDate(lc) === dateString) batch.update(exerciseDoc.ref, { lastCompleted: deleteField() });
          }
        }
        await batch.commit();
        setMarkedDates((prev) => { const n = { ...prev }; delete n[dateString]; return n; });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível atualizar.');
    } finally {
      setLoading(false);
      setSelectedDay(null);
    }
  };

  if (loading && !detailsModalVisible) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!user) return <View style={[styles.container, { backgroundColor: colors.background }]}><AuthForm /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Modal animationType="slide" transparent visible={detailsModalVisible} onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedDay ? formatDateDisplay(selectedDay) : 'Detalhes'}</Text>
            {loadingDetails ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ margin: 20 }} />
            ) : (
              <FlatList
                data={dailyHistory}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <View style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
                    <View>
                      <Text style={[styles.historyExercise, { color: colors.text }]}>{item.exerciseName}</Text>
                      <Text style={[styles.historyRoutine, { color: colors.textSecondary }]}>{item.routineName}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum exercício encontrado.</Text>}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Text style={[styles.closeText, { color: colors.textSecondary }]}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUnmarkDay}>
                <FontAwesome name="trash" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Calendário</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{workoutDays}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Dias treinados</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{currentStreak}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sequência</Text>
        </View>
      </View>

      <View style={[styles.calendarWrapper, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Calendar
          current={new Date().toISOString().split('T')[0]}
          monthFormat={'MMMM yyyy'}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          key={isFocused.toString()}
          theme={{
            calendarBackground: colors.card,
            textSectionTitleColor: colors.textSecondary,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: '#FFF',
            todayTextColor: colors.primary,
            dayTextColor: colors.text,
            textDisabledColor: colors.textMuted,
            dotColor: colors.primary,
            arrowColor: colors.text,
            monthTextColor: colors.text,
            textDayFontWeight: '400',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 13,
          }}
        />
      </View>

      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.legendText}>Dia com treino concluído</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#1E1E1E', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#EF4444' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  calendarWrapper: { marginHorizontal: 15, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A' },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginHorizontal: 20, padding: 12, backgroundColor: '#1E1E1E', borderRadius: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendText: { color: '#FFF', fontSize: 13 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 10, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#2A2A2A', borderRadius: 16, padding: 20, width: '85%', maxHeight: '60%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 16, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#3A3A3A', paddingBottom: 12 },
  historyItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 14 },
  historyExercise: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  historyRoutine: { color: '#888', fontSize: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTopWidth: 1, borderTopColor: '#3A3A3A', paddingTop: 14 },
  closeText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});
