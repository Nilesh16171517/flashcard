import{initializeApp}from'firebase/app';import{getAuth,type Auth}from'firebase/auth';

const config={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'AIzaSyA8HHyNbX7zlpOof4kzzZtmlKaInggZPs8',
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'recallforge-390ab.firebaseapp.com',
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'recallforge-390ab',
 storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET||'recallforge-390ab.firebasestorage.app',
 messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID||'429930291713',
 appId:import.meta.env.VITE_FIREBASE_APP_ID||'1:429930291713:web:c67b54738daea625ec1600'
};

export const firebaseConfigured=Object.values(config).every(Boolean);
export const auth:Auth=(firebaseConfigured?getAuth(initializeApp(config)):null) as unknown as Auth;
