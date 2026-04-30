import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthForm from '../../components/AuthForm';
import { appId, auth, db } from '../../firebaseConfig';
import { useTheme } from '../../context/ThemeContext';

interface Routine { id: string; name: string; order: number; }
const ROUTINE_ICONS = ['heartbeat', 'fire', 'star', 'bolt', 'trophy', 'heart', 'medkit', 'flag'];

export default function ReportsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) { setRoutines([]); return; }
    setLoading(true);
    const routinesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'routines');
    const q = query(routinesPath, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRoutines(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Routine));
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
    return () => unsubscribe();
  }, [user]);

  if (!user) return <View style={[styles.container, { backgroundColor: colors.background }]}><AuthForm /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Relatórios</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Selecione uma ficha para ver os gráficos.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: `/report-exercises/${item.id}` as any, params: { routineName: item.name } })}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primaryBg }]}>
                <FontAwesome name={ROUTINE_ICONS[index % ROUTINE_ICONS.length] as any} size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <FontAwesome name="angle-right" size={18} color="#555" />
            </Pressable>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma ficha encontrada.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 15, color: '#888' },
  listContent: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2A1A1A', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardName: { flex: 1, fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 },
});
