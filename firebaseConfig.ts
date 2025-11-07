import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

let app;
let auth;
let db;

// 2. Previne re-inicialização (Singleton)
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    // 3. Configura o Auth para persistir o login no celular
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
    db = getFirestore(app);
    // setLogLevel('debug'); // Descomente para debug do Firestore
  } catch (error) {
    console.error("Erro ao inicializar Firebase: ", error);
  }
} else {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
}

// 4. Define o appId (default-app-id ou o ID real do app)
const appId = firebaseConfig.appId || 'default-app-id';

export { app, appId, auth, db };
