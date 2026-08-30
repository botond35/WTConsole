import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js"; // changed
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCG4aidBoanlgeIZSUuEeZHrzpvhdFu9_g",
  authDomain: "wtconsole-6dce4.firebaseapp.com",
  projectId: "wtconsole-6dce4",
  storageBucket: "wtconsole-6dce4.firebasestorage.app",
  messagingSenderId: "6358100299",
  appId: "1:6358100299:web:f1a6b5c02eb687d887e0ce",
  measurementId: "G-5D0K7GWKP9"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,   // force, not auto-detect
  useFetchStreams: false,
});

export const storage = getStorage(app);