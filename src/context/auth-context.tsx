"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { loginUser, registerUser, type UserOut } from "@/lib/api"

interface AuthContextValue {
  user: UserOut | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = "talenta_token"
const USER_KEY = "talenta_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Baca sesi dari localStorage sekali saat mount (client-only, setelah hydration
    // selesai) - tidak bisa dibaca lewat lazy useState() karena akan mismatch
    // dengan render server.
    const storedUser = window.localStorage.getItem(USER_KEY)
    const storedToken = window.localStorage.getItem(TOKEN_KEY)
    if (storedUser && storedToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const res = await loginUser(email, password)
    window.localStorage.setItem(TOKEN_KEY, res.access_token)
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setUser(res.user)
  }

  async function register(name: string, email: string, password: string) {
    await registerUser(name, email, password)
    await login(email, password)
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
