import { createContext, useContext } from 'react'

type User = {
  id: string
  name: string
  email: string
  avatarUrl: string
}

type AppContextType = {
  auth: User | null
}

export const AppContext = createContext<AppContextType>({
  auth: null,
})

export const useApp = () => useContext(AppContext)
