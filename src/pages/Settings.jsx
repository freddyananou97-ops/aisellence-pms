import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme.jsx'
import { ROLES } from '../lib/roles'
import { HOTEL, saveHotelSetting, loadHotelSettings } from '../lib/hotel'
import ConfirmDialog from '../components/ConfirmDialog'

const S = {
  content: { padding: '28px 32px', maxWidth: 1280 },
  card: { background: 'var(--bgCard,#0e0e0e)', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, padding: '20px 24px' },
  label: { display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--textDim,#444)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 1 },
  input: { width: '100%', padding: '13px 16px', border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 12, fontSize: 14, outline: 'none', background: 'var(--inputBg,#080808)', color: 'var(--text,#fff)', boxSizing: 'border-box', marginBottom: 16, fontFamily: 'inherit' },
}

const roleColors = { admin: '#10b981', rezeption: '#10b981', housekeeping: '#3b82f6', maintenance: '#f59e0b', kitchen: '#ef4444', restaurant: '#8b5cf6', spa: '#ec4899', nachtschicht: '#6b7280' }

export default function Settings() {
  const [tab, setTab] = useState('mitarbeiter')
  const [employees, setEmployees] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newEmp, setNewEmp] = useState({ name: '', pin: '', role: 'housekeeping' })
  const [editId, setEditId] = useState(null)
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()

  useEffect(() => { loadEmployees() }, [])

  const loadEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees(data || [])
  }

  const addEmployee = async () => {
    if (!newEmp.name || !newEmp.pin) return
    await supabase.from('employees').insert({ name: newEmp.name, pin: newEmp.pin, role: newEmp.role, active: true })
    setNewEmp({ name: '', pin: '', role: 'housekeeping' }); setShowAdd(false); loadEmployees()
  }

  const tabs = [
    { id: 'mitarbeiter', label: 'Mitarbeiter', count: employees.filter(e => e.active !== false).length },
    { id: 'hotel', label: 'Hotel-Stammdaten' },
    { id: 'darstellung', label: 'Darstellung' },
    { id: 'benachrichtigungen', label: 'Benachrichtigungen' },
    { id: 'integrationen', label: 'Integrationen' },
  ]

  return (
    <div style={S.content}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text,#fff)', margin: '0 0 16px' }}>Einstellungen</h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: tab === t.id ? '1px solid var(--text,#fff)' : '1px solid var(--borderLight,#1a1a1a)',
            background: tab === t.id ? 'var(--text,#fff)' : 'transparent', color: tab === t.id ? 'var(--bg,#080808)' : 'var(--textMuted,#888)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}{t.count !== undefined && <span style={{ fontSize: 10, color: tab === t.id ? 'var(--textMuted,#888)' : 'var(--textDim,#555)' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* MITARBEITER */}
      {tab === 'mitarbeiter' && <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', background: 'var(--text,#fff)', color: 'var(--bg,#080808)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ Neuer Mitarbeiter</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {employees.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--textDim)', fontSize: 12 }}>Keine Mitarbeiter — klicke "+ Neuer Mitarbeiter"</div>
          ) : null}
          {employees.map(emp => {
            const rc = roleColors[emp.role] || '#888'
            const roleLabels = { admin: 'Administrator', rezeption: 'Rezeption', housekeeping: 'Housekeeping', maintenance: 'Wartung', kitchen: 'Küche', restaurant: 'Restaurant', spa: 'Spa', nachtschicht: 'Nachtschicht' }
            return (
              <div key={emp.id} style={{ ...S.card, opacity: emp.active === false ? 0.5 : 1, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${rc}20`, color: rc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                    {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text,#fff)', fontWeight: 500 }}>{emp.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${rc}15`, color: rc }}>{roleLabels[emp.role]}</span>
                      {emp.active === false && <span style={{ fontSize: 9, color: '#ef4444' }}>Deaktiviert</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>}

      {/* HOTEL-STAMMDATEN */}
      {tab === 'hotel' && <HotelSettingsTab />}

      {/* DARSTELLUNG */}
      {tab === 'darstellung' && <div style={{ maxWidth: 600 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, color: 'var(--text,#fff)', marginBottom: 4 }}>Farbschema</div>
          <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginBottom: 16 }}>Wähle zwischen hellem und dunklem Design oder lasse es automatisch wechseln.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              ['dark', 'Dunkel', 'Ideal für Nachtschicht und schwach beleuchtete Bereiche', 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'],
              ['light', 'Hell', 'Ideal für Tageslicht und gut beleuchtete Bereiche', 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42 M17 12a5 5 0 11-10 0 5 5 0 0110 0z'],
              ['auto', 'Automatisch', 'Hell (7:00–20:00), Dunkel (20:00–7:00)', 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 2a10 10 0 010 20z'],
            ].map(([mode, label, desc, icon]) =>
              <button key={mode} onClick={() => setThemeMode(mode)} style={{
                flex: 1, padding: '20px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                border: themeMode === mode ? '2px solid #10b981' : '1px solid var(--borderLight,#1a1a1a)',
                background: themeMode === mode ? 'rgba(16,185,129,0.06)' : 'transparent',
              }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--text,#fff)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text,#fff)', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--textMuted,#888)', marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
                {themeMode === mode && <div style={{ fontSize: 10, color: '#10b981', marginTop: 8, fontWeight: 500 }}>✓ Aktiv</div>}
              </button>
            )}
          </div>
          {themeMode === 'auto' && <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#3b82f6' }}>Automatischer Modus aktiv</div>
            <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginTop: 4 }}>Aktuell: {resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'} ({new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})</div>
          </div>}
        </div>
      </div>}

      {/* BENACHRICHTIGUNGEN */}
      {tab === 'benachrichtigungen' && <div style={{ maxWidth: 600 }}>
        <div style={S.card}>
          {[['Sound-Benachrichtigungen','Akustischer Ton bei neuen Anfragen'],['Browser Push-Notifications','Popup auch wenn Tab im Hintergrund']].map(([l,d], i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border,#151515)' }}>
              <div><div style={{ fontSize: 13, color: 'var(--text,#fff)' }}>{l}</div><div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginTop: 2 }}>{d}</div></div>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: '#10b981', position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3, right: 3 }} />
              </div>
            </div>
          )}
          <div style={{ padding: '14px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--text,#fff)' }}>Eskalationszeit — Anfragen</div>
            <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginTop: 2, marginBottom: 8 }}>Nach wie vielen Minuten wird eine Anfrage als "überfällig" markiert?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5,10,15,20,30].map(m => <button key={m} style={{ padding: '6px 14px', borderRadius: 6, border: m === 10 ? '1px solid #10b981' : '1px solid var(--borderLight,#1a1a1a)', background: m === 10 ? 'rgba(16,185,129,0.08)' : 'transparent', color: m === 10 ? '#10b981' : 'var(--textMuted,#888)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{m} Min.</button>)}
            </div>
          </div>
        </div>
      </div>}

      {/* INTEGRATIONEN */}
      {tab === 'integrationen' && <div style={{ maxWidth: 600 }}>
        <div style={S.card}>
          {[
            ['Supabase', 'Datenbank & Realtime', true, 'niabwewrwezstpyefxup'],
            ['Stripe Terminal', 'Kartenzahlung', false, 'Nicht verbunden'],
            ['WhatsApp / Twilio', 'Gästekommunikation', true, '+49 841 XXX'],
            ['Voiceflow', 'Marco AI Concierge', true, 'Agent live'],
            ['Make.com', 'Automatisierungen', true, '22 Szenarien aktiv'],
            ['Beds24', 'Channel Manager', true, 'Verbunden'],
            ['Brightsky API', 'Wetterdaten', true, 'Ingolstadt'],
            ['Invoice API', 'ZUGFeRD Rechnungen', true, 'invoice-api.vercel.app'],
          ].map(([name, desc, connected, detail], i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border,#151515)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text,#fff)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: connected ? '#10b981' : 'var(--textDim,#555)', fontWeight: 500 }}>{connected ? '● Verbunden' : '○ Nicht verbunden'}</div>
                <div style={{ fontSize: 9, color: 'var(--textDim,#444)', marginTop: 2 }}>{detail}</div>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Add Employee Modal */}
      {showAdd && <div style={{ position: 'fixed', inset: 0, background: 'var(--overlayBg,rgba(0,0,0,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ background: 'var(--modalBg,#111)', border: '1px solid var(--modalBorder,#222)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 420 }}>
          <h3 style={{ fontSize: 16, color: 'var(--text,#fff)', marginBottom: 20 }}>Neuer Mitarbeiter</h3>
          <label style={S.label}>Name</label>
          <input style={S.input} value={newEmp.name} onChange={e => setNewEmp(p => ({ ...p, name: e.target.value }))} placeholder="Vor- und Nachname" />
          <label style={S.label}>PIN (4-stellig)</label>
          <input style={S.input} value={newEmp.pin} onChange={e => setNewEmp(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="••••" maxLength={4} />
          <label style={S.label}>Rolle</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {Object.entries(ROLES).map(([k, v]) => (
              <button key={k} onClick={() => setNewEmp(p => ({ ...p, role: k }))} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                border: newEmp.role === k ? `1px solid ${roleColors[k]}` : '1px solid var(--borderLight,#1a1a1a)',
                background: newEmp.role === k ? `${roleColors[k]}15` : 'transparent',
                color: newEmp.role === k ? roleColors[k] : 'var(--textMuted,#888)',
              }}>{v.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 12, border: '1px solid var(--borderLight,#1a1a1a)', borderRadius: 10, background: 'transparent', color: 'var(--textMuted,#888)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
            <button onClick={addEmployee} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: 'var(--text,#fff)', color: 'var(--bg,#080808)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Anlegen</button>
          </div>
        </div>
      </div>}

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}

function HotelSettingsTab() {
  const fields = [['name','Hotelname'],['street','Adresse'],['zip','PLZ'],['city','Stadt'],['phone','Telefon'],['email','Email'],['taxId','USt-IdNr.'],['iban','IBAN'],['bic','BIC']]
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadHotelSettings().then(() => {
      const f = {}; fields.forEach(([k]) => { f[k] = HOTEL[k] || '' }); setForm(f)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    for (const [key] of fields) {
      if (form[key] !== HOTEL[key]) await saveHotelSetting(key, form[key])
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--textMuted,#888)', marginBottom: 16, lineHeight: 1.5 }}>
          Diese Daten erscheinen auf Rechnungen, Bons und dem Gast-Display.
        </div>
        {fields.map(([key, label]) => (
          <div key={key}><label style={S.label}>{label}</label><input style={S.input} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} /></div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ padding: '12px 24px', background: 'var(--text,#fff)', color: 'var(--bg,#080808)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          {saved && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Gespeichert</span>}
        </div>
      </div>
    </div>
  )
}
