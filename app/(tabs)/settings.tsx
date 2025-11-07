import { FontAwesome } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appId, auth, db } from '../../firebaseConfig';

// Função Helper para deletar coleções aninhadas
async function deleteCollection(collectionRef: any, batch: any) {
  const snapshot = await getDocs(collectionRef);
  for (const doc of snapshot.docs) {
      // Deleta recursivamente sub-coleções de exercícios (logs)
      const logsCollection = collection(doc.ref, 'logs');
      const logsSnapshot = await getDocs(logsCollection);
      logsSnapshot.forEach(logDoc => {
          batch.delete(logDoc.ref);
      });
      // Deleta o exercício
      batch.delete(doc.ref);
  }
}

async function deleteSubCollections(collectionRef: any, batch: any) {
  const snapshot = await getDocs(collectionRef);
  for (const doc of snapshot.docs) {
      // Deleta recursivamente sub-coleções de fichas (exercises)
      const exercisesCollection = collection(doc.ref, 'exercises');
      await deleteCollection(exercisesCollection, batch); // Deleta logs e exercises
      // Deleta a ficha
      batch.delete(doc.ref);
  }
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Estados de Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
      if (!currentUser) {
        setEmail('');
        setPassword('');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Função de Auth
  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha email e senha.');
      return;
    }
    setAuthLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      Alert.alert('Erro de Autenticação', error.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  // --- Funções de Backup/Import ---
  const handleExport = async () => {
    if (!user) return;
    setLoading(true);
    Alert.alert('Exportando', 'Preparando seu backup...');
    const userId = user.uid;
    const backupData: { routines: any[] } = { routines: [] };
    try {
      const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
      const routinesSnapshot = await getDocs(query(routinesCollection, orderBy('order', 'asc'))); // Ordena por 'order'
      
      for (const routineDoc of routinesSnapshot.docs) {
        const routineData = { ...routineDoc.data(), exercises: [] as any[] };
        const exercisesCollection = collection(routineDoc.ref, 'exercises');
        const exercisesSnapshot = await getDocs(query(exercisesCollection, orderBy('order', 'asc'))); // Ordena por 'order'
        
        for (const exerciseDoc of exercisesSnapshot.docs) {
          const exerciseData = { ...exerciseDoc.data(), logs: [] as any[] };
          const logsCollection = collection(exerciseDoc.ref, 'logs');
          const logsSnapshot = await getDocs(query(logsCollection, orderBy('createdAt', 'asc')));
          exerciseData.logs = logsSnapshot.docs.map(logDoc => logDoc.data());
          routineData.exercises.push(exerciseData);
        }
        backupData.routines.push(routineData);
      }
      const jsonString = JSON.stringify(backupData, null, 2);
      const uri = FileSystem.documentDirectory + 'evofit_backup.json';
      await FileSystem.writeAsStringAsync(uri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });
      setLoading(false);
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('Erro ao exportar: ', error);
      Alert.alert('Erro', 'Não foi possível gerar o backup.');
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!user) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const jsonString = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const backupData = JSON.parse(jsonString);
      if (!backupData.routines) { throw new Error("Arquivo JSON inválido. 'routines' não encontrado."); }
      Alert.alert(
        'Importar Backup',
        'Isso irá ADICIONAR os treinos do arquivo. Treinos existentes não serão afetados. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Importar', 
            onPress: async () => {
              setLoading(true);
              const userId = user.uid;
              const batch = writeBatch(db);

              // *** AQUI ESTÁ A CORREÇÃO ***
              backupData.routines.forEach((routine: any, index: number) => {
                const routineRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'routines'));
                
                batch.set(routineRef, { 
                  name: routine.name, 
                  createdAt: serverTimestamp(), 
                  order: routine.order ?? index // Usa o 'order' do JSON, ou o 'index'
                });

                if (routine.exercises && Array.isArray(routine.exercises)) {
                  routine.exercises.forEach((exercise: any, exIndex: number) => {
                    const exerciseRef = doc(collection(routineRef, 'exercises'));
                    
                    batch.set(exerciseRef, { 
                      name: exercise.name, 
                      sets: exercise.sets, 
                      createdAt: serverTimestamp(), 
                      order: exercise.order ?? exIndex // Usa o 'order' do JSON, ou o 'index'
                    });
                    // Não importamos os logs para manter o backup limpo
                  });
                }
              });
              // *** FIM DA CORREÇÃO ***
              
              await batch.commit();
              setLoading(false);
              Alert.alert('Sucesso', 'Treinos importados com sucesso!');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Erro ao importar: ', error);
      Alert.alert('Erro', `Não foi possível importar o arquivo. ${error.message}`);
      setLoading(false);
    }
  };

  // --- Funções de "Zona de Perigo" ---
  const handleDeleteLogs = () => {
    if (!user) return;
    Alert.alert(
      'Apagar Todos os Registros',
      'Tem certeza? Isso apagará TODO o seu histórico de pesos e repetições (logs) de TODOS os exercícios. As fichas e exercícios serão mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Apagar Registros', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const userId = user.uid;
              const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
              const routinesSnapshot = await getDocs(routinesCollection);
              const batch = writeBatch(db);

              for (const routineDoc of routinesSnapshot.docs) {
                const exercisesCollection = collection(routineDoc.ref, 'exercises');
                const exercisesSnapshot = await getDocs(exercisesCollection);
                for (const exerciseDoc of exercisesSnapshot.docs) {
                  const logsCollection = collection(exerciseDoc.ref, 'logs');
                  const logsSnapshot = await getDocs(logsCollection);
                  logsSnapshot.forEach(logDoc => {
                    batch.delete(logDoc.ref);
                  });
                }
              }
              await batch.commit();
              Alert.alert('Sucesso', 'Todos os registros de progresso foram apagados.');
            } catch (error) {
              console.error('Erro ao apagar logs: ', error);
              Alert.alert('Erro', 'Não foi possível apagar os registros.');
            }
            setLoading(false);
          }
        }
      ]
    );
  };
  
  const handleDeleteAll = () => {
    if (!user) return;
    Alert.alert(
      'Apagar TUDO',
      'TEM CERTEZA? Isso apagará TODAS as suas fichas, exercícios e registros. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Apagar Tudo', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const userId = user.uid;
              const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
              const batch = writeBatch(db);
              
              // Função recursiva para deletar subcoleções
              await deleteSubCollections(routinesCollection, batch);
              
              await batch.commit();
              Alert.alert('Sucesso', 'Todos os seus dados de treino foram apagados.');
            } catch (error) {
              console.error('Erro ao apagar tudo: ', error);
              Alert.alert('Erro', 'Não foi possível apagar seus dados.');
            }
            setLoading(false);
          }
        }
      ]
    );
  };


  // ----- RENDERIZAÇÃO -----
  
  if (initialLoading) {
     return (
       <SafeAreaView style={styles.container}>
         <ActivityIndicator size="large" color="#FFFFFF" style={{ flex: 1 }} />
       </SafeAreaView>
     );
  }

  // Se NÃO estiver logado
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.authContainer}
        >
          <Text style={styles.title}>EvoFit</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Login' : 'Criar Conta'}</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Senha"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType={isLogin ? 'password' : 'newPassword'}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <FontAwesome name={showPassword ? 'eye-slash' : 'eye'} size={20} color="#777" />
            </Pressable>
          </View>
          
          {authLoading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <TouchableOpacity style={styles.buttonAuth} onPress={handleAuth}>
              <Text style={styles.buttonText}>{isLogin ? 'Entrar' : 'Registrar'}</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleAuth}>
            <Text style={styles.toggleAuthText}>
              {isLogin ? 'Não tem uma conta? Crie uma' : 'Já tem uma conta? Faça login'}
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Se ESTIVER logado
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Configurações</Text>
        </View>
        
        {/* Seção Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <Text style={styles.emailText}>Logado como: {user.email}</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF4500' }]} 
            onPress={handleLogout}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <FontAwesome name="sign-out" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Sair</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Seção Backup */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup e Restauração</Text>
          <Text style={styles.sectionSubtitle}>
            Salve ou importe suas fichas e exercícios. Os registros de peso não são incluídos no backup.
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007AFF' }]} 
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <FontAwesome name="download" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Exportar (Backup)</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#34C759', marginTop: 15 }]} 
            onPress={handleImport}
            disabled={loading}
          >
             {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <FontAwesome name="upload" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Importar (Restaurar)</Text>
              </>
             )}
          </TouchableOpacity>
        </View>

        {/* Seção Zona de Perigo */}
        <View style={[styles.section, { borderColor: '#FF4500' }]}>
          <Text style={[styles.sectionTitle, { color: '#FF4500' }]}>Zona de Perigo</Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FFA500', marginTop: 15 }]} 
            onPress={handleDeleteLogs}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <FontAwesome name="eraser" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Apagar TODOS os Registros</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF4500', marginTop: 15 }]} 
            onPress={handleDeleteAll}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <FontAwesome name="trash" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Apagar TUDO (Fichas e Registros)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: { // Usado para "Faça login..."
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  
  // Estilos de Auth
  authContainer: {
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
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
  buttonAuth: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleAuth: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleAuthText: {
    color: '#007AFF',
    fontSize: 16,
  },
  
  // Estilos das Seções
  header: {
    padding: 20,
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
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#B0B0B0',
    marginBottom: 25,
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
