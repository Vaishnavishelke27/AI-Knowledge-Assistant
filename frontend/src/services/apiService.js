import axios from 'axios'

export const ACCESS_TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'
export const USER_KEY = 'auth_user'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const apiService = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiService.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiService.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (error.response?.status === 401 && refreshToken && !request?._retry) {
      request._retry = true
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const token = response.data.access_token
        localStorage.setItem(ACCESS_TOKEN_KEY, token)
        request.headers.Authorization = `Bearer ${token}`
        return apiService(request)
      } catch {
        localStorage.removeItem(REFRESH_TOKEN_KEY)
      }
    }
    if (error.response?.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(error)
  },
)

export default apiService
