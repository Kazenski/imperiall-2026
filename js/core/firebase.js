import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, documentId, increment, runTransaction, writeBatch, orderBy, limit, deleteField, onSnapshot, addDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref as rtdbRef, push, set, onValue, off, query as rtdbQuery, limitToLast, serverTimestamp as rtdbServerTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = { 
    apiKey: "AIzaSyDLvrHJrPvmqR5PTbn4B9FZO2nIt0iTTU0", 
    authDomain: "kazenski-a1bb2.firebaseapp.com", 
    projectId: "kazenski-a1bb2", 
    storageBucket: "kazenski-a1bb2.firebasestorage.app" 
};

const app = initializeApp(firebaseConfig);

// Exporta as instâncias principais
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

// Exporta as funções do Firebase para que os outros arquivos possam usá-las
export { 
    collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, 
    query, where, serverTimestamp, documentId, increment, runTransaction, 
    writeBatch, orderBy, limit, deleteField, onSnapshot, addDoc, 
    arrayUnion, arrayRemove, ref, uploadBytes, getDownloadURL, deleteObject,
    signInWithEmailAndPassword, onAuthStateChanged, signOut
};

export { rtdbRef, push, set, onValue, off, rtdbQuery, limitToLast, rtdbServerTimestamp };