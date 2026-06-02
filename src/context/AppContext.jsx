import { createContext, useContext, useState, useCallback } from 'react'
import { PAGES } from '../constants'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [page, setPage] = useState(PAGES.CONTROL_ACCESO)
  const [pageParams, setPageParams] = useState(null)

  const navigate = useCallback((targetPage, params = null) => {
    setPageParams(params)
    setPage(targetPage)
  }, [])

  return (
    <AppContext.Provider value={{ page, pageParams, navigate }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
