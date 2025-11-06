import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// 1. SUAS CHAVES REAIS
const firebaseConfig = {
  apiKey: "AIzaSyD9xHz8kwXMwCryF3_NvLXpx550jqgcbJk",
  authDomain: "evofit-app-d2e47.firebaseapp.com",
  projectId: "evofit-app-d2e47",
  storageBucket: "evofit-app-d2e47.firebasestorage.app",
  messagingSenderId: "234654176517",
  appId: "1:234654176517:web:3fcac7549d50067393536c",
  measurementId: "G-ZKJVZ1X7K2"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const fbConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;

// 2. Inicialização Singleton (Padrão)
const app = !getApps().length ? initializeApp(fbConfig) : getApp();

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error: any) {
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    console.error("Erro ao inicializar Auth:", error);
    throw error;
  }
}

const db = getFirestore(app);
setLogLevel('debug');

export { db, auth, appId };