/**
 * Export data as CSV file with UTF-8 BOM for Excel compatibility.
 * Uses semicolon separator (German-compatible).
 */
export function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF'
  const headerLine = headers.join(';')
  const dataLines = rows.map(row => row.map(cell => {
    const str = String(cell ?? '').replace(/"/g, '""')
    return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
  }).join(';'))
  const csv = BOM + [headerLine, ...dataLines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}
