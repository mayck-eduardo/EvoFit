// app/(tabs)/settings.tsx

import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
// 1. AQUI ESTÁ A CORREÇÃO:
import { Picker } from '@react-native-picker/picker';

// --- Interfaces ---
interface UserProfile {
  email: string;
  photoURL?: string; 
  height?: number; 
  weight?: number; 
  birthdate?: string; 
  gender?: 'male' | 'female' | 'other';
}

const AVATARS: (keyof typeof FontAwesome.glyphMap)[] = [
  'user', 'user-circle', 'user-md', 'rocket', 'music', 'gamepad', 'heart', 'star'
];


// --- Funções Helper (Delete) ---
async function deleteCollection(collectionRef: any, batch: any) {
  const snapshot = await getDocs(collectionRef);
  for (const doc of snapshot.docs) {
      const logsCollection = collection(doc.ref, 'logs');
      const logsSnapshot = await getDocs(logsCollection);
      logsSnapshot.forEach(logDoc => {
          batch.delete(logDoc.ref);
      });
      batch.delete(doc.ref);
  }
}
async function deleteSubCollections(collectionRef: any, batch: any) {
  const snapshot = await getDocs(collectionRef);
  for (const doc of snapshot.docs) {
      const exercisesCollection = collection(doc.ref, 'exercises');
      await deleteCollection(exercisesCollection, batch);
      batch.delete(doc.ref);
  }
}

// --- Componente ---
export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] =useState<User | null>(auth.currentUser);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Prefs
  const [timerInput, setTimerInput] = useState('90'); 

  // Perfil
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthdate, setBirthdate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('user'); 

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // --- Funções de Carregamento ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
      if (!currentUser) {
        setProfile(null);
        setEmail('');
        setPassword('');
      } else {
        loadTimerPreference(); 
        loadUserProfile(currentUser.uid); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const loadTimerPreference = async () => {
    try {
      const savedTimer = await AsyncStorage.getItem('@EvoFit:timerDefault');
      if (savedTimer) {
        setTimerInput(savedTimer);
      }
    } catch (e) {
      console.error("Erro ao carregar timer pref: ", e);
    }
  };

  const loadUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        setHeight(data.height?.toString() || '');
        setWeight(data.weight?.toString() || '');
        setGender(data.gender || 'male');
        setBirthdate(data.birthdate ? new Date(data.birthdate) : new Date(2000, 0, 1));
        setSelectedAvatar(data.photoURL || 'user');
      }
    } catch (error) {
      console.error("Erro ao carregar perfil: ", error);
    }
  };

  // --- Funções de Ação ---
  
  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
      const dataToSave = {
        height: parseFloat(height) || 0,
        weight: parseFloat(weight) || 0,
        gender: gender,
        birthdate: birthdate.toISOString().split('T')[0],
        photoURL: selectedAvatar 
      };
      
      await setDoc(userRef, dataToSave, { merge: true });
      
      setProfile(prev => ({ ...prev, ...dataToSave, email: prev?.email || user.email! }));
      
      Alert.alert("Sucesso", "Perfil salvo!");
    } catch (error) {
      console.error("Erro ao salvar perfil: ", error);
      Alert.alert("Erro", "Não foi possível salvar o perfil.");
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword) {
      Alert.alert("Erro", "Preencha a senha atual e a nova senha.");
      return;
    }
    setAuthLoading(true);
    
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      Alert.alert("Sucesso!", "Sua senha foi alterada.");
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      console.error("Erro ao alterar senha: ", error);
      if (error.code === 'auth/wrong-password') {
        Alert.alert("Erro", "A senha atual está incorreta.");
      } else {
        Alert.alert("Erro", error.message);
      }
    }
    setAuthLoading(false);
  };
  
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
  const handleSaveTimer = async () => {
    const timerValue = parseInt(timerInput, 10);
    if (isNaN(timerValue) || timerValue <= 0) {
      Alert.alert("Erro", "Por favor, insira um número válido em segundos.");
      return;
    }
    
    try {
      await AsyncStorage.setItem('@EvoFit:timerDefault', timerInput);
      Alert.alert("Sucesso", `Tempo de descanso salvo: ${timerInput} segundos.`);
    } catch (e) {
      console.error("Erro ao salvar timer pref: ", e);
      Alert.alert("Erro", "Não foi possível salvar a preferência.");
    }
  };
  const handleExport = async () => {
    if (!user) return;
    setLoading(true);
    Alert.alert('Exportando', 'Preparando seu backup...');
    const userId = user.uid;
    const backupData: { routines: any[] } = { routines: [] };
    try {
      const routinesCollection = collection(db, 'artifacts', appId, 'users', userId, 'routines');
      const routinesSnapshot = await getDocs(query(routinesCollection, orderBy('order', 'asc'))); 
      
      for (const routineDoc of routinesSnapshot.docs) {
        const routineData = { ...routineDoc.data(), exercises: [] as any[] };
        const exercisesCollection = collection(routineDoc.ref, 'exercises');
        const exercisesSnapshot = await getDocs(query(exercisesCollection, orderBy('order', 'asc'))); 
        
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
              
              backupData.routines.forEach((routine: any, index: number) => {
                const routineRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'routines'));
                batch.set(routineRef, { 
                  name: routine.name, 
                  createdAt: serverTimestamp(), 
                  order: routine.order ?? index 
                });
                if (routine.exercises && Array.isArray(routine.exercises)) {
                  routine.exercises.forEach((exercise: any, exIndex: number) => {
                    const exerciseRef = doc(collection(routineRef, 'exercises'));
                    batch.set(exerciseRef, { 
                      name: exercise.name, 
                      sets: exercise.sets, 
                      createdAt: serverTimestamp(), 
                      order: exercise.order ?? exIndex 
                    });
                  });
                }
              });
              
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
  const handleDeleteLogs = () => {
    if (!user) return;
    Alert.alert(
      'Apagar Todos os Registros',
      'Tem certeza? Isso apagará TODO o seu histórico de pesos e repetições (logs) de TODOS os exercícios.',
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
              await deleteSubCollections(routinesCollection, batch);
              await batch.commit();
              Alert.alert('Sucesso', 'Todos os seus dados de treino foram apagados.');
            } catch (error) {
              console.error('Erro ao apagar tudo: ', error);
            }
            setLoading(false);
          }
        }
      ]
    );
  };
  
  const calculateBMI = () => {
    if (profile?.height && profile.weight) {
      const heightInMeters = profile.height / 100;
      const bmi = profile.weight / (heightInMeters * heightInMeters);
      return bmi.toFixed(1); 
    }
    return null;
  };
  
  const calculateAge = () => {
    if (profile?.birthdate) {
      const birthDate = new Date(profile.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    return null;
  };
  
  // --- Valores Calculados ---
  const bmi = calculateBMI();
  const age = calculateAge();

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
        
        <View style={styles.profileSection}>
          <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
            <FontAwesome name={profile?.photoURL as any || 'user'} size={60} color="#FFFFFF" />
          </View>
          
          <View style={styles.profileText}>
            <Text style={styles.emailText}>{user.email}</Text>
            {age != null && <Text style={styles.infoText}>Idade: {age} anos</Text>}
            {bmi != null && <Text style={styles.infoText}>IMC: {bmi}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Físicos</Text>
          
          <Text style={styles.label}>Avatar</Text>
          <View style={styles.avatarContainer}>
            {AVATARS.map(iconName => (
              <TouchableOpacity
                key={iconName}
                style={[
                  styles.avatarButton,
                  selectedAvatar === iconName && styles.avatarSelected 
                ]}
                onPress={() => setSelectedAvatar(iconName)}
              >
                <FontAwesome name={iconName} size={30} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 180"
            placeholderTextColor="#777"
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 80.5"
            placeholderTextColor="#777"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Data de Nascimento</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            <Text style={styles.dateText}>{birthdate.toLocaleDateString('pt-BR')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={birthdate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                setBirthdate(selectedDate || birthdate);
              }}
            />
          )}

          <Text style={styles.label}>Sexo</Text>
           <View style={styles.pickerContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.picker}
              dropdownIconColor="#FFFFFF"
            >
              <Picker.Item label="Masculino" value="male" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
              <Picker.Item label="Feminino" value="female" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
              <Picker.Item label="Outro" value="other" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
            </Picker>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007AFF', marginTop: 20 }]} 
            onPress={handleSaveProfile}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Salvar Dados</Text>}
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          
          <Text style={styles.label}>Senha Atual</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua senha atual"
            placeholderTextColor="#777"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#777"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007AFF' }]} 
            onPress={handleChangePassword}
            disabled={authLoading}
          >
            {authLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Alterar Senha</Text>}
          </TouchableOpacity>
          
          <View style={styles.separator} />
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF4500' }]} 
            onPress={handleLogout}
            disabled={loading}
          >
            <FontAwesome name="sign-out" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferências</Text>
          <Text style={styles.label}>Tempo de Descanso (segundos)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 90"
            placeholderTextColor="#777"
            value={timerInput}
            onChangeText={setTimerInput}
            keyboardType="number-pad"
          />
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#007AFF' }]} 
            onPress={handleSaveTimer}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Salvar Tempo</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup e Restauração</Text>
          <Text style={styles.sectionSubtitle}>
            Salve ou importe suas fichas e exercícios (mas não os logs de progresso).
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
        
        <View style={{ height: 50 }} />
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
  content: { 
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
    marginBottom: 15, 
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#B0B0B0',
    marginBottom: 25,
    lineHeight: 22,
  },
  emailText: {
    fontSize: 18, 
    color: '#FFFFFF', 
    fontWeight: '500',
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
  label: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 10,
    marginTop: 5, 
  },
  separator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },

  // Perfil (Atualizado)
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
    marginLeft: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#B0B0B0', 
    marginBottom: 5,
  },

  // Seleção de Avatar (NOVOS)
  avatarContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  avatarButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: '#007AFF', 
    backgroundColor: '#555',
  },

  // DatePicker e Picker
  dateButton: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF', 
    height: 60,
  },
});