import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const AppContext = createContext(null)

// Mock users for demo
const MOCK_USERS = {
  patient: {
    id: 'PAT001',
    name: 'Ravi Kumar',
    role: 'patient',
    age: 45,
    sex: 'Male',
    village: 'Rampur',
    phone: '+91-9876543210',
    bloodGroup: 'B+',
  },
  healthWorker: {
    id: 'HW001',
    name: 'Priya Sharma',
    role: 'healthWorker',
    clinic: 'Rampur PHC',
    village: 'Rampur',
    district: 'Sitapur',
    phone: '+91-9765432109',
  },
  doctor: {
    id: 'DOC001',
    name: 'Dr. Anjali Mehta',
    role: 'doctor',
    specialization: 'General Medicine',
    hospital: 'City Medical Center',
    city: 'Lucknow',
    phone: '+91-9654321098',
    registrationNo: 'UP-MED-2015-4821',
  },
}

let notifIdCounter = 1

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(MOCK_USERS.healthWorker)
  const [notifications, setNotifications] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncState, setSyncState] = useState({
    lastSync: localStorage.getItem('carewave_last_sync') || null,
    pendingCount: 0,
    isSyncing: false,
  })

  /* ---- Network events ---- */
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  /* ---- Role switcher ---- */
  const setCurrentRole = useCallback((role) => {
    if (MOCK_USERS[role]) {
      setCurrentUser(MOCK_USERS[role])
    }
  }, [])

  /* ---- Notifications ---- */
  const addNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = notifIdCounter++
    const notif = { id, message, type, createdAt: new Date() }
    setNotifications(prev => [notif, ...prev])

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  /* ---- Sync state ---- */
  const updateSyncState = useCallback((updates) => {
    setSyncState(prev => {
      const next = { ...prev, ...updates }
      if (updates.lastSync) {
        localStorage.setItem('carewave_last_sync', updates.lastSync)
      }
      return next
    })
  }, [])

  const value = {
    // User
    currentUser,
    setCurrentUser,
    setCurrentRole,
    mockUsers: MOCK_USERS,

    // Notifications
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,

    // Network
    isOnline,

    // Sync
    syncState,
    setSyncState: updateSyncState,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}
