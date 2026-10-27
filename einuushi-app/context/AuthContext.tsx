import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  authenticateUser,
  registerUser,
  updatePassword,
  updateUserProfile,
  findUserByEmail,
  saveSessionUser,
  getSessionUser,
  clearSessionUser,
} from '../services/database';

interface AuthContextType {
  currentUser: User | null;
  isLoadingSession: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  register: (userData: Omit<User, 'id' | 'createdAt'>) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (updates: {
    fullName?: string;
    cedula?: string;
    phone?: string;
    city?: string;
    password?: string;
    avatar?: string;
  }) => Promise<{ success: boolean; user?: User; message?: string }>;
  checkEmailExists: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoadingSession: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  resetPassword: async () => ({ success: false }),
  updateProfile: async () => ({ success: false }),
  checkEmailExists: async () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Cargar sesión persistente al abrir la aplicación
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionUser = await getSessionUser();
        if (sessionUser) {
          setCurrentUser(sessionUser);
        }
      } catch (err) {
        console.warn('Error al cargar sesión previa:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authenticateUser(email, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await saveSessionUser(res.user);
      return { success: true, user: res.user };
    }
    return { success: false, message: res.message };
  };

  const register = async (userData: Omit<User, 'id' | 'createdAt'>) => {
    const res = await registerUser(userData);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await saveSessionUser(res.user);
      return { success: true };
    }
    return { success: false, message: res.message };
  };

  const logout = async () => {
    setCurrentUser(null);
    await clearSessionUser();
  };

  const resetPassword = async (email: string, newPass: string) => {
    return await updatePassword(email, newPass);
  };

  const updateProfile = async (updates: {
    fullName?: string;
    cedula?: string;
    phone?: string;
    city?: string;
    password?: string;
    avatar?: string;
  }) => {
    if (!currentUser) return { success: false, message: 'No hay sesión de usuario activa.' };
    const res = await updateUserProfile(currentUser.email, updates);
    if (res.success && res.user) {
      setCurrentUser(res.user);
    }
    return res;
  };

  const checkEmailExists = async (email: string) => {
    const user = await findUserByEmail(email);
    return !!user;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoadingSession,
        login,
        register,
        logout,
        resetPassword,
        updateProfile,
        checkEmailExists,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

