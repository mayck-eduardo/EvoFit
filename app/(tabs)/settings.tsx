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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { EmailAuthProvider, User, onAuthStateChanged, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

interface UserProfile { email: string; photoURL?: string; height?: number; weight?: number; birthdate?: string; gender?: 'male' | 'female' | 'other'; }
interface TrainingPlan { id: string; name: string; }
const AVATARS = ['user', 'user-circle', 'user-md', 'rocket', 'music', 'gamepad', 'heart', 'star'] as const;

export default function SettingsScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initialLoading, setInitialLoading] = useState(true);
  const [timerInput, setTimerInput] = useState('90');
  const [completionMode, setCompletionMode] = useState<'any' | 'full'>('any');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [timerSound, setTimerSound] = useState(true);
  const [simpleMode, setSimpleMode] = useState(false);
  const [showReportsTab, setShowReportsTab] = useState(true);
  const [plans, setPlans] = useState<TrainingPlan[]>([{ id: 'default', name: 'Padrão' }]);
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
  const [authLoading, setAuthLoading] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showData, setShowData] = useState(false);

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

  const loadPreferences = async () => {
    try {
      const t = await AsyncStorage.getItem('@EvoFit:timerDefault');
      if (t) setTimerInput(t);
      const m = await AsyncStorage.getItem('@EvoFit:completionMode');
      if (m) setCompletionMode(m as any);
      const u = await AsyncStorage.getItem('@EvoFit:weightUnit');
      if (u) setWeightUnit(u as any);
      const s = await AsyncStorage.getItem('@EvoFit:timerSound');
      if (s !== null) setTimerSound(s === 'true');
      const sm = await AsyncStorage.getItem('@EvoFit:simpleMode');
      if (sm !== null) setSimpleMode(sm === 'true');
      const sr = await AsyncStorage.getItem('@EvoFit:showReportsTab');
      setShowReportsTab(sr === null ? true : sr === 'true');
      const p = await AsyncStorage.getItem('@EvoFit:currentPlanId');
      if (p) setCurrentPlanId(p);
    } catch (e) { console.error(e); }
  };

  const loadPlans = async (uid: string) => {
    try {
      const plansRef = collection(db, 'artifacts', appId, 'users', uid, 'plans_meta');
      const snapshot = await getDocs(plansRef);
      const loaded: TrainingPlan[] = [{ id: 'default', name: 'Padrão' }];
      snapshot.forEach((doc) => loaded.push({ id: doc.id, ...doc.data() } as TrainingPlan));
      setPlans(loaded);
    } catch (e) { console.error(e); }
  };

  const handleCreatePlan = async () => {
    if (!user || !newPlanName.trim()) { Alert.alert('Atenção', 'Nome inválido.'); return; }
    setLoading(true);
    try {
      const newDoc = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'plans_meta'), {
        name: newPlanName, createdAt: serverTimestamp(),
      });
      setPlans([...plans, { id: newDoc.id, name: newPlanName }]);
      setNewPlanName('');
      setPlanModalVisible(false);
      Alert.alert('Sucesso', 'Plano criado!');
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setLoading(false);
  };

  const loadUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        setHeight(data.height?.toString() || '');
        setWeight(data.weight?.toString() || '');
        setGender(data.gender || 'male');
        setBirthdate(data.birthdate ? new Date(data.birthdate) : new Date(2000, 0, 1));
        setSelectedAvatar(data.photoURL || 'user');
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = { height: parseFloat(height) || 0, weight: parseFloat(weight) || 0, gender, birthdate: birthdate.toISOString().split('T')[0], photoURL: selectedAvatar };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), data, { merge: true });
      setProfile((prev) => ({ ...prev, ...data, email: prev?.email || user.email! }));
      Alert.alert('Sucesso', 'Perfil salvo!');
    } catch (e) { Alert.alert('Erro', 'Falha ao salvar.'); }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!user || !currentPassword || !newPassword) { Alert.alert('Erro', 'Preencha as senhas.'); return; }
    setAuthLoading(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, currentPassword));
      await updatePassword(user, newPassword);
      Alert.alert('Sucesso', 'Senha alterada.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setAuthLoading(false);
  };

  const handleSavePreferences = async () => {
    const v = parseInt(timerInput, 10);
    if (isNaN(v) || v <= 0) { Alert.alert('Erro', 'Tempo inválido.'); return; }
    setLoading(true);
    try {
      await AsyncStorage.setItem('@EvoFit:timerDefault', timerInput);
      await AsyncStorage.setItem('@EvoFit:completionMode', completionMode);
      await AsyncStorage.setItem('@EvoFit:weightUnit', weightUnit);
      await AsyncStorage.setItem('@EvoFit:timerSound', String(timerSound));
      await AsyncStorage.setItem('@EvoFit:simpleMode', String(simpleMode));
      await AsyncStorage.setItem('@EvoFit:showReportsTab', String(showReportsTab));
      await AsyncStorage.setItem('@EvoFit:currentPlanId', currentPlanId);
      Alert.alert('Sucesso', 'Preferências salvas!');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth);

  const handleDeleteAll = () => {
    Alert.alert('Apagar tudo', 'Isso é irreversível!', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: () => {} },
    ]);
  };

  const calculateBMI = () => {
    if (profile?.height && profile.weight) {
      const h = profile.height / 100;
      return (profile.weight / (h * h)).toFixed(1);
    }
    return null;
  };

  const calculateAge = () => {
    if (profile?.birthdate) {
      const b = new Date(profile.birthdate);
      const t = new Date();
      let age = t.getFullYear() - b.getFullYear();
      const m = t.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
      return age;
    }
    return null;
  };

  const bmi = calculateBMI();
  const age = calculateAge();

  if (initialLoading) return <View style={styles.container}><ActivityIndicator size="large" color="#EF4444" /></View>;
  if (!user) return <View style={styles.container}><AuthForm /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Modal animationType="slide" transparent visible={planModalVisible} onRequestClose={() => setPlanModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Plano</Text>
            <TextInput style={styles.input} placeholder="Nome do plano" placeholderTextColor="#666" value={newPlanName} onChangeText={setNewPlanName} />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setPlanModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreatePlan} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ajustes</Text>
        </View>

        {/* Theme */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader}>
            <FontAwesome name="paint-brush" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Aparência</Text>
          </Pressable>
          <View style={styles.sectionBody}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Tema</Text>
            <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Picker selectedValue={themeMode} onValueChange={(v) => setThemeMode(v)} style={[styles.picker, { color: colors.text }]} dropdownIconColor={colors.primary}>
                <Picker.Item label="Escuro" value="dark" color={colors.text} />
                <Picker.Item label="Claro" value="light" color={colors.text} />
                <Picker.Item label="Seguir sistema" value="auto" color={colors.text} />
              </Picker>
            </View>
          </View>
        </View>

        {/* Profile Summary */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[styles.profileIcon, { backgroundColor: colors.primaryBg }]}>
            <FontAwesome name={profile?.photoURL as any || 'user'} size={36} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.emailText, { color: colors.text }]}>{user.email}</Text>
            <View style={styles.profileMeta}>
              {age != null && <Text style={[styles.metaText, { color: colors.textSecondary }]}>{age} anos</Text>}
              {bmi != null && <Text style={[styles.metaText, { color: colors.textSecondary }]}>IMC {bmi}</Text>}
            </View>
          </View>
        </View>

        {/* Plan */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader}>
            <FontAwesome name="calendar-check-o" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Plano de Treino</Text>
          </Pressable>
          <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Picker selectedValue={currentPlanId} onValueChange={(v) => setCurrentPlanId(v)} style={[styles.picker, { color: colors.text }]} dropdownIconColor={colors.primary}>
              {plans.map((p) => <Picker.Item key={p.id} label={p.name} value={p.id} color={colors.text} />)}
            </Picker>
          </View>
          <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.inputBg }]} onPress={() => setPlanModalVisible(true)}>
            <FontAwesome name="plus" size={14} color={colors.text} />
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Criar novo plano</Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader} onPress={() => setShowProfile(!showProfile)}>
            <FontAwesome name="user" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Dados Físicos</Text>
            <FontAwesome name={showProfile ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </Pressable>
          {showProfile && (
            <View style={styles.sectionBody}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Avatar</Text>
              <View style={styles.avatarRow}>
                {AVATARS.map((icon) => (
                  <Pressable key={icon} style={[styles.avatarBtn, { backgroundColor: colors.inputBg, borderColor: selectedAvatar === icon ? colors.primary : 'transparent' }]} onPress={() => setSelectedAvatar(icon)}>
                    <FontAwesome name={icon} size={24} color={colors.text} />
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Altura (cm)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="180" placeholderTextColor={colors.textMuted} value={height} onChangeText={setHeight} keyboardType="number-pad" />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Peso (kg)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="80.5" placeholderTextColor={colors.textMuted} value={weight} onChangeText={setWeight} keyboardType="numeric" />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nascimento</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={[styles.dateBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.dateText, { color: colors.text }]}>{birthdate.toLocaleDateString('pt-BR')}</Text>
              </Pressable>
              {showDatePicker && <DateTimePicker value={birthdate} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setBirthdate(d); }} />}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sexo</Text>
              <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Picker selectedValue={gender} onValueChange={(v) => setGender(v)} style={[styles.picker, { color: colors.text }]} dropdownIconColor={colors.primary}>
                  <Picker.Item label="Masculino" value="male" color={colors.text} />
                  <Picker.Item label="Feminino" value="female" color={colors.text} />
                  <Picker.Item label="Outro" value="other" color={colors.text} />
                </Picker>
              </View>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSaveProfile} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader}>
            <FontAwesome name="sliders" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferências</Text>
          </Pressable>
          <View style={styles.sectionBody}>
            <View style={styles.switchRow}>
              <View>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Modo Simplificado</Text>
                <Text style={[styles.switchHint, { color: colors.textMuted }]}>Esconde carga e gráficos</Text>
              </View>
              <Switch trackColor={{ false: colors.surfaceAlt, true: colors.primary }} thumbColor="#FFF" onValueChange={() => setSimpleMode(!simpleMode)} value={simpleMode} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Aba Relatórios</Text>
              <Switch trackColor={{ false: colors.surfaceAlt, true: colors.primary }} thumbColor="#FFF" onValueChange={() => setShowReportsTab(!showReportsTab)} value={showReportsTab} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Unidade de Peso</Text>
            <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Picker selectedValue={weightUnit} onValueChange={setWeightUnit} style={[styles.picker, { color: colors.text }]} dropdownIconColor={colors.primary}>
                <Picker.Item label="Kg" value="kg" color={colors.text} />
                <Picker.Item label="Lbs" value="lbs" color={colors.text} />
              </Picker>
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Descanso (segundos)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} value={timerInput} onChangeText={setTimerInput} keyboardType="number-pad" />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Marcar calendário ao</Text>
            <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Picker selectedValue={completionMode} onValueChange={setCompletionMode} style={[styles.picker, { color: colors.text }]} dropdownIconColor={colors.primary}>
                <Picker.Item label="1 exercício feito" value="any" color={colors.text} />
                <Picker.Item label="Todos exercícios feitos" value="full" color={colors.text} />
              </Picker>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Som do Timer</Text>
              <Switch trackColor={{ false: colors.surfaceAlt, true: colors.primary }} thumbColor="#FFF" onValueChange={() => setTimerSound(!timerSound)} value={timerSound} />
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSavePreferences} disabled={loading}>
              <Text style={styles.primaryBtnText}>Salvar Preferências</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader} onPress={() => setShowAccount(!showAccount)}>
            <FontAwesome name="lock" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Conta</Text>
            <FontAwesome name={showAccount ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </Pressable>
          {showAccount && (
            <View style={styles.sectionBody}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Senha Atual</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Senha atual" placeholderTextColor={colors.textMuted} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Nova Senha</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]} placeholder="Mín. 6 caracteres" placeholderTextColor={colors.textMuted} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleChangePassword} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Alterar Senha</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.danger }]} onPress={handleLogout}>
                <FontAwesome name="sign-out" size={16} color="#FFF" />
                <Text style={styles.dangerBtnText}>Sair</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Data */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Pressable style={styles.sectionHeader} onPress={() => setShowData(!showData)}>
            <FontAwesome name="database" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Dados</Text>
            <FontAwesome name={showData ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </Pressable>
          {showData && (
            <View style={styles.sectionBody}>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.inputBg }]} onPress={async () => Alert.alert('Em breve', 'Export será implementado.')}>
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Exportar Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.successBg, marginTop: 10 }]} onPress={async () => Alert.alert('Em breve', 'Import será implementado.')}>
                <Text style={[styles.secondaryBtnText, { color: colors.success }]}>Importar Backup</Text>
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
              <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.successBg }]} onPress={() => Alert.alert('Apagar logs', 'Isso apagará todos os registros de séries.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => {} }])}>
                <Text style={[styles.dangerBtnText, { color: colors.success }]}>Apagar Registros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: colors.danger, marginTop: 10 }]} onPress={() => handleDeleteAll()}>
                <Text style={styles.dangerBtnText}>Apagar Tudo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  profileCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  profileIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2A1A1A', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  profileInfo: { flex: 1 },
  emailText: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  profileMeta: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 13, color: '#888' },
  section: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1E1E1E', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sectionBody: { padding: 16, paddingTop: 0 },
  label: { fontSize: 14, color: '#888', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#2C2C2C', color: '#FFF', padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#3A3A3A' },
  pickerWrapper: { backgroundColor: '#2C2C2C', borderRadius: 12, borderWidth: 1, borderColor: '#3A3A3A', overflow: 'hidden' },
  picker: { color: '#FFF', height: Platform.OS === 'ios' ? 120 : 50 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  switchLabel: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  switchHint: { color: '#666', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 12 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  avatarBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2C', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#EF4444' },
  dateBtn: { backgroundColor: '#2C2C2C', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3A3A3A' },
  dateText: { color: '#FFF', fontSize: 16 },
  primaryBtn: { backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2C2C2C', padding: 14, borderRadius: 12, gap: 8 },
  secondaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', padding: 14, borderRadius: 12, marginTop: 12, gap: 8 },
  dangerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#2A2A2A', borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
