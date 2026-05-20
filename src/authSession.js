export const AUTH_USER_KEY = 'marketing-builder-user'

export function saveCurrentUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem(AUTH_USER_KEY) ?? 'null')
    return user && typeof user === 'object' ? user : null
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function clearCurrentUser() {
  localStorage.removeItem(AUTH_USER_KEY)
}
