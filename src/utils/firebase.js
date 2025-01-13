import { initializeApp } from '@firebase/app';
import { 
  getAuth, 
  initializeAuth,
  getReactNativePersistence,
} from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const firebaseConfig = {
  apiKey: "AIzaSyBariyhqYTrLxNpNp_qNLFGZCrGm533E0M",
  authDomain: "relativitylab.firebaseapp.com",
  projectId: "relativitylab",
  storageBucket: "relativitylab.appspot.com",
  messagingSenderId: "296786551041"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Configure Google Sign In
GoogleSignin.configure({
  webClientId: '296786551041-c9vbh0ir72dgckrahtuakqprgeq036mb.apps.googleusercontent.com',
});

export { auth, db };