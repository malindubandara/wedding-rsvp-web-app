export const wedding = {
  couple: { bride: 'Meshara', groom: 'Udara', initials: 'M & U' },
  date: 'Friday, 27 November 2026',
  calendar: { startDate: '20261127', endDate: '20261128', timeZone: 'Asia/Colombo', utcOffset: '+05:30' },
  venue: { name: 'Vinrich Lake Resort', city: 'Piliyandala, Sri Lanka', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Vinrich+Lake+Resort+Piliyandala' },
  rsvpDeadline: '06 November 2026',
  timeline: [
    // { time: '10:00 AM', title: 'Guest arrival', description: 'Welcome drinks and warm embraces.' },
    { time: '09:20 AM', title: 'Registration', description: 'The beginning of our forever.' },
    { time: '09:46 AM', title: 'Poruwa ceremony', description: 'A beautiful blessing surrounded by family.' },
    { time: '12:30 PM', title: 'Lunch & reception', description: 'Good food, happy hearts, and a little dancing.' },
  ],
} as const

// An all-day event uses the following day as its exclusive end date.
export const googleCalendarUrl = `https://calendar.google.com/calendar/render?${new URLSearchParams({
  action: 'TEMPLATE',
  text: `${wedding.couple.bride} & ${wedding.couple.groom}'s Wedding`,
  dates: `${wedding.calendar.startDate}/${wedding.calendar.endDate}`,
  ctz: wedding.calendar.timeZone,
  location: `${wedding.venue.name}, ${wedding.venue.city}`,
  details: `Join us for our wedding celebration. Final timings to follow.\n\nDirections: ${wedding.venue.mapUrl}`,
}).toString()}`
