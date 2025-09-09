// services/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// import AsyncStorage from "@react-native-async-storage/async-storage"; // No se usa con Expo

const firebaseConfig = {
  apiKey: "AIzaSyA_ZzeP_DAoXeRuallrOaJ4xFaxjnuhw-8",
  authDomain: "posys-103de.firebaseapp.com",
  projectId: "posys-103de",
  storageBucket: "posys-103de.appspot.com", // <- appspot.com en RN
  messagingSenderId: "401054148688",
  appId: "1:401054148688:web:1c2aea9e8b40958b514955",
  measurementId: "G-Q2GWQXMFLX",
};

const app = initializeApp(firebaseConfig);

// 🔐 Autenticación eliminada para compatibilidad Expo Go

// 🔥 Firestore normal (no IndexedDB en móvil)
const db = getFirestore(app);

export { db };
