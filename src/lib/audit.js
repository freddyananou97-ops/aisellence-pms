import { supabase } from './supabase'

// Current user reference — set at login, used by logAction
let _currentUser = null
export function setAuditUser(user) { _currentUser = user }
export function getAuditUser() { return _currentUser }

/**
 * Log an action to the audit_log table.
 * If user is not passed, uses the current logged-in user.
 */
export async function logAction(action, entityType, entityId, details = {}, user) {
  const u = user || _currentUser
  try {
    await supabase.from('audit_log').insert({
      user_name: u?.name || 'System',
      user_role: u?.role || 'system',
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      details,
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
