import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable, 
} from 'react-native';
import { useLocalSearchParams, Stack, Link, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. Importações RE-ADICIONADAS
import {
  collection,
  onSnapshot,
  query,
  doc,
  addDoc,
  serverTimestamp,
  getDocs,
  orderBy,
  limit,
  deleteDoc, 
  writeBatch,
  updateDoc // 2. IMPORTAR 'updateDoc' para o check
} from 'firebase/firestore';
import { db, auth, appId } from '../../firebaseConfig';
import { FontAwesome } from '@expo/vector-icons'; // RE-ADICIONADO

// 3. NOVO CAMPO 'lastCompleted'
interface Exercise {
  id: string;
  name: string;
  sets: string;
  createdAt?: { seconds: number };
  lastCompleted?: { seconds: number }; // Armazena o último check
}
interface Log {
  id: string;
  weight: number;
  reps: number;
  createdAt: { seconds: number; nanoseconds: number; } | null;
}

// 4. Função para verificar se é hoje
const isToday = (timestamp: { seconds: number } | undefined) => {
  if (!timestamp) return false;
  const date = new Date(timestamp.seconds * 1000);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export default function RoutineScreen() {
  const { id: routineId, name } = useLocalSearchParams<{ id: string; name: string }>();
  const navigation = useNavigation(); 

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userId = auth.currentUser?.uid;

  // Modal de LOG
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [history, setHistory] = useState<Log[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveLogLoading, setSaveLogLoading] = useState(false); 

  // Modal de Exercício (RE-ADICIONADO)
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Para deletar ou dar check

  // Adicionar botão "+" no header (RE-ADICIONADO)
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setExerciseModalVisible(true)} style={{ padding: 8 }}>
          <Text style={{ color: '#007AFF', fontSize: 30, fontWeight: 'bold' }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]); 

  // Buscar exercícios (agora inclui 'lastCompleted')
  useEffect(() => {
    if (!userId || !routineId) {
      setLoading(false);
      return;
    };
    setLoading(true);

    const exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises');
    const q = query(exercisesCollection, orderBy("createdAt", "asc")); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exercisesData: Exercise[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exercise));
      setExercises(exercisesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar exercícios: ", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [userId, routineId]);

  // Abrir Modal de Log (sem mudança)
  const handleOpenModal = async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setWeight('');
    setReps('');
    setHistoryLoading(true); 
    setLogModalVisible(true);

    if (!userId || !routineId) return; 

    const logCollection = collection(
      db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises', exercise.id, 'logs'
    );
    const q = query(logCollection, orderBy('createdAt', 'desc'), limit(5));

    try {
      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setHistory(logsData);
    } catch (error) {
      console.error("Erro ao buscar histórico: ", error);
    }
    setHistoryLoading(false); 
  };

  // Salvar Log (sem mudança)
  const handleSaveLog = async () => {
    if (!userId || !routineId || !selectedExercise || !weight || !reps) {
      Alert.alert("Erro", "Preencha o peso e as repetições.");
      return;
    }
    setSaveLogLoading(true); 
    try {
      const logCollection = collection(
        db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises', selectedExercise.id, 'logs'
      );
      await addDoc(logCollection, {
        weight: parseFloat(weight),
        reps: parseInt(reps, 10),
        createdAt: serverTimestamp(),
      });
      handleOpenModal(selectedExercise); 
      setWeight('');
      setReps('');
    } catch (error) {
      console.error("Erro ao salvar log: ", error);
      Alert.alert("Erro", "Não foi possível salvar o registro.");
    }
    setSaveLogLoading(false); 
  };

  // Salvar Exercício (RE-ADICIONADO)
  const handleSaveExercise = async () => {
    if (!userId || !routineId || !newExerciseName || !newExerciseSets) {
      Alert.alert("Erro", "Preencha o nome e as séries.");
      return;
    }
    setSaveLoading(true);
    try {
      const exercisesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises');
      await addDoc(exercisesCollection, {
        name: newExerciseName,
        sets: newExerciseSets,
        createdAt: serverTimestamp() 
      });
      setNewExerciseName('');
      setNewExerciseSets('');
      setExerciseModalVisible(false);
    } catch (error) {
      console.error("Erro ao salvar exercício: ", error);
      Alert.alert("Erro", "Não foi possível salvar o exercício.");
    }
    setSaveLoading(false);
  };

  // Deletar Exercício (RE-ADICIONADO)
  const handleDeleteExercise = (exerciseId: string) => {
    if (!userId || !routineId) return;

    Alert.alert(
      "Deletar Exercício",
      "Tem certeza que deseja deletar este exercício? TODOS os logs de progresso serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            setActionLoading(exerciseId);
            try {
              const exerciseRef = doc(db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises', exerciseId);
              
              const logsCollection = collection(exerciseRef, 'logs');
              const logsSnapshot = await getDocs(logsCollection);
              const batch = writeBatch(db);
              logsSnapshot.forEach(logDoc => {
                batch.delete(logDoc.ref);
              });
              
              batch.delete(exerciseRef);
              await batch.commit();

            } catch (error) {
              console.error("Erro ao deletar exercício: ", error);
              Alert.alert("Erro", "Não foi possível deletar o exercício.");
            }
            setActionLoading(null);
          }
        }
      ]
    );
  };

  // 5. NOVA FUNÇÃO DE CHECK
  const handleToggleCheck = async (exercise: Exercise) => {
    if (!userId || !routineId) return;

    const exerciseRef = doc(db, 'artifacts', appId, 'users', userId, 'routines', routineId, 'exercises', exercise.id);
    const completed = isToday(exercise.lastCompleted);
    
    setActionLoading(exercise.id); // Reutiliza o loading
    try {
      await updateDoc(exerciseRef, {
        lastCompleted: completed ? null : serverTimestamp() // Se já estava feito, desmarca. Senão, marca.
      });
    } catch (error) {
      console.error("Erro ao marcar exercício: ", error);
      Alert.alert("Erro", "Não foi possível atualizar o exercício.");
    }
    setActionLoading(null);
  };

  // formatDate (sem mudança)
  const formatDate = (timestamp: Log['createdAt']) => {
    if (!timestamp) return '...';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: name ? name : 'Ficha de Treino',
        }}
      />

      {/* Modal para adicionar exercício (RE-ADICIONADO) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={exerciseModalVisible}
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Exercício</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome (Ex: Supino Reto)"
              placeholderTextColor="#777"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            <TextInput
              style={styles.input}
              placeholder="Séries (Ex: 4x 12,10,8,6)"
              placeholderTextColor="#777"
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
            />
            {saveLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setExerciseModalVisible(false)}>
                  <Text style={styles.logoutText}>Cancelar</Text>
                </Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveExercise}>
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de LOG (sem mudança) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={logModalVisible} 
        onRequestClose={() => setLogModalVisible(false)} 
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
            
            <Link
              href={{
                pathname: `/charts/${selectedExercise?.id}`,
                params: { 
                  routineId: routineId, 
                  name: selectedExercise?.name 
                },
              }}
              asChild
            >
              <TouchableOpacity style={styles.chartLink}>
                <Text style={styles.chartLinkText}>Ver Gráfico de Evolução</Text>
              </TouchableOpacity>
            </Link>

            <Text style={styles.historyTitle}>Últimos 5 Registros:</Text>
            {historyLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              history.length === 0 ? (
                <Text style={styles.historyEmpty}>Nenhum registro anterior.</Text>
              ) : (
                history.map(log => (
                  <View key={log.id} style={styles.historyItem}>
                    <Text style={styles.historyText}>
                      {formatDate(log.createdAt)}:
                    </Text>
                    <Text style={styles.historyText}>
                      {log.weight} kg x {log.reps} reps
                    </Text>
                  </View>
                ))
              )
            )}

            <View style={styles.separator} />

            <Text style={styles.inputLabel}>Novo Registro:</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="Peso (kg)"
                placeholderTextColor="#777"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
              />
              <TextInput
                style={[styles.input, styles.inputHalf]}
                placeholder="Reps"
                placeholderTextColor="#777"
                keyboardType="numeric"
                value={reps}
                onChangeText={setReps}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button title="Fechar" onPress={() => setLogModalVisible(false)} color="#FF4500" />
              {saveLogLoading ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <Button title="Salvar" onPress={handleSaveLog} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* A Lista de Exercícios (Atualizada com botão deletar e check) */}
      {loading ? (
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const completed = isToday(item.lastCompleted); // 6. Verifica se está completo
            return (
              <View style={styles.cardContainer}>
                {/* 7. BOTÃO DE CHECK */}
                <TouchableOpacity 
                  style={styles.checkButton}
                  onPress={() => handleToggleCheck(item)}
                  disabled={actionLoading === item.id}
                >
                  <FontAwesome 
                    name={completed ? "check-square" : "square-o"} 
                    size={28} 
                    color={completed ? "#4CD964" : "#555"} // Verde se completo
                  />
                </TouchableOpacity>
                
                <View style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, completed && styles.completedText]}>{item.name}</Text>
                    <Text style={[styles.cardSets, completed && styles.completedText]}>{item.sets}</Text>
                  </View>
                  <TouchableOpacity style={styles.logButton} onPress={() => handleOpenModal(item)}>
                    <Text style={styles.logButtonText}>Registrar</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Botão Deletar (RE-ADICIONADO) */}
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => handleDeleteExercise(item.id)}
                  disabled={actionLoading === item.id} 
                >
                  {actionLoading === item.id ? 
                    <ActivityIndicator size="small" color="#FF4500" /> :
                    <FontAwesome name="trash" size={24} color="#FF4500" />
                  }
                </TouchableOpacity>
              </View>
            )
          }}
          ListHeaderComponent={
            <Text style={styles.header}>Exercícios de Hoje:</Text>
          }
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum exercício encontrado. Clique no + para adicionar.</Text>
          }
        />
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
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  // 8. NOVO BOTÃO DE CHECK
  checkButton: {
    paddingRight: 15,
    paddingLeft: 5,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    flex: 1, 
  },
  deleteButton: {
    padding: 20,
    width: 60,
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSets: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  // 9. NOVO ESTILO PARA TEXTO COMPLETO
  completedText: {
    textDecorationLine: 'line-through',
    color: '#555',
  },
  logButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 24,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 18,
    color: '#B0B0B0',
    marginBottom: 20,
  },
  chartLink: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  chartLinkText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  historyEmpty: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: { 
    backgroundColor: '#3A3A3A',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10, 
  },
  inputHalf: {
    width: '48%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center', 
    marginTop: 24,
  },
  buttonSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutText: {
    color: '#FF4500',
    fontSize: 16,
  },
});