import { useCallback, useEffect, useMemo, useState } from 'react'
import apiService, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../services/apiService'
import { AuthContext } from './auth-context'

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY))
  const [user, setUser] = useState(readStoredUser)

  const persistSession = useCallback((data) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token)
    if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
    return data
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await apiService.post('/auth/login', { email, password })
    return persistSession(data)
  }, [persistSession])

  const register = useCallback(async (email, password) => {
    const { data } = await apiService.post('/auth/register', { email, password })
    return persistSession(data)
  }, [persistSession])

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    window.addEventListener('auth:logout', logout)
    return () => window.removeEventListener('auth:logout', logout)
  }, [logout])

  const value = useMemo(
    () => ({ user, token, isAuthenticated: Boolean(token), login, register, logout }),
    [user, token, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
