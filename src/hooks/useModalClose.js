import { useEffect } from 'react'

/**
 * Hook to close a modal on ESC key press.
 * Usage: useModalClose(isOpen, onClose)
 */
export default function useModalClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])
}
