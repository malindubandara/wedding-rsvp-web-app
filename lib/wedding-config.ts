export const wedding = {
  couple: { bride: 'Meshara', groom: 'Udara', initials: 'M & U' },
  date: 'Friday, 27 November 2026',
  venue: { name: 'Vinrich Lake Resort', city: 'Piliyandala, Sri Lanka', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Vinrich+Lake+Resort+Piliyandala' },
  rsvpDeadline: '06 November 2026',
  timeline: [
    { time: '10:00 AM', title: 'Guest arrival', description: 'Welcome drinks and warm embraces.' },
    { time: '10:30 AM', title: 'Registration', description: 'The beginning of our forever.' },
    { time: '11:00 AM', title: 'Poruwa ceremony', description: 'A beautiful blessing surrounded by family.' },
    { time: '12:30 PM', title: 'Lunch & reception', description: 'Good food, happy hearts, and a little dancing.' },
  ],
} as const
