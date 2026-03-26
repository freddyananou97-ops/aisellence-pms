export const ROLES = {
  admin: {
    label: 'Administrator',
    modules: ['/', '/buchungen', '/kalender', '/gaeste', '/rechnungen', '/analytics', '/schichtbuch', '/zimmer', '/housekeeping', '/kitchen', '/restaurant', '/fruehstueck', '/spa', '/wartung', '/meldeschein', '/feedback', '/preise', '/protokoll', '/settings'],
    defaultRoute: '/',
  },
  rezeption: {
    label: 'Rezeption',
    modules: ['/', '/buchungen', '/kalender', '/gaeste', '/zimmer', '/housekeeping', '/kitchen', '/restaurant', '/fruehstueck', '/spa', '/wartung', '/meldeschein', '/schichtbuch', '/feedback', '/preise'],
    defaultRoute: '/',
  },
  housekeeping: {
    label: 'Housekeeping',
    modules: ['/housekeeping', '/wartung'],
    defaultRoute: '/housekeeping',
  },
  maintenance: {
    label: 'Wartung',
    modules: ['/wartung', '/housekeeping'],
    defaultRoute: '/wartung',
  },
  kitchen: {
    label: 'Küche / Room Service',
    modules: ['/kitchen'],
    defaultRoute: '/kitchen',
  },
  restaurant: {
    label: 'Restaurant',
    modules: ['/restaurant', '/fruehstueck'],
    defaultRoute: '/restaurant',
  },
  spa: {
    label: 'Spa',
    modules: ['/spa'],
    defaultRoute: '/spa',
  },
  nachtschicht: {
    label: 'Nachtschicht',
    modules: ['/', '/buchungen', '/schichtbuch', '/zimmer', '/housekeeping', '/meldeschein'],
    defaultRoute: '/',
  },
}

export const CONCIERGE_MODULES = ['/', '/housekeeping', '/kitchen', '/wartung', '/analytics', '/feedback', '/settings']

export function canAccess(role, path) {
  const r = ROLES[role] || ROLES.admin
  return r.modules.includes(path)
}

export function getDefaultRoute(role) {
  const r = ROLES[role] || ROLES.admin
  return r.defaultRoute
}

export function getAllowedModules(role, tier = 'pms') {
  const r = ROLES[role] || ROLES.admin
  if (tier === 'concierge') return r.modules.filter(m => CONCIERGE_MODULES.includes(m))
  return r.modules
}
