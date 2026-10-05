import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { viewerMembers } from '../../db/schema.js'

export type AccessRole = 'editor' | 'viewer'

function approvedAccessList(): { email: string; role: AccessRole; name: string }[] {
  return [
    { email: 'carricoclimate@gmail.com', role: 'editor', name: 'Carrico Climate' },
    { email: 'jamesw1416@gmail.com', role: 'editor', name: 'James' },
    { email: 'hvacliquidators1@gmail.com', role: 'viewer', name: 'HVAC Liquidators' },
    { email: 'wrightco1416@gmail.com', role: 'viewer', name: 'Wright Co' },
  ]
}

export async function accessList() {
  const approved = approvedAccessList()
  const viewers = await db.select({ email: viewerMembers.email, name: viewerMembers.name }).from(viewerMembers).orderBy(viewerMembers.createdAt)
  return [...approved, ...viewers.filter((viewer) => !approved.some((member) => member.email === viewer.email)).map((viewer) => ({ ...viewer, role: 'viewer' as const }))]
}

export async function accessFor(email?: string) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return undefined
  const approved = approvedAccessList().find((entry) => entry.email === normalizedEmail)
  if (approved) return approved
  const [viewer] = await db.select({ email: viewerMembers.email, name: viewerMembers.name }).from(viewerMembers).where(eq(viewerMembers.email, normalizedEmail)).limit(1)
  return viewer ? { ...viewer, role: 'viewer' as const } : undefined
}
