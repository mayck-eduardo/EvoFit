import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// ... Imports Firebase e outros iguais ...
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { EmailAuthProvider, User, onAuthStateChanged, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import AuthForm from '../../components/AuthForm'; // 1. Importa AuthForm
import { appId, auth, db } from '../../firebaseConfig';

// ... Interfaces e Constantes iguais ...
interface UserProfile { email: string; photoURL?: string; height?: number; weight?: number; birthdate?: string; gender?: 'male' | 'female' | 'other'; }
interface TrainingPlan { id: string; name: string; }
const AVATARS: (keyof typeof FontAwesome.glyphMap)[] = ['user', 'user-circle', 'user-md', 'rocket', 'music', 'gamepad', 'heart', 'star'];

// ... Funções Helper iguais ...
async function deleteCollection(collectionRef: any, batch: any) { /* ... */ }
async function deleteSubCollections(collectionRef: any, batch: any) { /* ... */ }

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] =useState<User | null>(auth.currentUser);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Auth (Estados removidos, agora no componente)

  // Prefs
  const [timerInput, setTimerInput] = useState('90'); 
  const [completionMode, setCompletionMode] = useState<'any' | 'full'>('any'); 
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [timerSound, setTimerSound] = useState(true);
  const [simpleMode, setSimpleMode] = useState(false);
  const [showReportsTab, setShowReportsTab] = useState(true);

  // Planos e Perfil
  const [plans, setPlans] = useState<TrainingPlan[]>([{ id: 'default', name: 'Padrão (Atual)' }]);
  const [currentPlanId, setCurrentPlanId] = useState('default');
  const [newPlanName, setNewPlanName] = useState('');
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [birthdate, setBirthdate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('user'); 
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false); // Para a troca de senha

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitialLoading(false); 
      if (currentUser) {
        loadPreferences(); 
        loadUserProfile(currentUser.uid); 
        loadPlans(currentUser.uid);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // ... Funções de Load/Save Prefs e Perfil (iguais) ...
  const loadPreferences = async () => { /* ... Mesmo código ... */
      try {
      const savedTimer = await AsyncStorage.getItem('@EvoFit:timerDefault');
      if (savedTimer) setTimerInput(savedTimer);
      const savedMode = await AsyncStorage.getItem('@EvoFit:completionMode');
      if (savedMode) setCompletionMode(savedMode as any);
      const savedUnit = await AsyncStorage.getItem('@EvoFit:weightUnit');
      if (savedUnit) setWeightUnit(savedUnit as any);
      const savedSound = await AsyncStorage.getItem('@EvoFit:timerSound');
      if (savedSound !== null) setTimerSound(savedSound === 'true');
      const savedSimple = await AsyncStorage.getItem('@EvoFit:simpleMode');
      if (savedSimple !== null) setSimpleMode(savedSimple === 'true');
      const savedShowReports = await AsyncStorage.getItem('@EvoFit:showReportsTab');
      setShowReportsTab(savedShowReports === null ? true : savedShowReports === 'true');
      const savedPlan = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      if (savedPlan) setCurrentPlanId(savedPlan);
    } catch (e) { console.error(e); }
  };
  const loadPlans = async (uid: string) => { /* ... Mesmo código ... */ 
    try {
      const plansRef = collection(db, 'artifacts', appId, 'users', uid, 'plans_meta');
      const snapshot = await getDocs(plansRef);
      const loadedPlans: TrainingPlan[] = [{ id: 'default', name: 'Padrão (Atual)' }];
      snapshot.forEach(doc => { loadedPlans.push({ id: doc.id, ...doc.data() } as TrainingPlan); });
      setPlans(loadedPlans);
    } catch (e) { console.error(e); }
  };
  const handleCreatePlan = async () => { /* ... Mesmo código ... */ 
     if (!user || !newPlanName.trim()) { Alert.alert("Atenção", "Nome inválido."); return; }
    setLoading(true);
    try {
      const plansRef = collection(db, 'artifacts', appId, 'users', user.uid, 'plans_meta');
      const newDoc = await addDoc(plansRef, { name: newPlanName, createdAt: serverTimestamp() });
      setPlans([...plans, { id: newDoc.id, name: newPlanName }]);
      setNewPlanName('');
      setPlanModalVisible(false);
      Alert.alert("Sucesso", "Plano criado!");
    } catch (e: any) { Alert.alert("Erro", e.message); }
    setLoading(false);
  };
  const loadUserProfile = async (uid: string) => { /* ... Mesmo código ... */ 
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
    } catch (error) { console.error(error); }
  };
  const handleSaveProfile = async () => { /* ... Mesmo código ... */ 
     if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
      const dataToSave = { height: parseFloat(height) || 0, weight: parseFloat(weight) || 0, gender: gender, birthdate: birthdate.toISOString().split('T')[0], photoURL: selectedAvatar };
      await setDoc(userRef, dataToSave, { merge: true });
      setProfile(prev => ({ ...prev, ...dataToSave, email: prev?.email || user.email! }));
      Alert.alert("Sucesso", "Perfil salvo!");
    } catch (error) { Alert.alert("Erro", "Falha ao salvar."); }
    setLoading(false);
  };
  const handleChangePassword = async () => { /* ... Mesmo código ... */ 
    if (!user || !currentPassword || !newPassword) { Alert.alert("Erro", "Preencha as senhas."); return; }
    setAuthLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Sucesso!", "Senha alterada.");
      setCurrentPassword(''); setNewPassword('');
    } catch (error: any) { Alert.alert("Erro", error.message); }
    setAuthLoading(false);
  };
  const handleLogout = () => { signOut(auth); };
  const handleSavePreferences = async () => { /* ... Mesmo código ... */ 
     const timerValue = parseInt(timerInput, 10);
    if (isNaN(timerValue) || timerValue <= 0) { Alert.alert("Erro", "Tempo inválido."); return; }
    setLoading(true);
    try {
      await AsyncStorage.setItem('@EvoFit:timerDefault', timerInput);
      await AsyncStorage.setItem('@EvoFit:completionMode', completionMode);
      await AsyncStorage.setItem('@EvoFit:weightUnit', weightUnit);
      await AsyncStorage.setItem('@EvoFit:timerSound', String(timerSound));
      await AsyncStorage.setItem('@EvoFit:simpleMode', String(simpleMode));
      await AsyncStorage.setItem('@EvoFit:showReportsTab', String(showReportsTab));
      await AsyncStorage.setItem('@EvoFit:currentPlanId', currentPlanId);
      Alert.alert("Sucesso", "Preferências salvas!");
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  const handleExport = async () => { /* ... Mesmo código ... */ };
  const handleImport = async () => { /* ... Mesmo código ... */ };
  const handleDeleteLogs = () => { /* ... Mesmo código ... */ };
  const handleDeleteAll = () => { /* ... Mesmo código ... */ };
  const calculateBMI = () => { /* ... Mesmo código ... */ 
     if (profile?.height && profile.weight) {
      const heightInMeters = profile.height / 100;
      const bmi = profile.weight / (heightInMeters * heightInMeters);
      return bmi.toFixed(1); 
    }
    return null;
  };
  const calculateAge = () => { /* ... Mesmo código ... */ 
    if (profile?.birthdate) {
      const birthDate = new Date(profile.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return age;
    }
    return null;
  };
  const bmi = calculateBMI();
  const age = calculateAge();

  if (initialLoading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#FFFFFF" /></SafeAreaView>;

  // 2. SE NÃO ESTIVER LOGADO, USA O AUTHFORM
  if (!user) {
    return (
      <View style={styles.container}>
        <AuthForm />
      </View>
    );
  }

  // Se ESTIVER logado (Mantém o JSX das configurações)
  return (
    <SafeAreaView style={styles.container}>
       {/* Modal Plano */}
       <Modal animationType="slide" transparent={true} visible={planModalVisible} onRequestClose={() => setPlanModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Plano de Treino</Text>
            <TextInput style={styles.input} placeholder="Nome (Ex: Treino de Força)" placeholderTextColor="#777" value={newPlanName} onChangeText={setNewPlanName} />
            <View style={styles.buttonContainer}>
              <Pressable onPress={() => setPlanModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <TouchableOpacity style={styles.buttonSmall} onPress={handleCreatePlan}><Text style={styles.buttonText}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

        {/* Seção Planos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plano de Treino Ativo</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={currentPlanId} onValueChange={(itemValue) => setCurrentPlanId(itemValue)} style={styles.picker} dropdownIconColor="#FFFFFF">
              {plans.map(p => (<Picker.Item key={p.id} label={p.name} value={p.id} color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />))}
            </Picker>
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#333', marginTop: 10, borderWidth: 1, borderColor: '#555' }]} onPress={() => setPlanModalVisible(true)}>
            <FontAwesome name="plus" size={16} color="#FFF" /><Text style={styles.buttonText}>Criar Novo Plano</Text>
          </TouchableOpacity>
        </View>

        {/* Dados Físicos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Físicos</Text>
          <Text style={styles.label}>Avatar</Text>
          <View style={styles.avatarContainer}>
            {AVATARS.map(iconName => (
              <TouchableOpacity key={iconName} style={[styles.avatarButton, selectedAvatar === iconName && styles.avatarSelected]} onPress={() => setSelectedAvatar(iconName)}>
                <FontAwesome name={iconName} size={30} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput style={styles.input} placeholder="Ex: 180" placeholderTextColor="#777" value={height} onChangeText={setHeight} keyboardType="number-pad" />
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput style={styles.input} placeholder="Ex: 80.5" placeholderTextColor="#777" value={weight} onChangeText={setWeight} keyboardType="numeric" />
          <Text style={styles.label}>Data de Nascimento</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}><Text style={styles.dateText}>{birthdate.toLocaleDateString('pt-BR')}</Text></TouchableOpacity>
          {showDatePicker && (<DateTimePicker value={birthdate} mode="date" display="default" onChange={(event, selectedDate) => { setShowDatePicker(false); setBirthdate(selectedDate || birthdate); }} />)}
          <Text style={styles.label}>Sexo</Text>
           <View style={styles.pickerContainer}>
            <Picker selectedValue={gender} onValueChange={(itemValue) => setGender(itemValue)} style={styles.picker} dropdownIconColor="#FFFFFF">
              <Picker.Item label="Masculino" value="male" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} /><Picker.Item label="Feminino" value="female" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} /><Picker.Item label="Outro" value="other" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
            </Picker>
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#007AFF', marginTop: 20 }]} onPress={handleSaveProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Salvar Dados</Text>}
          </TouchableOpacity>
        </View>
        
        {/* Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <Text style={styles.label}>Senha Atual</Text>
          <TextInput style={styles.input} placeholder="Sua senha atual" placeholderTextColor="#777" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
          <Text style={styles.label}>Nova Senha</Text>
          <TextInput style={styles.input} placeholder="Mínimo 6 caracteres" placeholderTextColor="#777" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          <TouchableOpacity style={[styles.button, { backgroundColor: '#007AFF' }]} onPress={handleChangePassword} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Alterar Senha</Text>}
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={[styles.button, { backgroundColor: '#FF4500' }]} onPress={handleLogout} disabled={loading}>
            <FontAwesome name="sign-out" size={20} color="#FFFFFF" /><Text style={styles.buttonText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Preferências */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferências</Text>
          {/* Switch Modo Simplificado */}
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Modo Simplificado</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.switchLabel}>{simpleMode ? "Ligado" : "Desligado"}</Text>
              <Switch trackColor={{ false: '#767577', true: '#007AFF' }} thumbColor={'#f4f3f4'} onValueChange={() => setSimpleMode(prev => !prev)} value={simpleMode} />
            </View>
            <Text style={styles.hintText}>Esconde registro de carga e gráficos.</Text>
          </View>
          <View style={styles.separator} />
          <Text style={styles.label}>Mostrar Aba Relatórios</Text>
          <View style={styles.switchContainer}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.switchLabel}>{showReportsTab ? "Sim" : "Não"}</Text>
              <Switch trackColor={{ false: '#767577', true: '#007AFF' }} thumbColor={'#f4f3f4'} onValueChange={() => setShowReportsTab(prev => !prev)} value={showReportsTab} />
            </View>
          </View>
          <View style={styles.separator} />
          <Text style={styles.label}>Unidade de Peso</Text>
          <View style={styles.pickerContainer}>
             <Picker selectedValue={weightUnit} onValueChange={setWeightUnit} style={styles.picker} dropdownIconColor="#FFFFFF">
                <Picker.Item label="Quilogramas (kg)" value="kg" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} /><Picker.Item label="Libras (lbs)" value="lbs" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
             </Picker>
          </View>
          <Text style={styles.label}>Tempo de Descanso (segundos)</Text>
          <TextInput style={styles.input} value={timerInput} onChangeText={setTimerInput} keyboardType="number-pad" />
          <Text style={styles.label}>Marcar Calendário ao:</Text>
          <View style={styles.pickerContainer}>
             <Picker selectedValue={completionMode} onValueChange={setCompletionMode} style={styles.picker} dropdownIconColor="#FFFFFF">
               <Picker.Item label="Concluir 1 exercício" value="any" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} /><Picker.Item label="Concluir TODOS os exercícios" value="full" color={Platform.OS === 'android' ? '#FFFFFF' : '#000000'} />
             </Picker>
          </View>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Alerta do Cronômetro</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.switchLabel}>{timerSound ? "Som e Vibração" : "Apenas Vibração"}</Text>
              <Switch trackColor={{ false: '#767577', true: '#007AFF' }} thumbColor={'#f4f3f4'} onValueChange={() => setTimerSound(prev => !prev)} value={timerSound} />
            </View>
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#007AFF', marginTop: 20 }]} onPress={handleSavePreferences} disabled={loading}>
            <Text style={styles.buttonText}>Salvar Preferências</Text>
          </TouchableOpacity>
        </View>
        
        {/* Backup e Zona de Perigo (JSX mantido, resumido aqui para brevidade) */}
        <View style={styles.section}><Text style={styles.sectionTitle}>Backup e Restauração</Text> 
        {/* ... */}
          <TouchableOpacity style={[styles.button, { backgroundColor: '#007AFF' }]} onPress={handleExport}><Text style={styles.buttonText}>Exportar (Backup)</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#34C759', marginTop: 15 }]} onPress={handleImport}><Text style={styles.buttonText}>Importar (Restaurar)</Text></TouchableOpacity>
        </View>
        <View style={[styles.section, { borderColor: '#FF4500' }]}><Text style={[styles.sectionTitle, { color: '#FF4500' }]}>Zona de Perigo</Text>
           {/* ... */}
           <TouchableOpacity style={[styles.button, { backgroundColor: '#FFA500', marginTop: 15 }]} onPress={handleDeleteLogs}><Text style={styles.buttonText}>Apagar TODOS os Registros</Text></TouchableOpacity>
           <TouchableOpacity style={[styles.button, { backgroundColor: '#FF4500', marginTop: 15 }]} onPress={handleDeleteAll}><Text style={styles.buttonText}>Apagar TUDO</Text></TouchableOpacity>
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... estilos idênticos ...
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  // ...
  // Estilos do Modal, Botões, Inputs, Perfil etc... (Copiados do arquivo anterior)
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  modalContent: { backgroundColor: '#2A2A2A', borderRadius: 12, padding: 24, width: '90%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20 },
  input: { backgroundColor: '#1E1E1E', color: '#FFFFFF', padding: 15, borderRadius: 8, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  buttonSmall: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancelText: { color: '#FF4500', fontSize: 16 },
  header: { padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  profileSection: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#1E1E1E', borderBottomWidth: 1, borderBottomColor: '#333' },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  profileImagePlaceholder: { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  profileText: { flex: 1, marginLeft: 20 },
  emailText: { fontSize: 18, color: '#FFFFFF', fontWeight: '500' },
  infoText: { fontSize: 16, color: '#B0B0B0', marginBottom: 5 },
  section: { marginHorizontal: 20, marginTop: 20, backgroundColor: '#1E1E1E', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 15 },
  label: { fontSize: 16, color: '#B0B0B0', marginBottom: 10, marginTop: 5 },
  pickerContainer: { backgroundColor: '#1E1E1E', borderRadius: 8, borderWidth: 1, borderColor: '#333', overflow: 'hidden', marginBottom: 10 },
  picker: { color: '#FFFFFF', height: 60 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  switchLabel: { color: '#B0B0B0', fontSize: 14, marginRight: 10 },
  hintText: { color: '#555', fontSize: 12, marginTop: 5, fontStyle: 'italic' },
  separator: { height: 1, backgroundColor: '#333', marginVertical: 20 },
  // Estilos de Avatar
  avatarContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginBottom: 15 },
  avatarButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', margin: 8, borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#007AFF', backgroundColor: '#555' },
  dateButton: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 12 },
  dateText: { color: '#FFFFFF', fontSize: 16 },
  emptyText: { color: '#B0B0B0', textAlign: 'center', marginTop: 50, fontSize: 16 },
});