import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type View = 'home' | 'article' | 'login' | 'admin' | 'admin-editor' | 'profile'

interface User {
  id: string
  email: string
  name: string
  role: string
  avatar?: string | null
  bio?: string | null
}

interface AppState {
  // Navigation
  currentView: View
  viewParams: Record<string, string>
  navigate: (view: View, params?: Record<string, string>) => void

  // Auth
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  selectedCategory: string | null
  setSelectedCategory: (c: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'home' as View,
      viewParams: {},
      navigate: (view, params = {}) => set({ currentView: view, viewParams: params }),

      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      selectedCategory: null,
      setSelectedCategory: (c) => set({ selectedCategory: c }),
    }),
    {
      name: 'blog-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
)
