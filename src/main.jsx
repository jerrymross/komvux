import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import KomvuxSchema from './KomvuxSchema.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KomvuxSchema />
  </StrictMode>,
)
