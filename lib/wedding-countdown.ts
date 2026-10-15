import { wedding } from '@/lib/wedding-config'

function midnight(date: string) {
  const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  return Date.parse(`${isoDate}T00:00:00${wedding.calendar.utcOffset}`)
}

export const WEDDING_DAY_START = midnight(wedding.calendar.startDate)
export const WEDDING_DAY_END = midnight(wedding.calendar.endDate)

export type WeddingCountdown =
  | { status: 'upcoming'; remaining: number }
  | { status: 'today' | 'past'; remaining: 0 }

export function getWeddingCountdown(now: number): WeddingCountdown {
  if (now >= WEDDING_DAY_END) return { status: 'past', remaining: 0 }
  if (now >= WEDDING_DAY_START) return { status: 'today', remaining: 0 }
  return { status: 'upcoming', remaining: WEDDING_DAY_START - now }
}
