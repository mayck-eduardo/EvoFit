import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={[styles.title, { color: colors.text }]}>Página não encontrada</Text>
        <Link href="/" style={[styles.link, { backgroundColor: colors.primary }]}>
          <Text style={[styles.linkText, { color: '#FFF' }]}>Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 24 },
  link: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  linkText: { fontSize: 16, fontWeight: '700' },
});
