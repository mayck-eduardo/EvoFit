import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { appId, auth, db } from '../firebaseConfig';

export type UserRole = 'student' | 'personal' | 'both';

export interface UserProfile {
  email: string;
  photoURL?: string;
  height?: number;
  weight?: number;
  birthdate?: string;
  gender?: 'male' | 'female' | 'other';
  role?: UserRole;
  students?: string[];
  personalId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  role: UserRole | null;
  isPersonal: boolean;
  isStudent: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      }
    } catch (e) {
      console.error('Erro ao carregar perfil:', e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.uid);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), data, { merge: true });
      setProfile((prev) => ({ ...prev, ...data } as UserProfile));
    } catch (e) {
      console.error('Erro ao salvar perfil:', e);
      throw e;
    }
  };

  const role = profile?.role || 'student';
  const isPersonal = role === 'personal' || role === 'both';
  const isStudent = role === 'student' || role === 'both';

  return (
    <AuthContext.Provider
      value={{ user, loading, profile, role, isPersonal, isStudent, refreshProfile, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
