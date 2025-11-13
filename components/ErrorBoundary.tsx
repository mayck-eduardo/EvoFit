import * as Updates from 'expo-updates'; // Para reiniciar o app
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary pegou um erro:", error, errorInfo);
  }

  // 2. AQUI ESTÁ A CORREÇÃO:
  handleReload = () => {
    // Mudado de Updates.reloadAsync() para Updates.reload()
    Updates.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Oops!</Text>
            <Text style={styles.subtitle}>Algo deu muito errado.</Text>
            <Text style={styles.message}>
              O aplicativo encontrou um erro e não pôde continuar.
            </Text>
            
            {__DEV__ && (
              <Text style={styles.errorText}>
                {this.state.error?.toString()}
              </Text>
            )}

            <Pressable style={styles.button} onPress={this.handleReload}>
              <Text style={styles.buttonText}>Reiniciar App</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF4500', 
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorText: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});