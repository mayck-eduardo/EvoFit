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
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. Importações do Firestore (agora mais simples)
import { 
  collection, 
  onSnapshot, 
  query, 
  getDocs,
  orderBy
} from 'firebase/firestore'; 
import { db, auth, appId } from '../../firebaseConfig';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { FontAwesome } from '@expo/vector-icons'; 
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// 2. A interface não muda
export interface Routine {
  id: string;
  name: string;
  createdAt?: { seconds: number };
}

export default function HomeScreen() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  // Formulário de Login (não muda)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  // 3. REMOVIDO o state do modal de Ficha
  // const [routineModalVisible, setRoutineModalVisible] = useState(false);
  // const [newRoutineName, setNewRoutineName] = useState('');
  // const [saveLoading, setSaveLoading] = useState(false); 

  const [actionLoading, setActionLoading] = useState(false); // Mantido para o Backup/Import

  // useEffect de auth (não muda)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // useEffect de buscar dados (não muda)
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

  // Funções de Auth (Login/Cadastro) - (não mudam)
  const handleAuthError = (error: any) => {
    console.error(error.code, error.message);
    if (error.code === 'auth/email-already-in-use') {
      Alert.alert("Erro", "Este email já está em uso.");
    } else if (error.code === 'auth/invalid-email') {
      Alert.alert("Erro", "Email inválido.");
    } else if (error.code === 'auth/weak-password') {
      Alert.alert("Erro", "Senha fraca. A senha deve ter no mínimo 6 caracteres.");
    } else if (error.code === 'auth/invalid-credential') {
      Alert.alert("Erro", "Email ou senha incorretos.");
    } else {
      Alert.alert("Erro", "Ocorreu um erro. Tente novamente.");
    }
  }
  const handleLogin = () => {
    if (!email || !password) return;
    setFormLoading(true);
    signInWithEmailAndPassword(auth, email, password)
      .catch(handleAuthError)
      .finally(() => setFormLoading(false));
  };
  const handleSignUp = () => {
    if (!email || !password) return;
    setFormLoading(true);
    createUserWithEmailAndPassword(auth, email, password)
      .catch(handleAuthError)
      .finally(() => setFormLoading(false));
  };

  // 4. REMOVIDAS as funções handleSaveRoutine e handleDeleteRoutine
  
  // Funções de Exportação/Importação (não mudam)
  const handleExport = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const backupData: { routines: any[] } = { routines: [] };
      const userId = user.uid;
      const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
      const routinesSnapshot = await getDocs(routinesCollection);
      for (const routineDoc of routinesSnapshot.docs) {
        const { id, exercises, ...routineData } = { id: routineDoc.id, ...routineDoc.data(), exercises: [] }; 
        const currentRoutine = routineData;
        (currentRoutine as any).exercises = [];
        const exercisesCollection = collection(routineDoc.ref, 'exercises');
        const exercisesSnapshot = await getDocs(exercisesCollection);
        for (const exerciseDoc of exercisesSnapshot.docs) {
          const { id, logs, ...exerciseData } = { id: exerciseDoc.id, ...exerciseDoc.data(), logs: [] };
          const currentExercise = exerciseData;
          (currentExercise as any).logs = [];
          const logsCollection = collection(exerciseDoc.ref, 'logs');
          const logsSnapshot = await getDocs(logsCollection);
          logsSnapshot.forEach(logDoc => {
            const { id, ...logData } = { id: logDoc.id, ...logDoc.data() };
            (currentExercise as any).logs.push(logData);
          });
          (currentRoutine as any).exercises.push(currentExercise);
        }
        backupData.routines.push(currentRoutine);
      }
      const fileUri = FileSystem.cacheDirectory + 'evofit_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Salvar Backup do EvoFit',
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao exportar backup.");
    }
    setActionLoading(false);
  };
  const handleImport = async () => {
    if (!user) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      const backupData = JSON.parse(fileContent);
      const userId = user.uid;
      if (!backupData.routines) {
        Alert.alert("Erro", "Arquivo de backup inválido.");
        return;
      }
      Alert.alert(
        "Confirmar Importação",
        "Isso irá ADICIONAR os treinos do backup. Treinos existentes não serão apagados. Deseja continuar?",
        [
          { text: "Cancelar" },
          { 
            text: "Confirmar", 
            onPress: async () => {
              setActionLoading(true);
              try {
                // Precisamos importar 'addDoc' e 'serverTimestamp' para esta função
                const { addDoc, serverTimestamp } = await import('firebase/firestore');
                
                const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
                for (const routine of backupData.routines) {
                  const { exercises, ...routineData } = routine; 
                  const dataToSave = routineData.createdAt ? routineData : { ...routineData, createdAt: serverTimestamp() };
                  const routineRef = await addDoc(routinesCollection, dataToSave);
                  
                  if (exercises) {
                    for (const exercise of exercises) {
                      const { logs, ...exerciseData } = exercise;
                      const exDataToSave = exerciseData.createdAt ? exerciseData : { ...exerciseData, createdAt: serverTimestamp() };
                      const exerciseRef = await addDoc(collection(routineRef, 'exercises'), exDataToSave);
                      
                      if (logs) {
                        for (const log of logs) {
                          const logDataToSave = log.createdAt ? log : { ...log, createdAt: serverTimestamp() };
                          await addDoc(collection(exerciseRef, 'logs'), logDataToSave);
                        }
                      }
                    }
                  }
                }
                Alert.alert("Sucesso", "Backup importado! As novas fichas aparecerão em breve.");
              } catch (e) {
                Alert.alert("Erro", "Falha ao importar o backup.");
                console.error(e);
              }
              setActionLoading(false);
            }
          }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Erro", "Falha ao ler o arquivo.");
    }
  };

  // ----- RENDERIZAÇÃO -----

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // Tela de Login (não muda)
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginContainer}>
          <Text style={styles.title}>EvoFit</Text>
          <Text style={styles.subtitle}>
            {isRegistering ? 'Crie sua conta' : 'Acesse para continuar'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress" 
            autoComplete="email" 
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Senha"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword} 
              textContentType="password" 
              autoComplete="password" 
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          {formLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginVertical: 20 }} />
          ) : isRegistering ? (
            <TouchableOpacity style={styles.button} onPress={handleSignUp}>
              <Text style={styles.buttonText}>Criar Conta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          )}
          <Pressable onPress={() => setIsRegistering(!isRegistering)}>
            <Text style={styles.toggleText}>
              {isRegistering
                ? 'Já tem uma conta? Fazer Login'
                : 'Não tem uma conta? Criar conta'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Tela de Fichas (Logado) - (LIMPA)
  return (
    <SafeAreaView style={styles.container}>
      {/* 5. REMOVIDO o Modal de Adicionar Ficha */}

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>EvoFit</Text>
          {actionLoading ? (
            <ActivityIndicator color="#FFFFFF" style={{ paddingHorizontal: 20 }}/>
          ) : (
            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={handleImport} style={styles.iconButton}>
                <FontAwesome name="upload" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleExport} style={styles.iconButton}>
                <FontAwesome name="download" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Pressable onPress={() => auth.signOut()} style={styles.iconButton}>
                <Text style={styles.logoutText}>Sair</Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Selecione seu treino do dia:</Text>
        <Text style={styles.userIdText}>Logado como: {user.email}</Text>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          // 6. REMOVIDO o View e o botão de deletar
          <Link
            href={{
              pathname: `/routine/${item.id}`,
              params: { name: item.name },
            }}
            asChild
            style={{ flex: 1 }} 
          >
            <TouchableOpacity style={styles.card}>
              <Text style={styles.cardText}>{item.name}</Text>
            </TouchableOpacity>
          </Link>
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma ficha encontrada. Vá na aba "Editar" para adicionar.
          </Text>
        }
      />

      {/* 7. REMOVIDO o FAB (Botão +) */}
      
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
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
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleText: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF4500',
    fontSize: 16,
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
  // 8. REMOVIDO 'cardContainer'
  card: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    flex: 1, 
    marginBottom: 16, // Adicionado margin aqui
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  // 9. REMOVIDO 'deleteButton'
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  userIdText: {
    color: '#555',
    fontSize: 12,
    marginTop: 10,
  },
  // 10. REMOVIDOS estilos 'fab', 'modal...'
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
  },
  inputPassword: {
    flex: 1,
    color: '#FFFFFF',
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    paddingLeft: 20, 
  }
});