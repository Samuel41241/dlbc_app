import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/lib/auth';



type AuthState = {
  user: AuthUser | null; // ✅ PRODUCTION FIX: Killed the 'any' bug
  token: string | null;
  setAuth: (data: { user: AuthUser | null; token: string }) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,

  setAuth: ({ user, token }) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));