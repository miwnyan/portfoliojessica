import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env || {};

const firebaseConfig = Object.freeze({
  apiKey: String(env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: String(env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: String(env.VITE_FIREBASE_APP_ID || '').trim()
});

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const hasRequiredConfiguration = requiredConfigKeys.every(key => firebaseConfig[key]);

let appInstance = null;
let authInstance = null;
let firestoreInstance = null;
let initializationError = null;

if (hasRequiredConfiguration) {
  try {
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    firestoreInstance = getFirestore(appInstance);
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    appInstance = null;
    authInstance = null;
    firestoreInstance = null;
  }
}

/** Verdadeiro apenas quando configuração e inicialização foram concluídas. */
export const firebaseConfigured = Boolean(appInstance && authInstance && firestoreInstance);

/** Instâncias nulas deixam o site público funcionar com o conteúdo local. */
export const firebaseApp = appInstance;
export const auth = authInstance;
export const db = firestoreInstance;

/** Útil para o painel apresentar uma mensagem sem expor valores do ambiente. */
export const firebaseInitializationError = initializationError;

