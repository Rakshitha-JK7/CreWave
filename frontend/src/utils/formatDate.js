/**
 * Date formatting utilities for CareWave.
 * All functions gracefully handle null/undefined/invalid inputs by returning '—'.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(input) {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return null
  return d
}

/**
 * Formats a date as "21 Nov 2026".
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = toDate(date)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Formats a date as "21 Nov 2026, 11:30 AM".
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = toDate(date)
  if (!d) return '—'
  const day  = d.getDate()
  const mon  = MONTHS[d.getMonth()]
  const yr   = d.getFullYear()
  let hours  = d.getHours()
  const mins = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${day} ${mon} ${yr}, ${hours}:${mins} ${ampm}`
}

/**
 * Returns a human-readable relative time string such as:
 * "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago",
 * or falls back to formatDate for older dates.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatRelative(date) {
  const d = toDate(date)
  if (!d) return '—'

  const now     = new Date()
  const diffMs  = now - d
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr  = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr  / 24)

  if (diffSec < 10)   return 'Just now'
  if (diffSec < 60)   return `${diffSec} seconds ago`
  if (diffMin < 60)   return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`
  if (diffHr  < 24)   return diffHr  === 1 ? '1 hour ago'   : `${diffHr} hours ago`
  if (diffDay === 1)  return 'Yesterday'
  if (diffDay < 7)    return `${diffDay} days ago`
  if (diffDay < 30)   {
    const weeks = Math.floor(diffDay / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }
  return formatDate(d)
}

/**
 * Formats a date as a value suitable for <input type="date"> — "2026-11-21".
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateInput(date) {
  const d = toDate(date)
  if (!d) return ''
  const yr  = d.getFullYear()
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mon}-${day}`
}

/**
 * Alias for formatRelative — returns "2 hours ago", "Yesterday", etc.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function timeAgo(date) {
  return formatRelative(date)
}

/**
 * Formats only the time portion as "11:30 AM".
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatTime(date) {
  const d = toDate(date)
  if (!d) return '—'
  let hours = d.getHours()
  const mins = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${mins} ${ampm}`
}
