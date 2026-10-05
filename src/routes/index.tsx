import { createFileRoute } from '@tanstack/react-router'
import { LedgerApp } from '../components/LedgerApp'

export const Route = createFileRoute('/')({
  component: LedgerApp,
})
