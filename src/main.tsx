import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { openUrl } from '@tauri-apps/plugin-opener'
import './index.css'
import App from './App.tsx'

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href) return
  if (!/^https?:\/\//i.test(href)) return
  e.preventDefault()
  openUrl(href).catch(err => console.error('openUrl', href, err))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
