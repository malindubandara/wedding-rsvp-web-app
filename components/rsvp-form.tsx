'use client'

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowRight, Check, Heart, LoaderCircle, Mail, Minus, Plus, Send } from 'lucide-react'
import { getNameError, REPLY_KEY_PATTERN, validateRsvpFields, type Attendance, type RsvpApiResponse, type RsvpFieldErrors, type RsvpFields } from '@/lib/rsvp'

const STORAGE_KEY = 'meshara-udara:rsvp:v1'
const SAVE_ERROR = "We couldn't confirm your reply was saved. Please try again."

export default function RsvpForm() {
  const [attendance, setAttendance] = useState<Attendance>('accepted')
  const [name, setName] = useState('')
  const [guests, setGuests] = useState(1)
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RsvpFieldErrors>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [confirmedReply, setConfirmedReply] = useState<RsvpFields | null>(null)
  const replyKey = useRef<string | null>(null)
  const savedReply = useRef<RsvpFields | null>(null)
  const inFlight = useRef(false)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const attendanceRef = useRef<HTMLFieldSetElement>(null)
  const guestsRef = useRef<HTMLFieldSetElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const editing = useRef(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const data: unknown = JSON.parse(stored)
      if (!data || typeof data !== 'object') return
      const record = data as Record<string, unknown>
      if (typeof record.replyKey !== 'string' || !REPLY_KEY_PATTERN.test(record.replyKey)) return
      replyKey.current = record.replyKey
      const saved = validateRsvpFields(record.saved)
      if (saved.ok) {
        savedReply.current = saved.data
        setName(saved.data.name)
        setAttendance(saved.data.attendance)
        setGuests(saved.data.guests || 1)
        setNotes(saved.data.notes)
        setHasSaved(true)
      }
    } catch {
      // Saving still works in private browsers that block local storage.
      setStorageAvailable(false)
    }
  }, [])

  useEffect(() => {
    if (sent) confirmationRef.current?.focus({ preventScroll: true })
    else if (editing.current) { nameRef.current?.focus({ preventScroll: true }); editing.current = false }
  }, [sent])

  useEffect(() => {
    if (!saving && saveError) errorRef.current?.focus({ preventScroll: true })
  }, [saveError, saving])

  function persistReply() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ replyKey: replyKey.current, saved: savedReply.current }))
      setStorageAvailable(true)
    } catch {
      setStorageAvailable(false)
    }
  }

  function focusFirstError(errors: RsvpFieldErrors) {
    if (errors.name) nameRef.current?.focus()
    else if (errors.attendance) attendanceRef.current?.focus()
    else if (errors.guests) guestsRef.current?.focus()
    else if (errors.notes) notesRef.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    const validation = validateRsvpFields({ name, attendance, guests, notes })
    setSaveError('')
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      focusFirstError(validation.fieldErrors)
      return
    }
    setFieldErrors({})
    inFlight.current = true
    setSaving(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25000)
    try {
      if (!replyKey.current) {
        replyKey.current = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
      }
      // Persist before sending: a retry after a lost response must use this key.
      persistReply()
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validation.data, replyKey: replyKey.current }),
        signal: controller.signal,
      })
      const result = await response.json() as RsvpApiResponse
      if (!response.ok || result.ok !== true) {
        if (result.ok === false && result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
          // Controls become focusable after the pending state has rendered.
          window.requestAnimationFrame(() => focusFirstError(result.fieldErrors || {}))
        } else {
          setSaveError(result.ok === false && typeof result.message === 'string' ? result.message : SAVE_ERROR)
        }
        return
      }
      savedReply.current = validation.data
      persistReply()
      setConfirmedReply(validation.data)
      setHasSaved(true)
      setSent(true)
    } catch {
      setSaveError(SAVE_ERROR)
    } finally {
      window.clearTimeout(timeout)
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <div className="rsvp-card" data-reveal>
      {sent && confirmedReply ? (
        <div className="confirmation" ref={confirmationRef} tabIndex={-1} role="status">
          <div className="celebration-sprinkles" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
          <span className="confirm-mark">{confirmedReply.attendance === 'accepted' ? <Heart /> : <Check />}</span>
          <p className="eyebrow">With love, thank you {confirmedReply.name}</p>
          <h3>{confirmedReply.attendance === 'accepted' ? <>We can’t wait<br />to <i>celebrate!</i></> : <>You’ll be there<br /><i>in spirit.</i></>}</h3>
          <p>{confirmedReply.attendance === 'accepted'
            ? `Your RSVP is confirmed for ${confirmedReply.guests} guest${confirmedReply.guests === 1 ? '' : 's'}. A beautiful day is even better with you in it.`
            : 'Thank you for letting us know. We’ll be thinking of you on our special day.'}</p>
          <p className="form-note">Your reply has been saved. {storageAvailable ? 'You can return in this browser to update it.' : 'Keep this tab open if you would like to update it.'}</p>
          <button className="text-link" onClick={() => { editing.current = true; setSent(false) }}>Edit your response <ArrowRight aria-hidden="true" /></button>
        </div>
      ) : (
        <form className="rsvp-form" onSubmit={submit} noValidate aria-busy={saving}>
          <div className="form-heading"><span className="eyebrow">A little note back</span><h3>Will you join us?</h3><Heart aria-hidden="true" /></div>
          {hasSaved && <p className="reply-restored">Your saved reply is loaded. Send your changes to update it.</p>}
          <fieldset className="rsvp-fields" disabled={saving} aria-label="Your RSVP details">
            <fieldset ref={attendanceRef} tabIndex={-1} aria-describedby={fieldErrors.attendance ? 'attendance-error' : undefined}>
              <legend>Your reply</legend>
              <div className="attendance-options">
                <label className={attendance === 'accepted' ? 'selected' : ''}><input type="radio" name="attendance" value="accepted" checked={attendance === 'accepted'} onChange={() => { setAttendance('accepted'); setFieldErrors(current => ({ ...current, attendance: undefined })) }} /><Heart aria-hidden="true" /><span>Joyfully accept<small>I’ll be there to celebrate</small></span></label>
                <label className={attendance === 'declined' ? 'selected' : ''}><input type="radio" name="attendance" value="declined" checked={attendance === 'declined'} onChange={() => { setAttendance('declined'); setFieldErrors(current => ({ ...current, attendance: undefined, guests: undefined })) }} /><Mail aria-hidden="true" /><span>Regretfully decline<small>Sending all my love</small></span></label>
              </div>
              {fieldErrors.attendance && <p className="field-error" id="attendance-error" role="alert">{fieldErrors.attendance}</p>}
            </fieldset>
            <div className="form-field">
              <label htmlFor="guest-name">Your full name</label>
              <input ref={nameRef} id="guest-name" name="name" autoComplete="name" required maxLength={120} value={name}
                aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'guest-name-error' : undefined}
                onChange={event => { const value = event.target.value; setName(value); if (fieldErrors.name) setFieldErrors(current => ({ ...current, name: getNameError(value) || undefined })) }}
                onBlur={() => setFieldErrors(current => ({ ...current, name: getNameError(name) || undefined }))}
                placeholder="The name on your invitation" />
              {fieldErrors.name && <p className="field-error" id="guest-name-error" role="alert">{fieldErrors.name}</p>}
            </div>
            {attendance === 'accepted' && <fieldset className="guest-field" ref={guestsRef} tabIndex={-1} aria-describedby={fieldErrors.guests ? 'guests-error' : undefined}>
              <legend>Number of guests</legend>
              <div className="guest-stepper">
                <button type="button" aria-label="Remove one guest" onClick={() => { setGuests(n => Math.max(1, n - 1)); setFieldErrors(current => ({ ...current, guests: undefined })) }} disabled={guests === 1}><Minus /></button>
                <output aria-live="polite" aria-label="Number of guests">{guests}</output>
                <button type="button" aria-label="Add one guest" onClick={() => { setGuests(n => Math.min(4, n + 1)); setFieldErrors(current => ({ ...current, guests: undefined })) }} disabled={guests === 4}><Plus /></button>
              </div>
              {fieldErrors.guests && <p className="field-error" id="guests-error" role="alert">{fieldErrors.guests}</p>}
            </fieldset>}
            <label htmlFor="guest-notes">A little note <span className="optional">(optional)</span>
              <textarea ref={notesRef} id="guest-notes" name="notes" rows={3} maxLength={1000} value={notes}
                aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={fieldErrors.notes ? 'notes-error' : undefined}
                onChange={event => { setNotes(event.target.value); setFieldErrors(current => ({ ...current, notes: undefined })) }}
                placeholder="Dietary needs, a song request, or a little love…" />
            </label>
            {fieldErrors.notes && <p className="field-error" id="notes-error" role="alert">{fieldErrors.notes}</p>}
            {saveError && <p className="save-error" ref={errorRef} role="alert" tabIndex={-1}>{saveError}</p>}
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <>Saving your reply… <LoaderCircle className="saving-spinner" aria-hidden="true" /></> : <>{hasSaved ? 'Update my RSVP' : 'Send my RSVP'} <Send aria-hidden="true" /></>}
            </button>
          </fieldset>
          <p className="form-note">{storageAvailable ? 'Replies are saved privately. Use this browser for later changes.' : 'Your browser cannot remember this reply. Keep this tab open to make changes after saving.'}</p>
        </form>
      )}
    </div>
  )
}
