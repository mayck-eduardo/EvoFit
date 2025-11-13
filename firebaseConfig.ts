import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// 1. 'getStorage' REMOVIDO
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// ... (firebaseConfig permanece o mesmo)
const firebaseConfig = {
  apiKey: "AIzaSyD9xHz8kwXMwCryF3_NvLXpx550jqgcbJk",
  authDomain: "evofit-app-d2e47.firebaseapp.com",
  projectId: "evofit-app-d2e47",
  storageBucket: "evofit-app-d2e47.appspot.com", 
  messagingSenderId: "234654176517",
  appId: "1:234654176517:web:3fcac7549d50067393536c",
  measurementId: "G-ZKJVZ1X7K2"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const fbConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;

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
// 2. 'storage' REMOVIDO
// setLogLevel('debug');

// 3. 'storage' REMOVIDO da exportação
export { appId, auth, db };
