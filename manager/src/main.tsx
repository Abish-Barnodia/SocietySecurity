import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { addCollection } from '@iconify/react'
import tablerIcons from '@iconify-json/tabler/icons.json'
import './index.css'
import App from './App.tsx'

// Bundled offline — no runtime calls to Iconify's API for every icon.
addCollection(tablerIcons)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
