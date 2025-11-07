import * as Updates from 'expo-updates'; // Para reiniciar o app
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Interface para as Props (o que o componente recebe)
interface Props {
  children: React.ReactNode;
}

// Interface para o State (o que o componente controla internamente)
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundaries precisam ser Componentes de Classe,
 * pois eles usam métodos de ciclo de vida (getDerivedStateFromError e componentDidCatch)
 * que não existem em componentes funcionais.
 */
class ErrorBoundary extends React.Component<Props, State> {
  
  // 1. Define o estado inicial
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // 2. Atualiza o estado quando um erro é pego dos filhos
  static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true, error: error };
  }

  // 3. (Opcional) Usado para logar o erro
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Você pode logar o erro para um serviço externo (Sentry, Firebase Crashlytics)
    console.error("Erro pego pelo ErrorBoundary:", error, errorInfo);
  }

  // 4. Ação de reiniciar
  handleRestart = () => {
    // Tenta forçar uma recarga do app
    Updates.reloadAsync();
  }

  // 5. Renderiza a UI
  render() {
    if (this.state.hasError) {
      // Se deu erro, renderiza a tela de fallback
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Ops! Algo deu errado.</Text>
          <Text style={styles.subtitle}>
            Aconteceu um erro inesperado na renderização do aplicativo.
          </Text>
          {/* Mostra o erro em modo de desenvolvimento */}
          {__DEV__ && (
             <Text style={styles.errorText}>
               {this.state.error?.toString()}
             </Text>
          )}
          <Pressable style={styles.button} onPress={this.handleRestart}>
             <Text style={styles.buttonText}>Tentar Novamente</Text>
          </Pressable>
        </SafeAreaView>
      );
    }

    // Se não houver erro, renderiza os filhos normalmente.
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4500', // Cor de erro
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ErrorBoundary;