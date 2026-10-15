'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, Clock3, ExternalLink, Heart, Mail, MapPin, Menu, Sparkles, X } from 'lucide-react'
import { wedding } from '@/lib/wedding-config'
import RsvpForm from '@/components/rsvp-form'

const navigation = [['home', 'Home'], ['story', 'Our story'], ['wedding', 'The day'], ['gallery', 'Our moments'], ['rsvp', 'RSVP']] as const

function BotanicalSprig({ className = '' }: { className?: string }) {
  return (
    <svg className={`botanical-sprig ${className}`} viewBox="0 0 240 400" fill="none" aria-hidden="true">
      <path d="M113 391C115 300 94 218 139 105M117 308C56 280 49 230 29 198M114 260C174 227 183 178 211 150M118 198C75 157 86 114 69 73M136 120C175 96 170 53 190 24" stroke="currentColor" strokeWidth="1.5" />
      {[[115, 333, -40], [102, 297, 35], [99, 250, -35], [116, 214, 40], [125, 168, -25], [139, 124, 30], [75, 268, -55], [52, 236, -35], [151, 234, 55], [181, 196, 40], [94, 157, -40], [82, 118, -25], [164, 89, 45], [178, 54, 25]].map(([x, y, angle], i) => (
        <ellipse key={i} cx={x} cy={y} rx="11" ry="28" transform={`rotate(${angle} ${x} ${y})`} fill="currentColor" opacity={i % 3 === 0 ? '.38' : '.65'} />
      ))}
      {[[32, 193], [69, 72], [209, 146], [190, 24]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map(angle => <ellipse key={angle} cx="0" cy="-10" rx="7" ry="12" transform={`rotate(${angle})`} fill="#f0e5d7" stroke="#c7ad80" strokeWidth=".6" />)}
          <circle r="4" fill="#b59a68" />
        </g>
      ))}
    </svg>
  )
}

function WeddingRings({ className = '' }: { className?: string }) {
  return <svg className={`wedding-rings ${className}`} viewBox="0 0 100 64" fill="none" aria-hidden="true"><circle cx="37" cy="36" r="22" stroke="currentColor" strokeWidth="1.5" /><circle cx="63" cy="36" r="22" stroke="currentColor" strokeWidth="1.5" /><path d="m58 8 5-6 5 6-5 7-5-7Zm0 0h10" stroke="currentColor" strokeWidth="1.2" /></svg>
}

function OrnamentalLine({ light = false }: { light?: boolean }) {
  return <div className={`ornament ${light ? 'ornament-light' : ''}`} aria-hidden="true"><span /><Heart /><span /></div>
}

function InvitationCover({ opening, onOpen, onOpened }: { opening: boolean; onOpen: () => void; onOpened: () => void }) {
  return (
    <section className={`cover ${opening ? 'is-opening' : ''}`} aria-label="Wedding invitation cover" onAnimationEnd={event => {
      if (opening && event.target === event.currentTarget && event.animationName === 'invitationCoverExit') onOpened()
    }}>
      <div className="cover-ambient ambient-one" aria-hidden="true" /><div className="cover-ambient ambient-two" aria-hidden="true" />
      <p className="cover-overline"><span /> A little envelope. A lot of love. <span /></p>
      <div className="invitation-envelope">
        <div className="envelope-back" aria-hidden="true" />
        <div className="cover-paper">
          <div className="cover-arch" aria-hidden="true" />
          <BotanicalSprig className="cover-floral floral-left" /><BotanicalSprig className="cover-floral floral-right" />
          <WeddingRings />
          <p className="eyebrow">Together with their families</p>
          <h1><span>{wedding.couple.bride}</span><em>&amp;</em><span>{wedding.couple.groom}</span></h1>
          <p className="cover-invitation">invite you to share in their forever</p>
          <div className="cover-date"><span>Friday</span><strong>27</strong><span>November<br />2026</span></div>
          <p className="cover-venue">Vinrich Lake Resort <span>·</span> Piliyandala</p>
        </div>
        <div className="envelope-front" aria-hidden="true" />
        <button className="seal" onClick={onOpen} disabled={opening} aria-label="Break the seal and open our wedding invitation"><span>M<i>&amp;</i>U</span><Heart aria-hidden="true" /></button>
      </div>
      <button className="open-link" onClick={onOpen} disabled={opening}>{opening ? 'A beautiful day awaits' : 'Open our invitation'} <ArrowRight aria-hidden="true" /></button>
      <p className="cover-note">Made with love, just for you</p>
    </section>
  )
}

function Countdown() {
  const target = useMemo(() => new Date('2026-11-27T10:00:00+05:30').getTime(), [])
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setLeft(Math.max(0, target - Date.now()))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [target])
  const values = left === null ? null : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60]
  return (
    <section className="countdown section-pad">
      <div className="section-intro"><p className="eyebrow">Every second, a little closer</p><h2>Counting down <i>to forever</i></h2><p>One beautiful day. A lifetime of memories to come.</p></div>
      <div className="count-grid" aria-label="Countdown to the wedding">{['Days', 'Hours', 'Minutes', 'Seconds'].map((label, i) => <div className="count-unit" key={label}><strong key={values?.[i] ?? 'loading'} className="count-number">{values ? String(values[i]).padStart(2, '0') : '—'}</strong><span>{label}</span></div>)}</div>
      <p className="count-footnote"><Heart aria-hidden="true" /> Until we say “I do”</p>
    </section>
  )
}

function Nav() {
  const [menu, setMenu] = useState(false)
  const [active, setActive] = useState('home')
  const [scrolled, setScrolled] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sections = navigation.map(([id]) => document.getElementById(id))
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`
      setScrolled(window.scrollY > 40)
      let current = 'home'
      for (const section of sections) if (section && section.getBoundingClientRect().top <= window.innerHeight * .4) current = section.id
      setActive(current)
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); window.cancelAnimationFrame(frame) }
  }, [])
  useEffect(() => {
    if (!menu) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [menu])
  return (
    <header className={`site-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <a href="#home" className="nav-mark" aria-label="Meshara and Udara, home">M <span>&amp;</span> U<small>27.11.26</small></a>
      <nav id="invitation-navigation" aria-label="Main navigation" className={menu ? 'mobile-open' : ''}>{navigation.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setMenu(false)}>{label}</a>)}</nav>
      <a className="nav-rsvp" href="#rsvp" onClick={() => setMenu(false)}>We saved you a seat <ArrowRight aria-hidden="true" /></a>
      <button className="menu-button" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="invitation-navigation">{menu ? <X /> : <Menu />}</button>
      <div className="reading-progress" ref={progressRef} aria-hidden="true" />
    </header>
  )
}

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-arch" aria-hidden="true" /><BotanicalSprig className="hero-floral hero-floral-left" /><BotanicalSprig className="hero-floral hero-floral-right" />
      <span className="hero-side-note" aria-hidden="true">A new chapter begins</span>
      <div className="hero-content">
        <p className="eyebrow"><span className="tiny-star">✧</span> We’re getting married <span className="tiny-star">✧</span></p>
        <h1><span>Meshara</span><b>&amp;</b><span>Udara</span></h1>
        <p className="hero-copy">Two hearts. One beautiful beginning.</p>
        <OrnamentalLine />
        <div className="hero-meta"><span><CalendarDays aria-hidden="true" /> Friday, 27 November 2026</span><a href={wedding.venue.mapUrl} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Vinrich Lake Resort, Piliyandala <ExternalLink aria-hidden="true" /></a></div>
        <div className="hero-actions"><a className="primary-button" href="#rsvp">Join our celebration <ArrowRight aria-hidden="true" /></a><a className="calendar-link" href="/meshara-udara-wedding.ics" download><CalendarDays aria-hidden="true" /> Save the date</a></div>
      </div>
      <a href="#story" className="scroll-cue">Our story awaits <ArrowDown aria-hidden="true" /></a>
    </section>
  )
}

function Story() {
  return (
    <section id="story" className="story section-pad">
      <div className="story-art" data-reveal>
        <div className="story-art-frame"><BotanicalSprig className="story-floral" /><WeddingRings /><span className="story-monogram">M <i>&amp;</i> U</span><p>Some things are<br /><em>meant to be.</em></p><span className="eyebrow">Our forever starts here</span></div>
        <span className="story-stamp">with love<br /><Heart aria-hidden="true" /><br />always</span>
        <p className="image-caption">A new chapter, together · 2026</p>
      </div>
      <div className="story-copy" data-reveal><p className="eyebrow">The best is yet to come</p><h2>Our kind<br />of <i>forever.</i></h2><OrnamentalLine /><p className="lead">Every love story is beautiful,<br />but ours is our favourite.</p><p>With the love of our families and the people closest to our hearts, we’re beginning a new chapter. We would be so happy to have you by our side as we celebrate the start of our married life.</p><p>Here’s to a day full of happy tears, warm embraces, and memories we’ll keep forever.</p><div className="signature">Meshara &amp; Udara <Heart aria-hidden="true" /></div><a href="#wedding" className="text-link">A little more about our day <ArrowRight aria-hidden="true" /></a></div>
    </section>
  )
}

const events = [
  { icon: Heart, title: 'Registration', subtitle: 'The beginning of forever', desc: 'The moment we make our promise to one another.' },
  { icon: Sparkles, title: 'Poruwa ceremony', subtitle: 'Rooted in love & tradition', desc: 'A cherished Sri Lankan tradition, surrounded by family and blessings.' },
  { icon: Mail, title: 'Wedding reception', subtitle: 'Let’s make memories', desc: 'Good food, happy hearts, and a celebration with our favourite people.' },
]

function WeddingDetails() {
  return (
    <section id="wedding" className="details section-pad">
      <div className="section-intro" data-reveal><p className="eyebrow">A day made for love</p><h2>A celebration<br /><i>to remember.</i></h2><p>From our first promise to the last happy moment, we’d love to share it all with you.</p></div>
      <div className="event-grid">{events.map((event, i) => <article className="event-card" key={event.title} data-reveal><div className="event-top"><event.icon aria-hidden="true" /><span>0{i + 1}</span></div><p className="eyebrow">{event.subtitle}</p><h3>{event.title}</h3><p className="event-description">{event.desc}</p><dl><div><dt><CalendarDays aria-hidden="true" /> Date</dt><dd>27 November 2026</dd></div><div><dt><Clock3 aria-hidden="true" /> Time</dt><dd>To be confirmed</dd></div><div><dt><MapPin aria-hidden="true" /> Venue</dt><dd>Vinrich Lake Resort</dd></div></dl></article>)}</div>
      <a className="location-link" href={wedding.venue.mapUrl} target="_blank" rel="noreferrer"><span className="location-icon"><MapPin aria-hidden="true" /></span><span>Meet us by the lake<small>Vinrich Lake Resort · Piliyandala</small></span><span className="location-directions">Get directions <ExternalLink aria-hidden="true" /></span></a>
    </section>
  )
}

function Timeline() {
  return (
    <section className="timeline section-pad">
      <div className="timeline-heading" data-reveal><WeddingRings /><p className="eyebrow">Let the day unfold</p><h2>Little moments.<br /><i>Lasting memories.</i></h2><p>A little glimpse of the celebration ahead.</p><span className="timeline-date">27 / 11 / 2026</span></div>
      <div className="timeline-content"><div className="timeline-list">{wedding.timeline.map((item, i) => <div className="timeline-item" key={item.title} data-reveal><span className="timeline-dot">0{i + 1}</span><div><time>{item.time}</time><h3>{item.title}</h3><p>{item.description}</p></div></div>)}</div><p className="schedule-note"><Clock3 aria-hidden="true" /> A little preview of our day. Final timings to follow.</p></div>
    </section>
  )
}

function Gallery() {
  const memories = [{ title: 'The beginning', caption: 'A little spark. A beautiful story.', className: 'memory-sage', icon: Heart }, { title: 'The little things', caption: 'Our favourite place is together.', className: 'memory-rose', icon: Sparkles }, { title: 'Our next chapter', caption: 'And so the adventure begins.', className: 'memory-gold', icon: WeddingRings }]
  return (
    <section id="gallery" className="gallery section-pad"><div className="section-intro" data-reveal><p className="eyebrow">The moments we’ll keep</p><h2>A little glimpse <i>of us.</i></h2><p>Our favourite memories will find a home here. For now, a little love in every frame.</p></div><div className="gallery-grid">{memories.map((memory, i) => <article className={`memory-card ${memory.className}`} key={memory.title} data-reveal><div className="memory-art"><BotanicalSprig /><memory.icon className="memory-symbol" aria-hidden="true" /><span className="memory-art-label">{memory.caption}</span><span className="photo-soon">Photos coming soon</span></div><div className="memory-caption"><div><span className="eyebrow">Chapter 0{i + 1}</span><h3>{memory.title}</h3></div><Heart aria-hidden="true" /></div></article>)}</div></section>
  )
}

function RSVP() {
  return (
    <section id="rsvp" className="rsvp section-pad">
      <div className="rsvp-intro" data-reveal><span className="section-tag"><Mail aria-hidden="true" /> You’re on our favourite-people list</span><p className="eyebrow">The day won’t be the same without you</p><h2>We saved you<br /><i>a seat.</i></h2><OrnamentalLine /><p>Come for the love.<br />Stay for the memories.</p><span className="rsvp-deadline"><CalendarDays aria-hidden="true" /><span>Kindly reply by<strong>{wedding.rsvpDeadline}</strong></span></span><BotanicalSprig className="rsvp-floral" /></div>
      <RsvpForm />
    </section>
  )
}

function Footer() {
  return <footer className="footer"><BotanicalSprig className="footer-floral" /><WeddingRings /><p className="eyebrow">The beginning of our always</p><h2>Meshara <i>&amp;</i> Udara</h2><p>Your presence is our greatest gift.</p><a href="#home" className="back-to-top">Back to the beginning <ArrowUp aria-hidden="true" /></a><div className="footer-bottom"><span>Made with love <Heart aria-hidden="true" /></span><span>27 November 2026 · Piliyandala</span><span>© 2026 Meshara &amp; Udara</span></div></footer>
}

export default function Page() {
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed')
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (stage !== 'open') return
    window.scrollTo({ top: 0, behavior: 'instant' })
    mainRef.current?.focus({ preventScroll: true })
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.remove('reveal-pending')
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    }, { threshold: .08, rootMargin: '0px 0px -24px 0px' })
    elements.forEach((element, i) => { element.style.setProperty('--reveal-delay', `${i % 3 * 70}ms`); element.classList.add('reveal-pending'); observer.observe(element) })
    const showAll = () => { if (preference.matches) { observer.disconnect(); elements.forEach(element => element.classList.remove('reveal-pending')) } }
    preference.addEventListener('change', showAll)
    return () => { observer.disconnect(); preference.removeEventListener('change', showAll); elements.forEach(element => element.classList.remove('reveal-pending')) }
  }, [stage])
  if (stage !== 'open') return <InvitationCover opening={stage === 'opening'} onOpen={() => setStage('opening')} onOpened={() => setStage('open')} />
  return <div className="invitation-site is-open"><Nav /><main ref={mainRef} tabIndex={-1} aria-label="Wedding invitation"><Hero /><Countdown /><Story /><WeddingDetails /><Timeline /><Gallery /><RSVP /></main><Footer /></div>
}
