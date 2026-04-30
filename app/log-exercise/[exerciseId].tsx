import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NumberPad from '../../components/NumberPad';
import RestTimerOverlay from '../../components/RestTimerOverlay';
import { appId, auth, db } from '../../firebaseConfig';
import { calculateEpley1RM } from '../../utils/formulas';

interface Log {
  id: string;
  weight: number;
  reps: number;
  note?: string;
  createdAt: { seconds: number };
}

export default function LogExerciseScreen() {
  const params = useLocalSearchParams();
  const { exerciseId, exerciseName, routineId, exerciseSets } = params;
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [activeField, setActiveField] = useState<'weight' | 'reps' | null>('weight');

  const [timerDefault, setTimerDefault] = useState(90);
  const [timeLeft, setTimeLeft] = useState(90);
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [timerSound, setTimerSound] = useState(true);

  const setsProgrammed = typeof exerciseSets === 'string' ? exerciseSets : '';
  const setsCount = logs.filter((l) => {
    const logDate = new Date(l.createdAt.seconds * 1000);
    return logDate.toDateString() === new Date().toDateString();
  }).length;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) loadPreferences();
    });
    return () => unsubscribeAuth();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedTimer = await AsyncStorage.getItem('@EvoFit:timerDefault');
      if (savedTimer) {
        const t = parseInt(savedTimer, 10);
        setTimerDefault(t);
        setTimeLeft(t);
      }
      const savedUnit = await AsyncStorage.getItem('@EvoFit:weightUnit');
      if (savedUnit === 'kg' || savedUnit === 'lbs') setWeightUnit(savedUnit);
      const savedSound = await AsyncStorage.getItem('@EvoFit:timerSound');
      if (savedSound !== null) setTimerSound(savedSound === 'true');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user || !routineId || !exerciseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
    const q = query(logsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: Log[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }) as Log);
      setLogs(logsData);
      if (logsData.length > 0 && weight === '' && reps === '') {
        setWeight(logsData[0].weight.toString());
        setReps(logsData[0].reps.toString());
      }
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar logs:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, routineId, exerciseId]);

  useEffect(() => {
    if (isTimerActive && timerEndTime) {
      const interval = setInterval(() => {
        const remaining = timerEndTime - Date.now();
        if (remaining <= 0) {
          setTimeLeft(0);
          setIsTimerActive(false);
          setTimerEndTime(null);
          if (notificationIds.length === 0) playTimerAlert();
        } else {
          setTimeLeft(Math.ceil(remaining / 1000));
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isTimerActive, timerEndTime]);

  const startTimer = async () => {
    const endTime = Date.now() + timerDefault * 1000;
    setTimeLeft(timerDefault);
    setTimerEndTime(endTime);
    setIsTimerActive(true);
  };

  const stopTimer = async () => {
    setIsTimerActive(false);
    setTimerEndTime(null);
    setTimeLeft(timerDefault);
  };

  const addTime = (seconds: number) => {
    setTimerEndTime((prev) => (prev ? prev + seconds * 1000 : null));
    setTimeLeft((prev) => prev + seconds);
  };

  const playTimerAlert = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveLog = async () => {
    if (!user || !routineId || !exerciseId) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLogLoading(true);
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
      await addDoc(logsCollection, {
        weight: w,
        reps: r,
        note: note || undefined,
        createdAt: serverTimestamp(),
      });

      await updateDoc(
        doc(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'routines',
          routineId as string,
          'exercises',
          exerciseId as string
        ),
        { lastCompleted: serverTimestamp() }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNote('');
      setShowNoteInput(false);
      setReps('');
      setWeight(w.toString());
      await startTimer();
    } catch (error) {
      console.error('Erro ao salvar log:', error);
      Alert.alert('Erro', 'Não foi possível salvar a série.');
    }
    setLogLoading(false);
  };

  const handleDeleteLog = async (logId: string) => {
    Alert.alert('Apagar série', 'Deseja remover esta série?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const logDoc = doc(
            db,
            'artifacts',
            appId,
            'users',
            user!.uid,
            'routines',
            routineId as string,
            'exercises',
            exerciseId as string,
            'logs',
            logId
          );
          await deleteDoc(logDoc);
        },
      },
    ]);
  };

  const handleNumberPadSubmit = () => {
    handleSaveLog();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatLogTime = (timestamp: { seconds: number } | undefined | null) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp.seconds * 1000).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const todayLogs = logs.filter((l) => {
    const d = new Date(l.createdAt.seconds * 1000);
    return d.toDateString() === new Date().toDateString();
  });

  const otherLogs = logs.filter((l) => {
    const d = new Date(l.createdAt.seconds * 1000);
    return d.toDateString() !== new Date().toDateString();
  });

  const groupOtherLogs = () => {
    const groups: { date: string; logs: Log[] }[] = [];
    otherLogs.forEach((log) => {
      const date = new Date(log.createdAt.seconds * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const existing = groups.find((g) => g.date === date);
      if (existing) existing.logs.push(log);
      else groups.push({ date, logs: [log] });
    });
    return groups;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#EF4444" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: exerciseName as string,
          headerTintColor: '#FFFFFF',
          headerStyle: { backgroundColor: '#121212' },
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>Séries Programadas</Text>
                <Text style={styles.infoValue}>{setsProgrammed || '-'}</Text>
              </View>
              <View style={styles.setCounter}>
                <Text style={styles.setCounterText}>
                  {setsCount}
                  <Text style={styles.setCounterOf}>/{(setsProgrammed.match(/\d+/g) || []).join('')}</Text>
                </Text>
                <Text style={styles.setCounterLabel}>feitas hoje</Text>
              </View>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: `/charts/${exerciseId}` as any,
                  params: { exerciseName, routineId },
                })
              }
              style={styles.chartLink}
            >
              <FontAwesome name="line-chart" size={16} color="#EF4444" />
              <Text style={styles.chartLinkText}>Ver evolução</Text>
            </Pressable>
          </View>

          {/* Quick Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Nova Série</Text>

            <View style={styles.quickInputs}>
              <View style={styles.quickInputContainer}>
                <Text style={styles.quickInputLabel}>Peso ({weightUnit})</Text>
                <TextInput
                  style={[styles.quickInput, activeField === 'weight' && styles.quickInputFocused]}
                  placeholder="0"
                  placeholderTextColor="#555"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="number-pad"
                  onFocus={() => setActiveField('weight')}
                  onBlur={() => setActiveField(null)}
                />
                <View style={styles.quickAdjust}>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const v = parseFloat(weight) || 0;
                      setWeight(Math.max(0, v - 2.5).toString());
                    }}
                  >
                    <Text style={styles.adjustBtnText}>-2.5</Text>
                  </Pressable>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const v = parseFloat(weight) || 0;
                      setWeight((v + 2.5).toString());
                    }}
                  >
                    <Text style={styles.adjustBtnText}>+2.5</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.quickInputContainer}>
                <Text style={styles.quickInputLabel}>Reps</Text>
                <TextInput
                  style={[styles.quickInput, activeField === 'reps' && styles.quickInputFocused]}
                  placeholder="0"
                  placeholderTextColor="#555"
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  onFocus={() => setActiveField('reps')}
                  onBlur={() => setActiveField(null)}
                />
                <View style={styles.quickAdjust}>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const v = parseInt(reps) || 0;
                      setReps(Math.max(0, v - 1).toString());
                    }}
                  >
                    <Text style={styles.adjustBtnText}>-1</Text>
                  </Pressable>
                  <Pressable
                    style={styles.adjustBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const v = parseInt(reps) || 0;
                      setReps((v + 1).toString());
                    }}
                  >
                    <Text style={styles.adjustBtnText}>+1</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 1RM Preview */}
            {weight && reps && calculateEpley1RM(parseFloat(weight), parseInt(reps)) > 0 && (
              <View style={styles.oneRMPreview}>
                <Text style={styles.oneRMLabel}>Est. 1RM</Text>
                <Text style={styles.oneRMValue}>
                  {calculateEpley1RM(parseFloat(weight), parseInt(reps))} {weightUnit}
                </Text>
              </View>
            )}

            {/* Note Toggle */}
            <Pressable onPress={() => setShowNoteInput(!showNoteInput)} style={styles.noteToggle}>
              <FontAwesome
                name={showNoteInput ? 'comment' : 'comment-o'}
                size={16}
                color="#888"
              />
              <Text style={styles.noteToggleText}>
                {showNoteInput ? 'Fechar nota' : 'Adicionar nota'}
              </Text>
            </Pressable>

            {showNoteInput && (
              <TextInput
                style={styles.noteInput}
                placeholder="Ex: Fácil, aumente peso na próxima..."
                placeholderTextColor="#555"
                value={note}
                onChangeText={setNote}
                multiline
              />
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, logLoading && styles.saveButtonDisabled]}
              onPress={handleSaveLog}
              disabled={logLoading}
            >
              {logLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <FontAwesome name="plus-circle" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Salvar Série</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Today's Logs */}
          {todayLogs.length > 0 && (
            <View style={styles.logsSection}>
              <Text style={styles.sectionTitle}>Hoje</Text>
              {todayLogs.map((item, index) => {
                const estimated1RM = calculateEpley1RM(item.weight, item.reps);
                return (
                  <View key={item.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <View style={styles.logSetBadge}>
                        <Text style={styles.logSetBadgeText}>#{todayLogs.length - index}</Text>
                      </View>
                      <Text style={styles.logText}>
                        {item.weight} {weightUnit} × {item.reps}
                      </Text>
                      {estimated1RM > 0 && (
                        <Text style={styles.log1RM}>
                          1RM: {estimated1RM}{weightUnit}
                        </Text>
                      )}
                      <Text style={styles.logTime}>{formatLogTime(item.createdAt)}</Text>
                      <Pressable onPress={() => handleDeleteLog(item.id)} style={styles.deleteBtn}>
                        <FontAwesome name="trash-o" size={18} color="#666" />
                      </Pressable>
                    </View>
                    {item.note && (
                      <View style={styles.logNote}>
                        <FontAwesome name="comment" size={12} color="#666" style={{ marginRight: 6 }} />
                        <Text style={styles.logNoteText}>{item.note}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Previous Logs */}
          {groupOtherLogs().map((group) => (
            <View key={group.date} style={styles.logsSection}>
              <Text style={styles.sectionTitle}>{group.date}</Text>
              {group.logs.map((item, index) => {
                const estimated1RM = calculateEpley1RM(item.weight, item.reps);
                return (
                  <View key={item.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logText}>
                        {item.weight} {weightUnit} × {item.reps}
                      </Text>
                      {estimated1RM > 0 && (
                        <Text style={styles.log1RM}>1RM: {estimated1RM}</Text>
                      )}
                      <Text style={styles.logTime}>{formatLogTime(item.createdAt)}</Text>
                      <Pressable onPress={() => handleDeleteLog(item.id)} style={styles.deleteBtn}>
                        <FontAwesome name="trash-o" size={18} color="#666" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Number Pad */}
        <NumberPad
          value={activeField === 'weight' ? weight : reps}
          onValueChange={(val) => {
            if (activeField === 'weight') setWeight(val);
            else setReps(val);
          }}
          onSubmit={handleNumberPadSubmit}
          submitLabel="Salvar Série"
          showDecimal={activeField === 'weight'}
          unit={activeField === 'weight' ? weightUnit : 'reps'}
        />
      </KeyboardAvoidingView>

      {/* Rest Timer */}
      {isTimerActive && (
        <RestTimerOverlay
          timeLeft={timeLeft}
          totalTime={timerDefault}
          isTimerActive={isTimerActive}
          onStop={stopTimer}
          onAddTime={addTime}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  infoCard: {
    backgroundColor: '#1E1E1E',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  infoValue: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  setCounter: { alignItems: 'center' },
  setCounterText: { color: '#10B981', fontSize: 28, fontWeight: '700' },
  setCounterOf: { color: '#555', fontSize: 20 },
  setCounterLabel: { color: '#888', fontSize: 12 },
  chartLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 8,
  },
  chartLinkText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  inputSection: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  quickInputs: { flexDirection: 'row', gap: 12 },
  quickInputContainer: { flex: 1 },
  quickInputLabel: { color: '#888', fontSize: 13, marginBottom: 6 },
  quickInput: {
    backgroundColor: '#2C2C2C',
    color: '#FFF',
    padding: 14,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '600',
    borderWidth: 2,
    borderColor: 'transparent',
    textAlign: 'center',
  },
  quickInputFocused: { borderColor: '#EF4444' },
  quickAdjust: { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'center' },
  adjustBtn: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  adjustBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  oneRMPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  oneRMLabel: { color: '#888', fontSize: 14 },
  oneRMValue: { color: '#EF4444', fontSize: 18, fontWeight: '700' },
  noteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  noteToggleText: { color: '#888', fontSize: 14 },
  noteInput: {
    backgroundColor: '#2C2C2C',
    color: '#FFF',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    marginTop: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    gap: 10,
  },
  saveButtonDisabled: { backgroundColor: '#666' },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  logsSection: { marginTop: 20, paddingHorizontal: 16 },
  logCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logSetBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logSetBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  logText: { color: '#FFF', fontSize: 16, fontWeight: '600', flex: 1 },
  log1RM: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  logTime: { color: '#666', fontSize: 12 },
  deleteBtn: { padding: 4 },
  logNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  logNoteText: { color: '#888', fontSize: 13, flex: 1, fontStyle: 'italic' },
});
