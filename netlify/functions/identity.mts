import type { UserValidateEvent, UserSignupEvent, UserLoginEvent, UserModifiedEvent } from '@netlify/functions'
import { accessFor } from '../lib/access.js'

async function enforceAccess(event: UserValidateEvent | UserSignupEvent | UserLoginEvent | UserModifiedEvent) {
  let access
  try { access = await accessFor(event.user.email) } catch { return event.deny() }
  if (!access) return event.deny()
  return {
    user: {
      ...event.user,
      appMetadata: { ...event.user.appMetadata, roles: [access.role] },
    },
  }
}

export default {
  userValidate: enforceAccess,
  userSignup: enforceAccess,
  userLogin: enforceAccess,
  userModified: enforceAccess,
}
