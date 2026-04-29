import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={styles.title}>Página não encontrada</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#121212' },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 24 },
  link: { backgroundColor: '#EF4444', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  linkText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
});
