// frontend/src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffUser, PermissionKey } from '@/lib/types';
import { loginStaff, getMe } from '@/lib/api';

interface AuthContextType {
  user: StaffUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<StaffUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (perm: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {
    throw new Error('AuthContext not initialized');
  },
  logout: () => {},
  refreshUser: async () => {},
  hasPermission: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('sehat_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const res = await getMe(savedToken);
      setUser(res.user);
      setToken(savedToken);
      localStorage.setItem('sehat_user', JSON.stringify(res.user));
    } catch {
      localStorage.removeItem('sehat_token');
      localStorage.removeItem('sehat_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('sehat_user');
    const savedToken = localStorage.getItem('sehat_token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        // ignore parse error
      }
    }
    refreshUser();
  }, []);

  const login = async (username: string, password: string): Promise<StaffUser> => {
    const res = await loginStaff(username, password);
    localStorage.setItem('sehat_token', res.token);
    localStorage.setItem('sehat_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('sehat_token');
    localStorage.removeItem('sehat_user');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (perm: PermissionKey): boolean => {
    if (!user) return false;
    if (user.role === 'Admin' && user.permissions.includes('admin')) {
      return user.permissions.includes(perm);
    }
    return user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
