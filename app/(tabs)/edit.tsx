import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Pressable,
  Modal, 
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. Importações completas do Firestore
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp,
  getDocs,
  deleteDoc, 
  writeBatch, 
  doc,
  orderBy
} from 'firebase/firestore'; 
import { db, auth, appId } from '../../firebaseConfig';
import { User, onAuthStateChanged } from 'firebase/auth';
import { FontAwesome } from '@expo/vector-icons'; 

export interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}

// 2. Este é um novo componente
export default function EditScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  // Modal de Ficha
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false); 

  const [actionLoading, setActionLoading] = useState<string | null>(null); // 'string' para saber qual item está carregando

  // useEffect de auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // useEffect de buscar dados (ordenado)
  useEffect(() => {
    if (!user) {
      setRoutines([]);
      return;
    }
    setLoading(true);
    const userId = user.uid;
    const userRoutinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
    const q = query(userRoutinesCollection, orderBy("createdAt", "asc"));

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

  // Salvar Nova Ficha
  const handleSaveRoutine = async () => {
    if (!user || !newRoutineName) {
      Alert.alert("Erro", "Digite um nome para a ficha.");
      return;
    }
    setSaveLoading(true);
    try {
      const userId = user.uid;
      const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
      
      await addDoc(routinesCollection, {
        name: newRoutineName,
        createdAt: serverTimestamp() 
      });
      
      setNewRoutineName('');
      setRoutineModalVisible(false);
    } catch (error) {
      console.error("Erro ao salvar ficha: ", error);
      Alert.alert("Erro", "Não foi possível salvar a ficha.");
    }
    setSaveLoading(false);
  };

  // Deletar Ficha
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
            setActionLoading(routineId); // Ativa o loading para este item
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
            setActionLoading(null); // Desativa o loading
          }
        }
      ]
    );
  };

  // ----- RENDERIZAÇÃO -----

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // Se não estiver logado
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emptyText}>Faça login na aba "Fichas" para editar seus treinos.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Tela de Edição (Logado)
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
            <Text style={styles.modalTitle}>Nova Ficha</Text>
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
        <Text style={styles.title}>Editar Fichas</Text>
        <Text style={styles.subtitle}>Adicione ou remova suas fichas de treino.</Text>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            {/* O card não é mais um link aqui */}
            <View style={styles.card}>
              <Text style={styles.cardText}>{item.name}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => handleDeleteRoutine(item.id)}
              disabled={actionLoading === item.id} // Desativa o botão específico
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
        onPress={() => setRoutineModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Estilos (copiados de 'index.tsx' e adaptados)
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
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    flex: 1, // Ocupa o espaço
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 20, 
    width: 60, // Largura fixa para o loading não pular a tela
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