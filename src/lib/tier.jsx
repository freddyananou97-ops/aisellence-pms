import { createContext, useContext, useState } from 'react'

const TierContext = createContext({ tier: 'pms', setTier: () => {} })

export function TierProvider({ initialTier = 'pms', children }) {
  const [tier, setTier] = useState(initialTier)
  return <TierContext.Provider value={{ tier, setTier }}>{children}</TierContext.Provider>
}

export function useTier() {
  return useContext(TierContext)
}
