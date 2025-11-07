import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';



// Imports de Backup/Import FORAM REMOVIDOS

export interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}

export default function EditScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  // Modal de Ficha
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false); 
  
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); 
  
  const router = useRouter(); 

  // useEffect de auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // useEffect de buscar dados
  useEffect(() => {
    if (!user) {
      setRoutines([]);
      return;
    }
    setLoading(true);
    const userId = user.uid;
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("order", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routinesData: Routine[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(routinesData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar fichas: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ... (Funções de CRUD de Fichas não mudam) ...
  const openAddModal = () => {
    setEditingRoutine(null);
    setNewRoutineName('');
    setRoutineModalVisible(true);
  };

  const openEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setNewRoutineName(routine.name);
    setRoutineModalVisible(true);
  };

  const handleSaveRoutine = async () => {
    if (!user || !newRoutineName) {
      Alert.alert("Erro", "Digite um nome para a ficha.");
      return;
    }
    setSaveLoading(true);
    try {
      const userId = user.uid;
      const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
      
      if (editingRoutine) {
        const routineRef = doc(db, routinesCollection.path, editingRoutine.id);
        await updateDoc(routineRef, {
          name: newRoutineName
        });
      } else {
        await addDoc(routinesCollection, {
          name: newRoutineName,
          createdAt: serverTimestamp(),
          order: routines.length
        });
      }
      
      setNewRoutineName('');
      setRoutineModalVisible(false);
      setEditingRoutine(null);
    } catch (error) {
      console.error("Erro ao salvar ficha: ", error);
      Alert.alert("Erro", "Não foi possível salvar a ficha.");
    }
    setSaveLoading(false);
  };

  const handleDeleteRoutine = (routineId: string) => {
    if (!user) return;
    
    Alert.alert(
      "Deletar Ficha",
      "Tem certeza que deseja deletar esta ficha? TODOS os exercícios e logs serão apagados para sempre.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          style: "destructive",
          onPress: async () => {
            setActionLoading(routineId); 
            try {
              const userId = user.uid;
              const routineRef = doc(db, 'artifacts', appId, 'users', userId, 'routines', routineId);
              
              const exercisesCollection = collection(routineRef, 'exercises');
              const exercisesSnapshot = await getDocs(exercisesCollection);
              const batch = writeBatch(db);

              for (const exerciseDoc of exercisesSnapshot.docs) {
                const logsCollection = collection(exerciseDoc.ref, 'logs');
                const logsSnapshot = await getDocs(logsCollection);
                logsSnapshot.forEach(logDoc => {
                  batch.delete(logDoc.ref);
                });
                batch.delete(exerciseDoc.ref);
              }
              
              batch.delete(routineRef);
              await batch.commit();

            } catch (error) {
              console.error("Erro ao deletar ficha: ", error);
              Alert.alert("Erro", "Não foi possível deletar a ficha.");
            }
            setActionLoading(null); 
          }
        }
      ]
    );
  };

  const handleDragEnd = async ({ data }: { data: Routine[] }) => {
  if (!user) return;
  // 1. Atualiza o estado local para a UI ficar instantânea
  setRoutines(data); 

  // 2. Prepara um "lote" de escritas no Firestore
  const batch = writeBatch(db);
  const userId = user.uid;

  // 3. Para cada item na nova ordem, atualiza o campo "order" no Firestore
  data.forEach((routine, index) => {
    const routineRef = doc(db, 'artifacts', appId, 'users', userId, 'routines', routine.id);
    batch.update(routineRef, { order: index });
  });

  // 4. Executa todas as atualizações de uma vez
  try {
    await batch.commit();
  } catch (error) {
    console.error("Erro ao reordenar fichas: ", error);
    Alert.alert("Erro", "Não foi possível salvar a nova ordem.");
  }
};

  const navigateToManageExercises = (routine: Routine) => {
    router.push({
      pathname: `/routine/${routine.id}`,
      params: { name: routine.name },
    });
  };

  // Funções de Backup/Import FORAM REMOVIDAS

  // ----- RENDERIZAÇÃO -----

  if (loading && !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Faça login para gerenciar suas fichas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={routineModalVisible}
        onRequestClose={() => setRoutineModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingRoutine ? "Editar Ficha" : "Nova Ficha"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Segunda: Peito/Tríceps"
              placeholderTextColor="#777"
              value={newRoutineName}
              onChangeText={setNewRoutineName}
            />
            {saveLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContainer}>
                <Pressable onPress={() => setRoutineModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <TouchableOpacity style={styles.buttonSmall} onPress={handleSaveRoutine}>
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Fichas</Text>
        {/* Botões de Importar/Exportar FORAM REMOVIDOS do header */}
        <Text style={styles.subtitle}>Clique em uma ficha para gerenciar seus exercícios.</Text>
      </View>

      <DraggableFlatList
        data={routines}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd} 
        style={styles.cardContainerPai}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => navigateToManageExercises(item)}
            >
              <Text style={styles.cardText}>{item.name}</Text>
              <Text style={styles.cardSubtext}>Gerenciar Exercícios →</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => openEditModal(item)}
              disabled={actionLoading === item.id}
            >
              <FontAwesome name="pencil" size={24} color="#007AFF" /> 
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={() => handleDeleteRoutine(item.id)}
              disabled={actionLoading === item.id} 
            >
              {actionLoading === item.id ? (
                <ActivityIndicator size="small" color="#FF4500" />
              ) : (
                <FontAwesome name="trash" size={24} color="#FF4500" />
              )}
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma ficha encontrada. Clique no + para adicionar.
          </Text>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={openAddModal}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerActions: { // Estilo não é mais usado, mas pode ficar
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'absolute',
    right: 20,
    top: 25,
  },
  actionButton: { // Estilo não é mais usado, mas pode ficar
    marginLeft: 20,
    padding: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#B0B0B0',
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  cardContainerPai:{
    marginBottom: 100,
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    flex: 1, 
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cardSubtext: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 5,
  },
  iconButton: {
    padding: 15, 
    width: 60, 
    alignItems: 'center'
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 30,
    color: 'white',
    lineHeight: 30, 
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
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonSmall: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelText: {
    color: '#FF4500',
    fontSize: 16,
  },
});