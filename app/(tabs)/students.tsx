import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { appId, db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface StudentProfile {
  uid: string;
  email: string;
  routinesCount: number;
}

export default function StudentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, user, isPersonal, updateProfile, refreshProfile } = useAuth();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  useEffect(() => {
    if (profile?.students && profile.students.length > 0) {
      loadStudents();
    } else {
      setStudents([]);
      setLoading(false);
    }
  }, [profile?.students]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const uids = profile?.students || [];
      const results: StudentProfile[] = [];
      for (const uid of uids) {
        const studentDoc = await getDoc(doc(db, 'artifacts', appId, 'users', uid));
        if (studentDoc.exists()) {
          const data = studentDoc.data();
          const routinesSnap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, 'routines'));
          results.push({
            uid,
            email: data.email || 'Sem email',
            routinesCount: routinesSnap.size,
          });
        }
      }
      setStudents(results);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    }
    setLoading(false);
  };

  const handleAddStudent = async () => {
    if (!studentEmail.trim()) {
      Alert.alert('Erro', 'Digite o email do aluno.');
      return;
    }
    setAddingStudent(true);
    try {
      const usersRef = collection(db, 'artifacts', appId, 'users');
      const q = query(usersRef, where('email', '==', studentEmail.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        Alert.alert('Erro', 'Nenhum usuário encontrado com este email.');
        setAddingStudent(false);
        return;
      }
      const studentId = snapshot.docs[0].id;
      const currentStudents = profile?.students || [];
      if (currentStudents.includes(studentId)) {
        Alert.alert('Aviso', 'Este aluno já está na sua lista.');
        setAddingStudent(false);
        return;
      }
      await updateProfile({ students: [...currentStudents, studentId] });
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setStudentEmail('');
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o aluno.');
    }
    setAddingStudent(false);
  };

  const handleRemoveStudent = (studentId: string) => {
    Alert.alert('Remover Aluno', 'Tem certeza que deseja remover este aluno?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            const currentStudents = profile?.students || [];
            await updateProfile({ students: currentStudents.filter((id) => id !== studentId) });
            await refreshProfile();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          } catch (error) {
            console.error('Erro ao remover aluno:', error);
            Alert.alert('Erro', 'Não foi possível remover o aluno.');
          }
        },
      },
    ]);
  };

  if (!user || !isPersonal) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Acesso restrito</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Esta área é exclusiva para personal trainers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Adicionar Aluno</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Email do aluno"
              placeholderTextColor={colors.textMuted}
              value={studentEmail}
              onChangeText={setStudentEmail}
              autoFocus
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancelar</Text>
              </Pressable>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddStudent}
                disabled={addingStudent}
              >
                {addingStudent ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.saveBtnText, { color: '#FFF' }]}>Adicionar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Alunos</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Gerencie seus alunos</Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/students/${item.uid}` as any);
            }}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
              <FontAwesome name="user" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardName, { color: colors.text }]}>{item.email}</Text>
              <Text style={[styles.cardHint, { color: colors.textMuted }]}>
                {item.routinesCount} {item.routinesCount === 1 ? 'ficha' : 'fichas'}
              </Text>
            </View>
            <Pressable
              style={styles.cardRight}
              onPress={() => handleRemoveStudent(item.uid)}
            >
              <FontAwesome name="times" size={18} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum aluno</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Toque no botão + para adicionar seu primeiro aluno.
              </Text>
            </View>
          )
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
        <Text style={[styles.fabText, { color: colors.text }]}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', marginBottom: 4 },
  headerSubtitle: { fontSize: 15 },
  listContent: { paddingHorizontal: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', marginBottom: 3 },
  cardHint: { fontSize: 13 },
  cardRight: { padding: 8 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: { fontSize: 28, fontWeight: '300', lineHeight: 28 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  modalInput: { padding: 14, borderRadius: 12, fontSize: 16, borderWidth: 1, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
