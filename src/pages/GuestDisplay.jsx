import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createCheckoutSession, buildLineItems } from '../lib/stripe'
import QRCode from '../components/QRCode'
import SignatureCanvas from '../components/SignatureCanvas'

// ============================================================
// TRANSLATIONS
// ============================================================
const T = {
  de: {
    title: 'Meldeschein', subtitle: 'Pflichtangaben gemäß §30 BMG',
    mainGuest: 'Hauptgast', companion: 'Begleitperson', addCompanion: '+ Begleitperson hinzufügen', remove: 'Entfernen',
    firstName: 'Vorname', lastName: 'Nachname', birthDate: 'Geburtsdatum', nationality: 'Staatsangehörigkeit',
    street: 'Straße und Hausnummer', zip: 'PLZ', city: 'Ort', country: 'Land',
    idType: 'Ausweistyp', idNumber: 'Ausweisnummer', phone: 'Handynummer', phonePlaceholder: 'Nummer ohne Vorwahl',
    guestLang: 'Bevorzugte Sprache',
    signature: 'Unterschrift', signatureHint: 'Ich bestätige die Richtigkeit der Angaben.',
    signHere: 'Hier unterschreiben', clearSig: 'Unterschrift löschen',
    submit: 'Meldeschein absenden', submitting: 'Wird gespeichert...',
    thanks: 'Vielen Dank!', checkinDone: 'Der Meldeschein wurde erfolgreich übermittelt.', invoiceDone: 'Die Rechnung wurde bestätigt.',
    invoiceTitle: 'Rechnung', invoiceSign: 'Unterschreiben & Bestätigen', invoiceSignHint: 'Hiermit bestätige ich den Erhalt und die Richtigkeit der Rechnung.',
    guest: 'Gast', room: 'Zimmer', checkIn: 'Check-in', checkOut: 'Check-out',
    position: 'Position', amount: 'Betrag', nights: 'Nächte', total: 'Gesamtbetrag',
    stayNights: 'Übernachtung', selectIdType: 'Bitte wählen...', searchPlaceholder: 'Suchen...',
    passport: 'Reisepass', idCard: 'Personalausweis', driversLicense: 'Führerschein',
  },
  en: {
    title: 'Registration Form', subtitle: 'Required information per §30 BMG',
    mainGuest: 'Main Guest', companion: 'Companion', addCompanion: '+ Add companion', remove: 'Remove',
    firstName: 'First name', lastName: 'Last name', birthDate: 'Date of birth', nationality: 'Nationality',
    street: 'Street and house number', zip: 'Postal code', city: 'City', country: 'Country',
    idType: 'ID type', idNumber: 'ID number', phone: 'Mobile number', phonePlaceholder: 'Number without prefix',
    guestLang: 'Preferred language',
    signature: 'Signature', signatureHint: 'I confirm the accuracy of the information provided.',
    signHere: 'Sign here', clearSig: 'Clear signature',
    submit: 'Submit registration', submitting: 'Saving...',
    thanks: 'Thank you!', checkinDone: 'The registration form has been submitted successfully.', invoiceDone: 'The invoice has been confirmed.',
    invoiceTitle: 'Invoice', invoiceSign: 'Sign & Confirm', invoiceSignHint: 'I hereby confirm receipt and accuracy of this invoice.',
    guest: 'Guest', room: 'Room', checkIn: 'Check-in', checkOut: 'Check-out',
    position: 'Item', amount: 'Amount', nights: 'Nights', total: 'Total',
    stayNights: 'Accommodation', selectIdType: 'Please select...', searchPlaceholder: 'Search...',
    passport: 'Passport', idCard: 'ID Card', driversLicense: "Driver's License",
  },
}

// ============================================================
// DATA: NATIONALITIES, PHONE CODES, GUEST LANGUAGES
// ============================================================
const NATIONALITIES = {
  de: [
    { v: 'deutsch', l: 'Deutsch' }, { v: 'österreichisch', l: 'Österreichisch' }, { v: 'schweizerisch', l: 'Schweizerisch' }, { v: '---', l: '───────────' },
    { v: 'albanisch', l: 'Albanisch' }, { v: 'amerikanisch', l: 'Amerikanisch' }, { v: 'australisch', l: 'Australisch' }, { v: 'belgisch', l: 'Belgisch' }, { v: 'bosnisch', l: 'Bosnisch' }, { v: 'brasilianisch', l: 'Brasilianisch' }, { v: 'britisch', l: 'Britisch' }, { v: 'bulgarisch', l: 'Bulgarisch' }, { v: 'chinesisch', l: 'Chinesisch' }, { v: 'dänisch', l: 'Dänisch' }, { v: 'estnisch', l: 'Estnisch' }, { v: 'finnisch', l: 'Finnisch' }, { v: 'französisch', l: 'Französisch' }, { v: 'georgisch', l: 'Georgisch' }, { v: 'griechisch', l: 'Griechisch' }, { v: 'indisch', l: 'Indisch' }, { v: 'iranisch', l: 'Iranisch' }, { v: 'irakisch', l: 'Irakisch' }, { v: 'irisch', l: 'Irisch' }, { v: 'isländisch', l: 'Isländisch' }, { v: 'israelisch', l: 'Israelisch' }, { v: 'italienisch', l: 'Italienisch' }, { v: 'japanisch', l: 'Japanisch' }, { v: 'kanadisch', l: 'Kanadisch' }, { v: 'kasachisch', l: 'Kasachisch' }, { v: 'kosovarisch', l: 'Kosovarisch' }, { v: 'koreanisch', l: 'Koreanisch' }, { v: 'kroatisch', l: 'Kroatisch' }, { v: 'kubanisch', l: 'Kubanisch' }, { v: 'lettisch', l: 'Lettisch' }, { v: 'litauisch', l: 'Litauisch' }, { v: 'luxemburgisch', l: 'Luxemburgisch' }, { v: 'marokkanisch', l: 'Marokkanisch' }, { v: 'mazedonisch', l: 'Mazedonisch' }, { v: 'mexikanisch', l: 'Mexikanisch' }, { v: 'moldauisch', l: 'Moldauisch' }, { v: 'montenegrinisch', l: 'Montenegrinisch' }, { v: 'niederländisch', l: 'Niederländisch' }, { v: 'norwegisch', l: 'Norwegisch' }, { v: 'pakistanisch', l: 'Pakistanisch' }, { v: 'polnisch', l: 'Polnisch' }, { v: 'portugiesisch', l: 'Portugiesisch' }, { v: 'rumänisch', l: 'Rumänisch' }, { v: 'russisch', l: 'Russisch' }, { v: 'saudi-arabisch', l: 'Saudi-Arabisch' }, { v: 'schwedisch', l: 'Schwedisch' }, { v: 'serbisch', l: 'Serbisch' }, { v: 'slowakisch', l: 'Slowakisch' }, { v: 'slowenisch', l: 'Slowenisch' }, { v: 'spanisch', l: 'Spanisch' }, { v: 'syrisch', l: 'Syrisch' }, { v: 'thailändisch', l: 'Thailändisch' }, { v: 'tschechisch', l: 'Tschechisch' }, { v: 'tunesisch', l: 'Tunesisch' }, { v: 'türkisch', l: 'Türkisch' }, { v: 'ukrainisch', l: 'Ukrainisch' }, { v: 'ungarisch', l: 'Ungarisch' }, { v: 'vietnamesisch', l: 'Vietnamesisch' },
  ],
  en: [
    { v: 'german', l: 'German' }, { v: 'austrian', l: 'Austrian' }, { v: 'swiss', l: 'Swiss' }, { v: '---', l: '───────────' },
    { v: 'albanian', l: 'Albanian' }, { v: 'american', l: 'American' }, { v: 'australian', l: 'Australian' }, { v: 'belgian', l: 'Belgian' }, { v: 'bosnian', l: 'Bosnian' }, { v: 'brazilian', l: 'Brazilian' }, { v: 'british', l: 'British' }, { v: 'bulgarian', l: 'Bulgarian' }, { v: 'canadian', l: 'Canadian' }, { v: 'chinese', l: 'Chinese' }, { v: 'croatian', l: 'Croatian' }, { v: 'cuban', l: 'Cuban' }, { v: 'czech', l: 'Czech' }, { v: 'danish', l: 'Danish' }, { v: 'dutch', l: 'Dutch' }, { v: 'estonian', l: 'Estonian' }, { v: 'finnish', l: 'Finnish' }, { v: 'french', l: 'French' }, { v: 'georgian', l: 'Georgian' }, { v: 'greek', l: 'Greek' }, { v: 'hungarian', l: 'Hungarian' }, { v: 'icelandic', l: 'Icelandic' }, { v: 'indian', l: 'Indian' }, { v: 'iranian', l: 'Iranian' }, { v: 'iraqi', l: 'Iraqi' }, { v: 'irish', l: 'Irish' }, { v: 'israeli', l: 'Israeli' }, { v: 'italian', l: 'Italian' }, { v: 'japanese', l: 'Japanese' }, { v: 'kazakh', l: 'Kazakh' }, { v: 'korean', l: 'Korean' }, { v: 'kosovar', l: 'Kosovar' }, { v: 'latvian', l: 'Latvian' }, { v: 'lithuanian', l: 'Lithuanian' }, { v: 'luxembourgish', l: 'Luxembourgish' }, { v: 'macedonian', l: 'Macedonian' }, { v: 'mexican', l: 'Mexican' }, { v: 'moldovan', l: 'Moldovan' }, { v: 'montenegrin', l: 'Montenegrin' }, { v: 'moroccan', l: 'Moroccan' }, { v: 'norwegian', l: 'Norwegian' }, { v: 'pakistani', l: 'Pakistani' }, { v: 'polish', l: 'Polish' }, { v: 'portuguese', l: 'Portuguese' }, { v: 'romanian', l: 'Romanian' }, { v: 'russian', l: 'Russian' }, { v: 'saudi', l: 'Saudi Arabian' }, { v: 'serbian', l: 'Serbian' }, { v: 'slovak', l: 'Slovak' }, { v: 'slovenian', l: 'Slovenian' }, { v: 'spanish', l: 'Spanish' }, { v: 'swedish', l: 'Swedish' }, { v: 'syrian', l: 'Syrian' }, { v: 'thai', l: 'Thai' }, { v: 'tunisian', l: 'Tunisian' }, { v: 'turkish', l: 'Turkish' }, { v: 'ukrainian', l: 'Ukrainian' }, { v: 'vietnamese', l: 'Vietnamese' },
  ],
}

const PHONE_CODES = [
  { code: '+49', l: 'Deutschland +49' }, { code: '+43', l: 'Österreich +43' }, { code: '+41', l: 'Schweiz +41' }, { code: '---', l: '───────────' },
  { code: '+1', l: 'USA/Kanada +1' }, { code: '+7', l: 'Russland +7' }, { code: '+20', l: 'Ägypten +20' }, { code: '+27', l: 'Südafrika +27' }, { code: '+30', l: 'Griechenland +30' }, { code: '+31', l: 'Niederlande +31' }, { code: '+32', l: 'Belgien +32' }, { code: '+33', l: 'Frankreich +33' }, { code: '+34', l: 'Spanien +34' }, { code: '+36', l: 'Ungarn +36' }, { code: '+39', l: 'Italien +39' }, { code: '+40', l: 'Rumänien +40' }, { code: '+44', l: 'UK +44' }, { code: '+45', l: 'Dänemark +45' }, { code: '+46', l: 'Schweden +46' }, { code: '+47', l: 'Norwegen +47' }, { code: '+48', l: 'Polen +48' }, { code: '+55', l: 'Brasilien +55' }, { code: '+81', l: 'Japan +81' }, { code: '+82', l: 'Südkorea +82' }, { code: '+86', l: 'China +86' }, { code: '+90', l: 'Türkei +90' }, { code: '+91', l: 'Indien +91' }, { code: '+351', l: 'Portugal +351' }, { code: '+352', l: 'Luxemburg +352' }, { code: '+353', l: 'Irland +353' }, { code: '+358', l: 'Finnland +358' }, { code: '+380', l: 'Ukraine +380' }, { code: '+381', l: 'Serbien +381' }, { code: '+385', l: 'Kroatien +385' }, { code: '+386', l: 'Slowenien +386' }, { code: '+387', l: 'Bosnien +387' }, { code: '+420', l: 'Tschechien +420' }, { code: '+421', l: 'Slowakei +421' }, { code: '+966', l: 'Saudi-Arabien +966' }, { code: '+971', l: 'VAE +971' }, { code: '+972', l: 'Israel +972' },
]

const GUEST_LANGUAGES = [
  { v: 'german', l: 'Deutsch' }, { v: 'english', l: 'English' }, { v: 'french', l: 'Français' },
  { v: 'italian', l: 'Italiano' }, { v: 'spanish', l: 'Español' }, { v: 'dutch', l: 'Nederlands' },
  { v: 'polish', l: 'Polski' }, { v: 'russian', l: 'Русский' }, { v: 'chinese', l: '中文' },
  { v: 'arabic', l: 'العربية' }, { v: 'turkish', l: 'Türkçe' }, { v: 'japanese', l: '日本語' },
]

const ID_TYPES = { de: [{ v: '', l: 'Bitte wählen...' }, { v: 'passport', l: 'Reisepass' }, { v: 'id_card', l: 'Personalausweis' }, { v: 'drivers_license', l: 'Führerschein' }], en: [{ v: '', l: 'Please select...' }, { v: 'passport', l: 'Passport' }, { v: 'id_card', l: 'ID Card' }, { v: 'drivers_license', l: "Driver's License" }] }

// ============================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================
function SearchSelect({ options, value, onChange, placeholder, style: extraStyle }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [open])

  const selected = options.find(o => o.v === value || o.code === value)
  const displayValue = selected ? (selected.l || selected.v) : ''
  const filtered = options.filter(o => {
    if (o.v === '---' || o.code === '---') return !search
    const q = search.toLowerCase()
    return !q || (o.l || '').toLowerCase().includes(q) || (o.v || '').toLowerCase().includes(q) || (o.code || '').toLowerCase().includes(q)
  })

  return (
    <div ref={ref} style={{ position: 'relative', ...extraStyle }}>
      <button type="button" onClick={() => { setOpen(!open); setSearch('') }} style={{
        ...ls.input, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: displayValue ? '#1a1a1a' : '#9ca3af' }}>{displayValue || placeholder || ''}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder || 'Suchen...'}
            style={{ ...ls.input, margin: 0, border: 'none', borderBottom: '1px solid #e5e7eb', borderRadius: '10px 10px 0 0', fontSize: 14 }} />
          <div style={{ overflowY: 'auto', maxHeight: 210 }}>
            {filtered.map((o, i) => {
              const key = o.v || o.code || i
              const isSep = o.v === '---' || o.code === '---'
              if (isSep) return <div key={key + i} style={{ padding: '4px 14px', fontSize: 11, color: '#d1d5db', userSelect: 'none' }}>{o.l}</div>
              const isActive = o.v === value || o.code === value
              return (
                <button key={key} type="button" onClick={() => { onChange(o.v || o.code); setOpen(false); setSearch('') }} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer',
                  background: isActive ? '#eff6ff' : 'transparent', color: '#1a1a1a', fontSize: 14, fontFamily: 'inherit',
                }}>{o.l}</button>
              )
            })}
            {filtered.length === 0 && <div style={{ padding: 14, color: '#9ca3af', fontSize: 13 }}>Keine Ergebnisse</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function WelcomeScreen() {
  const [clock, setClock] = useState(new Date())
  useEffect(() => { const iv = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(iv) }, [])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)', padding: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width={44} height={44} viewBox="0 0 44 44"><rect x="2" y="2" width="40" height="40" rx="10" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/><path d="M12 32L22 12L32 32" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="24" x2="28" y2="24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 24, fontWeight: 300, color: '#1a1a1a', letterSpacing: 1 }}>Isellence</span>
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 300, color: '#1a1a1a', margin: '0 0 8px', textAlign: 'center', letterSpacing: -0.5 }}>Willkommen im Maritim Hotel Ingolstadt</h1>
      <p style={{ fontSize: 16, color: '#6b7280', margin: 0, textAlign: 'center' }}>Am Congress Centrum 1 · 85049 Ingolstadt</p>
      <div style={{ marginTop: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 200, color: '#1a1a1a', letterSpacing: 2 }}>{clock.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>{clock.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Bereit für den nächsten Gast</span>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

// ============================================================
// CHECK-IN FORM (Meldeschein §30 BMG)
// ============================================================
function CheckinForm({ session, onComplete }) {
  const [lang, setLang] = useState('de')
  const t = T[lang]

  // Pre-fill name from session
  const nameParts = (session.guest_name || '').trim().split(/\s+/)
  const prefillFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || ''
  const prefillLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

  const [form, setForm] = useState({
    first_name: prefillFirst, last_name: prefillLast, birth_date: '', street: '', zip: '', city: '', country: 'Deutschland',
    nationality: 'deutsch', id_type: '', id_number: '', phone_code: '+49', phone_number: '', guest_language: 'german',
  })
  const [companions, setCompanions] = useState([])
  const [signature, setSignature] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const addCompanion = () => setCompanions(prev => [...prev, { first_name: '', last_name: '', birth_date: '', nationality: lang === 'de' ? 'deutsch' : 'german' }])
  const updateCompanion = (i, field, value) => setCompanions(prev => prev.map((c, j) => j === i ? { ...c, [field]: value } : c))
  const removeCompanion = (i) => setCompanions(prev => prev.filter((_, j) => j !== i))

  const fullPhone = form.phone_number ? `${form.phone_code}${form.phone_number}` : ''
  const canSubmit = form.first_name && form.last_name && form.birth_date && form.street && form.zip && form.city && form.phone_number && signature

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)

    const formData = { ...form, phone: fullPhone }

    await supabase.from('registration_forms').insert({
      booking_id: session.booking_id || null, room: session.room,
      guest_name: `${form.first_name} ${form.last_name}`,
      data: { main_guest: formData, companions }, signature,
      status: 'completed', created_at: new Date().toISOString(),
    })

    const { data: existing } = await supabase.from('guests').select('id').eq('first_name', form.first_name).eq('last_name', form.last_name).maybeSingle()
    if (existing) {
      await supabase.from('guests').update({
        birth_date: form.birth_date, address: `${form.street}, ${form.zip} ${form.city}`,
        nationality: form.nationality, id_number: form.id_number, id_type: form.id_type,
        phone: fullPhone, language: form.guest_language,
      }).eq('id', existing.id)
    } else {
      await supabase.from('guests').insert({
        first_name: form.first_name, last_name: form.last_name, birth_date: form.birth_date,
        address: `${form.street}, ${form.zip} ${form.city}`, nationality: form.nationality,
        id_number: form.id_number, id_type: form.id_type,
        phone: fullPhone, language: form.guest_language, total_stays: 1,
      })
    }

    if (session.booking_id) {
      const isPreCheckin = session._isPreCheckin
      await supabase.from('bookings').update({
        meldeschein_completed: true,
        ...(isPreCheckin ? { meldeschein_vorab: true } : {}),
      }).eq('booking_id', session.booking_id)
    }

    // Update session (skip for pre-check-in which has no DB row)
    if (session.id) {
      await supabase.from('guest_display_sessions').update({ status: 'completed', signature }).eq('id', session.id)
    }
    setSubmitting(false)
    onComplete()
  }

  const u = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))
  const uv = (field) => (val) => setForm(p => ({ ...p, [field]: val }))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '32px 24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 16 }}>
          {[['de', 'DE 🇩🇪'], ['en', 'EN 🇬🇧']].map(([k, l]) => (
            <button key={k} onClick={() => setLang(k)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              background: lang === k ? '#1a1a1a' : '#fff', color: lang === k ? '#fff' : '#6b7280',
              border: lang === k ? 'none' : '1px solid #d1d5db',
            }}>{l}</button>
          ))}
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <svg width={28} height={28} viewBox="0 0 44 44"><rect x="2" y="2" width="40" height="40" rx="10" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/><path d="M12 32L22 12L32 32" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="24" x2="28" y2="24" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 16, fontWeight: 300, color: '#1a1a1a', letterSpacing: 1 }}>Isellence</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: '#1a1a1a', margin: '0 0 4px' }}>{t.title}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{t.room} {session.room} · {session.guest_name}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{t.subtitle}</p>
        </div>

        {/* Main Guest */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 16px' }}>{t.mainGuest}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={ls.label}>{t.firstName} *</label><input style={ls.input} value={form.first_name} onChange={u('first_name')} placeholder={t.firstName} /></div>
            <div><label style={ls.label}>{t.lastName} *</label><input style={ls.input} value={form.last_name} onChange={u('last_name')} placeholder={t.lastName} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={ls.label}>{t.birthDate} *</label><input style={ls.input} type="date" value={form.birth_date} onChange={u('birth_date')} /></div>
            <div><label style={ls.label}>{t.nationality} *</label><SearchSelect options={NATIONALITIES[lang]} value={form.nationality} onChange={uv('nationality')} placeholder={t.searchPlaceholder} /></div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={ls.label}>{t.street} *</label>
            <input style={ls.input} value={form.street} onChange={u('street')} placeholder={lang === 'de' ? 'Musterstraße 1' : '123 Main Street'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={ls.label}>{t.zip} *</label><input style={ls.input} value={form.zip} onChange={u('zip')} placeholder="85049" /></div>
            <div><label style={ls.label}>{t.city} *</label><input style={ls.input} value={form.city} onChange={u('city')} placeholder={lang === 'de' ? 'Ingolstadt' : 'City'} /></div>
            <div><label style={ls.label}>{t.country}</label><input style={ls.input} value={form.country} onChange={u('country')} /></div>
          </div>

          {/* Phone */}
          <div style={{ marginTop: 12 }}>
            <label style={ls.label}>{t.phone} *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8 }}>
              <SearchSelect options={PHONE_CODES} value={form.phone_code} onChange={uv('phone_code')} placeholder="+49" />
              <input style={ls.input} value={form.phone_number} onChange={u('phone_number')} placeholder={t.phonePlaceholder} type="tel" />
            </div>
          </div>

          {/* ID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={ls.label}>{t.idType}</label>
              <select style={ls.input} value={form.id_type} onChange={u('id_type')}>
                {ID_TYPES[lang].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div><label style={ls.label}>{t.idNumber}</label><input style={ls.input} value={form.id_number} onChange={u('id_number')} placeholder={lang === 'de' ? 'Ausweisnummer' : 'ID number'} /></div>
          </div>

          {/* Guest language */}
          <div style={{ marginTop: 12 }}>
            <label style={ls.label}>{t.guestLang}</label>
            <SearchSelect options={GUEST_LANGUAGES} value={form.guest_language} onChange={uv('guest_language')} placeholder={t.searchPlaceholder} />
          </div>
        </div>

        {/* Companions */}
        {companions.map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>{t.companion} {i + 1}</h2>
              <button onClick={() => removeCompanion(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>{t.remove}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={ls.label}>{t.firstName}</label><input style={ls.input} value={c.first_name} onChange={e => updateCompanion(i, 'first_name', e.target.value)} placeholder={t.firstName} /></div>
              <div><label style={ls.label}>{t.lastName}</label><input style={ls.input} value={c.last_name} onChange={e => updateCompanion(i, 'last_name', e.target.value)} placeholder={t.lastName} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div><label style={ls.label}>{t.birthDate}</label><input style={ls.input} type="date" value={c.birth_date} onChange={e => updateCompanion(i, 'birth_date', e.target.value)} /></div>
              <div><label style={ls.label}>{t.nationality}</label><SearchSelect options={NATIONALITIES[lang]} value={c.nationality} onChange={v => updateCompanion(i, 'nationality', v)} placeholder={t.searchPlaceholder} /></div>
            </div>
          </div>
        ))}

        <button onClick={addCompanion} style={{ width: '100%', padding: 14, background: '#fff', border: '1px dashed #d1d5db', borderRadius: 12, fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24 }}>
          {t.addCompanion}
        </button>

        {/* Signature */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>{t.signature}</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>{t.signatureHint}</p>
          <SignatureCanvas onSign={setSignature} label={t.signHere} />
        </div>

        <button disabled={!canSubmit || submitting} onClick={handleSubmit} style={{
          width: '100%', padding: 18, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600,
          cursor: canSubmit && !submitting ? 'pointer' : 'default', fontFamily: 'inherit',
          background: canSubmit ? '#1a1a1a' : '#d1d5db', color: canSubmit ? '#fff' : '#9ca3af', marginBottom: 32,
        }}>
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// INVOICE VIEW
// ============================================================
function InvoiceView({ session, onComplete }) {
  const data = session.data || {}
  const items = data.items || []
  const roomTotal = parseFloat(data.room_total) || 0
  const chargesTotal = items.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const grandTotal = roomTotal + chargesTotal
  const netto7 = roomTotal / 1.07; const mwst7 = roomTotal - netto7
  const netto19 = chargesTotal / 1.19; const mwst19 = chargesTotal - netto19

  // Step flow: 'invoice' → 'payment' → 'waiting_cash' → done
  const [step, setStep] = useState('invoice')
  const [signature, setSignature] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [stripeUrl, setStripeUrl] = useState(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState(null)

  const handleConfirm = async () => {
    if (!signature || submitting) return
    setSubmitting(true)
    await supabase.from('guest_display_sessions').update({ status: 'signed', signature }).eq('id', session.id)
    setSubmitting(false)

    if (grandTotal <= 0) {
      // No payment needed — complete immediately
      if (session.booking_id) {
        await supabase.from('bookings').update({ status: 'checked_out', payment_method: 'Keine Zahlung (0€)', checked_out_at: new Date().toISOString() }).eq('booking_id', session.booking_id)
      }
      await supabase.from('guest_display_sessions').update({ status: 'paid' }).eq('id', session.id)
      onComplete()
    } else {
      setStep('payment')
    }
  }

  const handleStripePayment = async () => {
    setStripeLoading(true); setStripeError(null)
    try {
      const lineItems = buildLineItems({ roomTotal, nights: data.nights, room: session.room, charges: items })
      const origin = window.location.origin
      const { url } = await createCheckoutSession({
        lineItems,
        metadata: { booking_id: session.booking_id || '', guest_name: session.guest_name, room: session.room, session_id: session.id || '' },
        successUrl: `${origin}/guest-display?payment=success&session_id={CHECKOUT_SESSION_ID}&gds=${session.id || ''}`,
        cancelUrl: `${origin}/guest-display?payment=cancelled`,
      })
      setStripeUrl(url)
    } catch (err) {
      setStripeError(err.message)
    }
    setStripeLoading(false)
  }

  const handleCash = async () => {
    // Set status to awaiting_cash so PMS gets notified
    await supabase.from('guest_display_sessions').update({ status: 'awaiting_cash' }).eq('id', session.id)
    setStep('waiting_cash')
  }

  // Listen for PMS confirming cash payment
  useEffect(() => {
    if (step !== 'waiting_cash') return
    const channel = supabase.channel(`cash-confirm-${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guest_display_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        if (payload.new.status === 'paid') {
          onComplete()
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [step, session.id, onComplete])

  // Invoice + Signature view (Step 1)
  if (step === 'invoice') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '32px 24px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>Maritim Hotel Ingolstadt</div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, marginTop: 4 }}>Am Congress Centrum 1 · 85049 Ingolstadt<br/>Tel: +49 841 49050</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 300, color: '#1a1a1a' }}>Rechnung</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{new Date().toLocaleDateString('de-DE')}</div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Gast', session.guest_name], ['Zimmer', session.room], ['Check-in', data.check_in || '—'], ['Check-out', data.check_out || '—']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '2px solid #1a1a1a' }}>
              <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Position</span>
              <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Betrag</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div><div style={{ fontSize: 14, color: '#1a1a1a' }}>Übernachtung ({data.nights || 1} Nächte)</div><div style={{ fontSize: 11, color: '#9ca3af' }}>Zimmer {session.room} · 7% MwSt</div></div>
              <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{roomTotal.toFixed(2)} €</div>
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 20px', borderBottom: '1px solid #f3f4f6' }}>
                <div><div style={{ fontSize: 14, color: '#1a1a1a' }}>{item.type}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{item.details || ''} · 19% MwSt</div></div>
                <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{parseFloat(item.amount).toFixed(2)} €</div>
              </div>
            ))}
            <div style={{ padding: '16px 20px', borderTop: '2px solid #1a1a1a', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Gesamtbetrag</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{grandTotal.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
                <span>Netto (7% MwSt: {mwst7.toFixed(2)} €)</span><span>{netto7.toFixed(2)} €</span>
              </div>
              {chargesTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
                <span>Netto (19% MwSt: {mwst19.toFixed(2)} €)</span><span>{netto19.toFixed(2)} €</span>
              </div>}
            </div>
          </div>

          {/* Signature */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>Unterschrift</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Hiermit bestätige ich den Erhalt und die Richtigkeit der Rechnung.</p>
            <SignatureCanvas onSign={setSignature} label="Hier unterschreiben" />
          </div>

          <button disabled={!signature || submitting} onClick={handleConfirm} style={{
            width: '100%', padding: 18, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600,
            cursor: signature && !submitting ? 'pointer' : 'default', fontFamily: 'inherit',
            background: signature ? '#1a1a1a' : '#d1d5db', color: signature ? '#fff' : '#9ca3af', marginBottom: 32,
          }}>
            {submitting ? 'Wird verarbeitet...' : 'Rechnung bestätigen'}
          </button>
        </div>
      </div>
    )
  }

  // Payment method selection (Step 2)
  if (step === 'payment') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Zu zahlender Betrag</div>
            <div style={{ fontSize: 42, fontWeight: 300, color: '#1a1a1a' }}>{grandTotal.toFixed(2)} €</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{session.guest_name} · Zimmer {session.room}</div>
          </div>

          {!stripeUrl ? (
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              {/* Cash */}
              <button onClick={handleCash} style={{
                flex: 1, padding: '32px 16px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2"/><circle cx="12" cy="12" r="9"/></svg>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>Bar</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>An der Rezeption</div>
              </button>
              {/* Card */}
              <button disabled={stripeLoading} onClick={handleStripePayment} style={{
                flex: 1, padding: '32px 16px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#635bff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{stripeLoading ? '...' : 'Karte'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Kredit-/Debitkarte</div>
              </button>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e5e7eb', marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', margin: '0 0 16px' }}>Kartenzahlung</h3>
              <QRCode value={stripeUrl} size={200} />
              <div style={{ marginTop: 20 }}>
                <a href={stripeUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', padding: '14px 32px', background: '#635bff', color: '#fff',
                  borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none',
                }}>Jetzt bezahlen</a>
              </div>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>Oder scannen Sie den QR-Code mit Ihrem Handy</p>
            </div>
          )}
          {stripeError && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{stripeError}</div>}
        </div>
      </div>
    )
  }

  // Waiting for cash confirmation (Step 3 — cash)
  if (step === 'waiting_cash') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2"/><circle cx="12" cy="12" r="9"/></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: '#1a1a1a', margin: '0 0 8px' }}>Barzahlung</h2>
          <p style={{ fontSize: 32, fontWeight: 300, color: '#1a1a1a', margin: '0 0 16px' }}>{grandTotal.toFixed(2)} €</p>
          <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6 }}>
            Bitte bezahlen Sie den Betrag an der Rezeption.<br/>
            Wir bestätigen Ihre Zahlung hier automatisch.
          </p>
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, color: '#f59e0b' }}>Warte auf Bestätigung von der Rezeption...</span>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
      </div>
    )
  }

  return null
}

// ============================================================
// MAIN GUEST DISPLAY
// ============================================================
export default function GuestDisplay() {
  const [session, setSession] = useState(null)
  const [showComplete, setShowComplete] = useState(false)
  const [preCheckinBooking, setPreCheckinBooking] = useState(null)
  const [preCheckinLoading, setPreCheckinLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Handle Stripe payment success redirect
    const paymentStatus = params.get('payment')
    const gdsId = params.get('gds')
    if (paymentStatus === 'success') {
      // Mark session as paid
      if (gdsId) {
        supabase.from('guest_display_sessions').update({ status: 'paid' }).eq('id', gdsId).then(() => {
          // Also mark booking as checked_out if booking_id exists
          supabase.from('guest_display_sessions').select('booking_id').eq('id', gdsId).maybeSingle().then(({ data: sess }) => {
            if (sess?.booking_id) {
              supabase.from('bookings').update({ status: 'checked_out', payment_method: 'Stripe Online', checked_out_at: new Date().toISOString() }).eq('booking_id', sess.booking_id)
            }
          })
        })
      }
      setShowComplete(true)
      setTimeout(() => { setShowComplete(false); window.history.replaceState({}, '', '/guest-display') }, 4000)
      return
    }

    // Check for pre-check-in via URL parameter: ?booking=BOOKING_ID
    const bookingParam = params.get('booking')

    if (bookingParam) {
      setPreCheckinLoading(true)
      supabase.from('bookings').select('*').eq('booking_id', bookingParam).maybeSingle().then(({ data: booking }) => {
        if (booking) {
          // Create a virtual session from the booking for the CheckinForm
          setPreCheckinBooking({
            id: null, // no guest_display_session row
            type: 'checkin',
            room: booking.room,
            guest_name: booking.guest_name,
            booking_id: booking.booking_id,
            data: {},
            _isPreCheckin: true,
          })
        }
        setPreCheckinLoading(false)
      })
      return // skip realtime setup for pre-check-in mode
    }

    // Normal mode: check for active session and listen via realtime
    const checkActive = async () => {
      const { data } = await supabase.from('guest_display_sessions').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1)
      if (data && data.length > 0) setSession(data[0])
    }
    checkActive()

    const channel = supabase.channel('guest-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_display_sessions' }, (payload) => {
        if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new.status === 'active') {
          setSession(payload.new); setShowComplete(false)
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleComplete = () => {
    setShowComplete(true)
    setTimeout(() => { setSession(null); setPreCheckinBooking(null); setShowComplete(false) }, 3000)
  }

  if (preCheckinLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: '#6b7280' }}>Buchung wird geladen...</div>
        </div>
      </div>
    )
  }

  if (showComplete) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 400, color: '#1a1a1a', margin: '0 0 8px' }}>Vielen Dank!</h1>
        <p style={{ fontSize: 15, color: '#6b7280' }}>
          {preCheckinBooking ? 'Der Meldeschein wurde vorab eingereicht. Wir freuen uns auf Ihren Aufenthalt!' : session?.type === 'invoice' ? 'Die Rechnung wurde bestätigt.' : 'Der Meldeschein wurde erfolgreich übermittelt.'}
        </p>
      </div>
    )
  }

  // Pre-check-in mode (from URL)
  if (preCheckinBooking) {
    return <CheckinForm session={preCheckinBooking} onComplete={handleComplete} />
  }

  // Normal realtime session mode
  if (session) {
    if (session.type === 'checkin') return <CheckinForm session={session} onComplete={handleComplete} />
    if (session.type === 'invoice') return <InvoiceView session={session} onComplete={handleComplete} />
  }

  return <WelcomeScreen />
}

// ============================================================
// LIGHT THEME STYLES
// ============================================================
const ls = {
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
}
