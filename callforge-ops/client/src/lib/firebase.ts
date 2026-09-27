import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase Configuration for TATA Dialer / Smart AI Dialer
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCc8I2uxWtZWBX7G6vT5sP7xInRxWmzbNQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tata-dialer.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tata-dialer",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tata-dialer.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "203703585193",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:203703585193:web:70dafdaa865bf04a879cb8",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6ZRV0T8SMN",
};

// Initialize Firebase (Singleton pattern to prevent duplicate initialization)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export default app;
