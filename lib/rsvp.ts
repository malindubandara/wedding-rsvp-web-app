export type Attendance = 'accepted' | 'declined'

export type RsvpFields = {
  name: string
  attendance: Attendance
  guests: number
  notes: string
}

export type RsvpFieldErrors = Partial<Record<keyof RsvpFields, string>>

export type RsvpApiResponse =
  | { ok: true; action: 'created' | 'updated' }
  | { ok: false; message: string; fieldErrors?: RsvpFieldErrors }

export const REPLY_KEY_PATTERN = /^[a-f0-9]{64}$/

export function getNameError(value: string) {
  if (!value.trim()) return 'Please enter your name so we know who this reply is from.'
  if (value.trim().length > 120) return 'Please keep your name to 120 characters or fewer.'
  return ''
}

export function validateRsvpFields(value: unknown):
  | { ok: true; data: RsvpFields }
  | { ok: false; fieldErrors: RsvpFieldErrors } {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const errors: RsvpFieldErrors = {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const nameError = getNameError(name)
  if (nameError) errors.name = nameError
  if (input.attendance !== 'accepted' && input.attendance !== 'declined') {
    errors.attendance = 'Please let us know whether you can join us.'
  }
  if (input.attendance === 'accepted' && (typeof input.guests !== 'number' || !Number.isInteger(input.guests) || input.guests < 1 || input.guests > 4)) {
    errors.guests = 'Please choose between 1 and 4 guests.'
  }
  const notes = input.notes === undefined ? '' : input.notes
  if (typeof notes !== 'string' || notes.length > 1000) {
    errors.notes = 'Please keep your note to 1,000 characters or fewer.'
  }
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    data: {
      name,
      attendance: input.attendance as Attendance,
      guests: input.attendance === 'declined' ? 0 : input.guests as number,
      notes: (notes as string).trim(),
    },
  }
}
