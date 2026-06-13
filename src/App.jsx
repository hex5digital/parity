import { useState, useRef, useEffect, useCallback } from "react"
import { generateAuditPDF } from './generatePDF.js'

// ── useIsMobile ────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

// ── useFocusTrap — keeps keyboard focus inside a modal ────────────
function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return
    const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const trap = (e) => {
      if (e.key !== 'Tab') return
      const els = Array.from(ref.current.querySelectorAll(FOCUSABLE)).filter(el => !el.closest('[hidden]'))
      if (!els.length) { e.preventDefault(); return }
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus() } }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [ref, active])
}

// ── Brand ─────────────────────────────────────────────────────────
const H5 = {
  primary:   "#19335A",
  secondary: "#0078BD",
  tertiary:  "#470069",
  light:     "#E8EFF5",
  muted:     "#555F6E",
  border:    "#B0BAC4",
  white:     "#FFFFFF",
  risk: {
    high:   { bg:"#FEE2E2", fg:"#7F1D1D", label:"High legal risk" },
    medium: { bg:"#FEF3C7", fg:"#78350F", label:"Medium legal risk" },
    low:    { bg:"#D1FAE5", fg:"#064E3B", label:"Low risk" },
  }
}

// ── fmt — currency formatter ────────────────────────────────────────
const fmt = n => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`

// ── Accessibility standards ────────────────────────────────────────
const STANDARDS = [
  { value:'wcag22aa',      label:'WCAG 2.2 AA',                    desc:'Most current standard. Includes all 2.0 and 2.1 requirements.' },
  { value:'wcag21aa',      label:'WCAG 2.1 AA',                    desc:'Most widely adopted. Common basis for legal compliance globally.' },
  { value:'wcag20aa',      label:'WCAG 2.0 AA',                    desc:'Foundational standard. Minimum for most compliance requirements.' },
  { value:'section508',    label:'Section 508',                     desc:'U.S. federal requirement for government websites and contractors.' },
  { value:'best-practice', label:'WCAG 2.2 AA + Best Practices',   desc:'Most thorough. Includes additional best practices beyond the standard.' },
]

// ── Global CSS ─────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; }
  :focus-visible { outline: 3px solid #00D4FF; outline-offset: 3px; }
  button { cursor: pointer; }
  button, a, input, select, textarea { min-height: 44px; }
  .skip-link { position:absolute; top:-100px; left:0; background:#19335A; color:#fff;
    padding:12px 20px; font-weight:600; font-size:14px; z-index:9999; text-decoration:none; }
  .skip-link:focus { top:0; }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
    overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%, 100% { opacity:1 } 50% { opacity:0 } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; }
  }

  /* ── Mobile overrides (< 640px) ── */
  @media (max-width: 639px) {
    .url-input-row { flex-direction: column !important; }
    .url-input-row input { border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
    .url-input-row button { border-left: none !important; border-top: 2px solid #00D4FF !important; width: 100% !important; }
    .lead-form-grid { grid-template-columns: 1fr !important; }
    .big-three-grid { grid-template-columns: 1fr !important; }
    .big-three-grid > div { border-bottom: 1px solid #B0BAC4; }
    .steps-grid { grid-template-columns: 1fr !important; }
    .cant-see-grid { grid-template-columns: 1fr !important; }
    .creds-grid { grid-template-columns: 1fr !important; }
    .context-bar { flex-direction: column !important; align-items: flex-start !important; }
    .context-bar-buttons { flex-direction: column !important; width: 100%; }
    .context-bar-buttons button, .context-bar-buttons a { width: 100% !important; text-align: center !important; }
    nav[aria-label="Site navigation"] { padding: 14px 20px !important; }
  }
`

// ── Email Report Modal (soft lead) ─────────────────────────────────
function EmailReportModal({ onClose, auditData }) {
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [sent, setSent]   = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()
  const dialogRef = useRef()

  useFocusTrap(dialogRef, true)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const valid = name.trim() && email.includes('@')

  const submit = async () => {
    if (!valid || loading) return
    setLoading(true)
    try {
      await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company: '',
          auditTarget: auditData.url,
          score: auditData.score,
          softLead: true,
        })
      })
    } catch(e) { console.error(e) }
    setLoading(false)
    setSent(true)
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="email-modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(25,51,90,0.85)',
        zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div ref={dialogRef} style={{ background:'#fff', maxWidth:400, width:'100%', border:`2px solid ${H5.primary}` }}>
        <div style={{ background:H5.primary, padding:'18px 24px', display:'flex', alignItems:'center' }}>
          <div>
            <h2 id="email-modal-title" style={{ color:'#fff', fontWeight:700, fontSize:16, margin:0 }}>
              Email me this report
            </h2>
            <p style={{ color:'#A8C4DC', fontSize:12, margin:'4px 0 0' }}>
              We'll send a link to your results — no full form required
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ marginLeft:'auto', background:'none', border:'1px solid #A8C4DC',
              color:'#fff', fontSize:18, cursor:'pointer', padding:'4px 10px', minHeight:36, minWidth:36 }}>
            ✕
          </button>
        </div>

        {!sent ? (
          <div style={{ padding:24 }}>
            <p style={{ fontSize:13, color:H5.muted, lineHeight:1.7, marginBottom:18 }}>
              Enter your name and email and we'll send you a link to these results.
              Hex5 Digital may follow up to walk through the findings with you.
            </p>
            <div style={{ marginBottom:12 }}>
              <label htmlFor="er-name" style={{ fontSize:12.5, color:H5.primary, display:'block',
                marginBottom:5, fontWeight:600 }}>Your name *</label>
              <input ref={inputRef} id="er-name" type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                style={{ width:'100%', padding:'10px 12px', fontSize:13.5,
                  border:`1.5px solid ${H5.border}`, color:'#1F2937', background:'#fff', outline:'none' }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label htmlFor="er-email" style={{ fontSize:12.5, color:H5.primary, display:'block',
                marginBottom:5, fontWeight:600 }}>Email address *</label>
              <input id="er-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="jane@company.com"
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                style={{ width:'100%', padding:'10px 12px', fontSize:13.5,
                  border:`1.5px solid ${H5.border}`, color:'#1F2937', background:'#fff', outline:'none' }} />
            </div>
            <button onClick={submit} disabled={!valid || loading}
              style={{ width:'100%', padding:13, border:'none',
                background: valid ? H5.secondary : '#9CA3AF',
                color:'#fff', fontSize:14, fontWeight:700,
                cursor: valid ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Sending…' : 'Send me the report →'}
            </button>
            <p style={{ fontSize:11, color:H5.muted, marginTop:10, textAlign:'center' }}>
              Your information is never sold.
            </p>
          </div>
        ) : (
          <div style={{ padding:'32px 24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }} role="img" aria-label="Email sent">📬</div>
            <h3 style={{ fontSize:17, fontWeight:700, color:H5.primary, marginBottom:8 }}>
              Check your inbox
            </h3>
            <p style={{ fontSize:13.5, color:'#374151', lineHeight:1.75, marginBottom:18 }}>
              We've noted your interest and will follow up at <strong>{email}</strong>.
            </p>
            <button onClick={onClose}
              style={{ padding:'10px 24px', border:`2px solid ${H5.primary}`,
                background:'#fff', color:H5.primary, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lead Modal ─────────────────────────────────────────────────────
function LeadModal({ onClose, onSubmit, auditData }) {
  const [form, setForm]         = useState({ name:'', email:'', company:'', role:'', phone:'' })
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const firstRef = useRef()
  const dialogRef = useRef()

  useFocusTrap(dialogRef, true)
  useEffect(() => { firstRef.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const set   = (k,v) => setForm(f => ({...f,[k]:v}))
  const valid = form.name.trim() && form.email.includes('@') && form.company.trim()

  const submit = async () => {
    if (!valid) return
    setLoading(true)
    try {
      const doc = await generateAuditPDF({
        issues: auditData.issues,
        target: auditData.target,
        score: auditData.score,
        totalDollarMin: auditData.totalDollarMin,
        totalDollarMax: auditData.totalDollarMax,
        standard: auditData.standard,
        lead: form,
      })
      doc.save(`Hex5-Parity-Audit-${(auditData.target||'report').replace(/[^a-z0-9]/gi,'-')}.pdf`)
      const pdfBase64 = doc.output('datauristring').split(',')[1]
      await fetch('/api/submit-lead', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          ...form,
          auditTarget:auditData.target,
          score:auditData.score,
          standard: auditData.standard,
          pdfBase64,
          pdfFilename: `Hex5-Parity-Audit-${(auditData.target||'report').replace(/[^a-z0-9]/gi,'-')}.pdf`,
        })
      })
    } catch(e) { console.error(e) }
    setLoading(false)
    setDone(true)
    onSubmit(form)
  }

  const fields = [
    { k:'name',    label:'Your name',    req:true,  type:'text',  ph:'Jane Smith',           span:1 },
    { k:'email',   label:'Work email',   req:true,  type:'email', ph:'jane@company.com',     span:1 },
    { k:'company', label:'Company',      req:true,  type:'text',  ph:'Acme Corp',            span:1 },
    { k:'role',    label:'Your title',   req:false, type:'text',  ph:'VP of Marketing',      span:1 },
    { k:'phone',   label:'Phone',        req:false, type:'tel',   ph:'+1 (555) 000-0000',    span:2 },
  ]

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(25,51,90,0.85)',
        zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div ref={dialogRef} style={{ background:'#fff', maxWidth:480, width:'100%', border:`2px solid ${H5.primary}` }}>
        <div style={{ background:H5.primary, padding:'20px 24px', display:'flex', alignItems:'center', gap:12 }}>
          <div>
            <h2 id="modal-title" style={{ color:'#fff', fontWeight:700, fontSize:17, margin:0 }}>
              Get the full report
            </h2>
            <p style={{ color:'#A8C4DC', fontSize:12, margin:'4px 0 0' }}>
              PDF downloads instantly · We may follow up to help
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ marginLeft:'auto', background:'none', border:'1px solid #A8C4DC',
              color:'#fff', fontSize:18, cursor:'pointer', padding:'4px 10px', minHeight:36, minWidth:36 }}>
            ✕
          </button>
        </div>

        {!done ? (
          <div style={{ padding:24 }}>
            <p style={{ fontSize:13.5, color:'#374151', lineHeight:1.75, marginBottom:20 }}>
              We'll generate your branded report immediately. Hex5 Digital may reach out to walk through the findings with you.
            </p>
            <div className="lead-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {fields.map((f,i) => (
                <div key={f.k} style={{ gridColumn:`span ${f.span}` }}>
                  <label htmlFor={`f-${f.k}`}
                    style={{ fontSize:12.5, color:H5.primary, display:'block', marginBottom:5, fontWeight:600 }}>
                    {f.label}{f.req && <span aria-hidden="true" style={{ color:'#991B1B' }}> *</span>}
                  </label>
                  <input ref={i===0?firstRef:null} id={`f-${f.k}`}
                    type={f.type} value={form[f.k]} placeholder={f.ph}
                    aria-required={f.req}
                    onChange={e => set(f.k, e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', fontSize:13.5,
                      border:`1.5px solid ${H5.border}`, color:'#1F2937', background:'#fff', outline:'none' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize:11.5, color:H5.muted, margin:'8px 0 16px' }}>
              <span aria-hidden="true" style={{ color:'#991B1B' }}>*</span> Required
            </p>
            <button onClick={submit} disabled={!valid||loading} aria-disabled={!valid||loading}
              style={{ width:'100%', padding:14, border:'none',
                background: valid ? H5.secondary : '#9CA3AF',
                color:'#fff', fontSize:15, fontWeight:700,
                cursor: valid ? 'pointer' : 'not-allowed' }}>
              {loading ? 'Generating your report…' : 'Download my report →'}
            </button>
            <p style={{ fontSize:11.5, color:H5.muted, marginTop:12, textAlign:'center' }}>
              Your information is never sold.
            </p>
          </div>
        ) : (
          <div style={{ padding:'36px 24px', textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:14 }} role="img" aria-label="Success">✅</div>
            <h3 style={{ fontSize:18, fontWeight:700, color:H5.primary, marginBottom:10 }}>
              Your report downloaded.
            </h3>
            <p style={{ fontSize:14, color:'#374151', lineHeight:1.75, marginBottom:20 }}>
              A confirmation went to <strong>{form.email}</strong>. A Hex5 Digital specialist may reach out to walk through the findings with your team.
            </p>
            <button onClick={onClose}
              style={{ padding:'11px 28px', border:`2px solid ${H5.primary}`,
                background:'#fff', color:H5.primary, fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Issue Card — business language first ───────────────────────────
function IssueCard({ issue }) {
  const [open, setOpen]     = useState(false)
  const [showDev, setShowDev] = useState(false)
  const rc = H5.risk[issue.risk]

  return (
    <div style={{ border:`1px solid ${H5.border}`, marginBottom:8, background:'#fff' }}
      role="region" aria-labelledby={`issue-h-${issue.id}`}>
      <button id={`issue-h-${issue.id}`}
        aria-expanded={open} aria-controls={`issue-p-${issue.id}`}
        onClick={() => setOpen(!open)}
        style={{ width:'100%', display:'flex', alignItems:'flex-start', gap:14,
          padding:'16px 18px', cursor:'pointer', border:'none',
          background: open ? H5.light : '#fff', textAlign:'left' }}>
        {/* Risk badge */}
        <span style={{ flexShrink:0, marginTop:2, fontSize:11, fontWeight:700,
          padding:'3px 10px', background:rc.bg, color:rc.fg,
          textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
          {rc.label}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14.5, fontWeight:600, color:H5.primary, lineHeight:1.4 }}>
            {issue.plain}
            {issue.likelySitewide && (
              <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:H5.tertiary,
                background:'#F3E8FF', padding:'2px 8px', textTransform:'uppercase',
                letterSpacing:'0.5px', verticalAlign:'middle' }}>
                Likely site-wide
              </span>
            )}          </div>
          {!open && (
            <div style={{ fontSize:12.5, color:H5.muted, marginTop:3 }}>
              {issue.count} {issue.count===1?'instance':'instances'} found
              &nbsp;·&nbsp; Est. {issue.effort} to fix
              &nbsp;·&nbsp; {fmt(issue.dollarMin)}–{fmt(issue.dollarMax)} at blended dev rates
            </div>
          )}
        </div>
        <span aria-hidden="true" style={{ fontSize:12, color:H5.muted, flexShrink:0, marginTop:4,
          display:'inline-block', transform:open?'rotate(180deg)':'none', transition:'0.2s' }}>▼</span>
      </button>

      <div id={`issue-p-${issue.id}`} hidden={!open}
        style={{ borderTop:`1px solid ${H5.border}`, padding:'18px 18px 20px' }}>

        {/* Who it affects */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:H5.muted, textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:6 }}>Who this affects</div>
          <p style={{ fontSize:13.5, color:'#1F2937', lineHeight:1.75 }}>{issue.who}</p>
          {issue.likelySitewide && (
            <p style={{ fontSize:12.5, color:H5.tertiary, lineHeight:1.7, marginTop:8,
              padding:'8px 12px', background:'#F3E8FF', borderLeft:`3px solid ${H5.tertiary}` }}>
              This was found in your site's shared header, navigation, footer, or
              global stylesheet — it likely affects every page that uses this
              template, not just the one scanned.
            </p>
          )}
        </div>

        {/* What needs to happen */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:H5.muted, textTransform:'uppercase',
            letterSpacing:'0.6px', marginBottom:6 }}>What needs to happen</div>
          <p style={{ fontSize:13.5, color:'#1F2937', lineHeight:1.75 }}>{issue.fix}</p>
        </div>

        {/* Cost + effort */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {[
            { label:'Instances found', val:issue.count },
            { label:'Est. hours',      val:issue.effort },
            { label:'Est. cost',       val:`${fmt(issue.dollarMin)}–${fmt(issue.dollarMax)}` },
          ].map(c => (
            <div key={c.label} style={{ background:H5.light, border:`1px solid ${H5.border}`,
              padding:'10px 16px', flex:1, minWidth:120 }}>
              <div style={{ fontSize:11, color:H5.muted, fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{c.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:H5.primary }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Technical detail — collapsed */}
        <button onClick={() => setShowDev(!showDev)}
          aria-expanded={showDev}
          style={{ fontSize:12, color:H5.secondary, background:'none', border:'none',
            cursor:'pointer', padding:0, textDecoration:'underline', minHeight:'auto' }}>
          {showDev ? 'Hide technical detail' : 'Show technical detail for your dev team'}
        </button>
        {showDev && (
          <div style={{ marginTop:10, padding:'12px 14px', background:'#F8FAFC',
            border:`1px solid ${H5.border}`, fontSize:12.5, color:H5.muted, lineHeight:1.7 }}>
            {issue.devDetail}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Results ────────────────────────────────────────────────────────
function Results({ target, data, onGetReport, onScanUrl, onEmailReport, unlocked, onUnlock }) {
  const { issues, score, totalDollarMin, totalDollarMax, navLinks, standard } = data
  const [nextUrl, setNextUrl] = useState('')
  const [showAllLinks, setShowAllLinks] = useState(false)

  const highRisk  = issues.filter(i=>i.risk==='high')
  const medRisk   = issues.filter(i=>i.risk==='medium')
  const lowRisk   = issues.filter(i=>i.risk==='low')
  const critCount = highRisk.length
  const riskLabel = critCount >= 3 ? 'High' : critCount >= 1 ? 'Medium' : 'Low'
  const riskColor = critCount >= 3 ? H5.risk.high : critCount >= 1 ? H5.risk.medium : H5.risk.low
  const noIssues  = issues.length === 0
  const isHighScore = score >= 80

  return (
    <div>
      <h1 className="sr-only">
        Accessibility audit results for {target}{standard ? ` — ${standard}` : ''}
      </h1>

      {/* ── Big three numbers ── */}
      <div className="big-three-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',
        gap:2, marginBottom:2, border:`1px solid ${H5.border}` }}>
        {[
          { val:score, sub:'out of 100', label:'Accessibility score',
            color: score>=80?H5.risk.low.fg:score>=50?H5.risk.medium.fg:H5.risk.high.fg },
          { val:riskLabel, sub:'legal risk level', label:'Your exposure', color:riskColor.fg },
          { val: noIssues ? '$0' : `${fmt(totalDollarMin)}–${fmt(totalDollarMax)}`,
            sub:'estimated to remediate', label:'Remediation cost', color:H5.secondary },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', padding:'24px 20px', textAlign:'center' }}>
            <div className="score-val" style={{ fontSize:32, fontWeight:700, color:c.color, lineHeight:1 }}>{c.val}</div>
            <div style={{ fontSize:12, color:H5.muted, marginTop:4 }}>{c.sub}</div>
            <div style={{ fontSize:11, fontWeight:700, color:H5.primary, marginTop:6,
              textTransform:'uppercase', letterSpacing:'0.5px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Score benchmark ── */}
      <div className="benchmark-row" style={{ background:'#fff', border:`1px solid ${H5.border}`, borderTop:'none',
        padding:'12px 20px', marginBottom:2, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 200px', minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5,
            color:H5.muted, marginBottom:5 }}>
            <span>Your score: <strong style={{ color: score>=80?H5.risk.low.fg:score>=50?H5.risk.medium.fg:H5.risk.high.fg }}>{score}</strong></span>
            <span>Industry average: <strong>57</strong></span>
          </div>
          <div role="img" aria-label={`Score ${score} out of 100. Industry average is 57.`}
            style={{ position:'relative', height:6, background:H5.light, borderRadius:3 }}>
            <div aria-hidden="true" style={{ position:'absolute', left:'57%', top:-3, width:2, height:12,
              background:H5.muted, borderRadius:1 }} />
            <div aria-hidden="true" style={{ width:`${score}%`, height:'100%', borderRadius:3,
              background: score>=80?H5.risk.low.fg:score>=50?H5.risk.medium.fg:H5.risk.high.fg,
              transition:'width 0.6s ease' }} />
          </div>
        </div>
        <p style={{ fontSize:12, color:H5.muted, margin:0, flex:'1 1 200px' }}>
          {score > 57
            ? `You're scoring above the industry average of 57 — but you still have issues that could attract legal attention.`
            : score === 57
            ? `You're right at the industry average of 57. Most sites at this level still carry meaningful legal exposure.`
            : `You're scoring below the industry average of 57. Sites at this level are more frequently targeted in ADA Title III litigation.`
          }
        </p>
      </div>

      {/* Disclaimers */}
      <p style={{ fontSize:11.5, color:H5.muted, lineHeight:1.6, margin:'8px 0 4px', padding:'0 2px' }}>
        Estimate reflects only the issues detected on this single page. Where possible,
        we've flagged issues in your site's shared header, navigation, footer, or
        global stylesheet as <strong>likely site-wide</strong> — but a full manual
        review often surfaces additional issues automated scans cannot detect.
      </p>
      <p style={{ fontSize:11.5, color:H5.muted, lineHeight:1.6, margin:'0 0 16px', padding:'0 2px' }}>
        This is an automated screening tool, not a legal opinion — think of it as the tip of the iceberg.
      </p>

      {/* ── HIGH SCORE FLOW (80+) ── */}
      {isHighScore && (
        <div style={{ background:'#F0FDF4', border:`1px solid ${H5.risk.low.fg}44`,
          padding:'20px 24px', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:700, color:H5.risk.low.fg, marginBottom:8 }}>
                {noIssues
                  ? 'No automated issues found — your homepage looks clean.'
                  : `Your homepage is above average with ${issues.length} minor item${issues.length>1?'s':''} to address.`
                }
              </p>
              <p style={{ fontSize:13.5, color:'#374151', lineHeight:1.7, marginBottom:12 }}>
                Automated scans only catch 30–40% of real-world accessibility issues. Even
                clean-scoring sites often have gaps in keyboard navigation, screen reader flow,
                PDFs, and video captions that only a manual review can surface.
              </p>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>
                Want to confirm your full-site coverage? Our team can run a complete
                manual audit — and alert you if anything changes as your content updates.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              <button onClick={onEmailReport}
                style={{ padding:'12px 20px', border:'none', background:H5.risk.low.fg,
                  color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                Get a free consultation →
              </button>
              {!noIssues && (
                <button onClick={onGetReport}
                  style={{ padding:'10px 20px', border:`1px solid ${H5.risk.low.fg}`,
                    background:'transparent', color:H5.risk.low.fg, fontSize:13,
                    fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                  See the {issues.length} minor item{issues.length>1?'s':''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LOW/MEDIUM SCORE — issue teaser + gate ── */}
      {!isHighScore && !unlocked && (
        <div style={{ background:'#fff', border:`1px solid ${H5.border}`,
          padding:'20px 24px', marginBottom:24 }}>
          {/* Issue count teasers */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            {highRisk.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:12,
                background:H5.risk.high.bg, padding:'12px 16px', flex:'1 1 160px' }}>
                <div style={{ fontSize:32, fontWeight:700, color:H5.risk.high.fg, lineHeight:1,
                  fontFamily:"'JetBrains Mono', monospace" }}>{highRisk.length}</div>
                <div>
                  <div style={{ fontSize:11.5, fontWeight:700, color:H5.risk.high.fg,
                    textTransform:'uppercase', letterSpacing:'0.4px' }}>High legal risk</div>
                  <div style={{ fontSize:11, color:H5.risk.high.fg, opacity:0.75, marginTop:2 }}>
                    {highRisk.length === 1 ? 'issue' : 'issues'} — commonly cited in ADA lawsuits
                  </div>
                </div>
              </div>
            )}
            {medRisk.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:12,
                background:H5.risk.medium.bg, padding:'12px 16px', flex:'1 1 160px' }}>
                <div style={{ fontSize:32, fontWeight:700, color:H5.risk.medium.fg, lineHeight:1,
                  fontFamily:"'JetBrains Mono', monospace" }}>{medRisk.length}</div>
                <div>
                  <div style={{ fontSize:11.5, fontWeight:700, color:H5.risk.medium.fg,
                    textTransform:'uppercase', letterSpacing:'0.4px' }}>Medium risk</div>
                  <div style={{ fontSize:11, color:H5.risk.medium.fg, opacity:0.75, marginTop:2 }}>
                    {medRisk.length === 1 ? 'issue' : 'issues'} — address after high-risk fixes
                  </div>
                </div>
              </div>
            )}
            {lowRisk.length > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:12,
                background:H5.light, border:`1px solid ${H5.border}`, padding:'12px 16px', flex:'1 1 160px' }}>
                <div style={{ fontSize:32, fontWeight:700, color:H5.muted, lineHeight:1,
                  fontFamily:"'JetBrains Mono', monospace" }}>{lowRisk.length}</div>
                <div>
                  <div style={{ fontSize:11.5, fontWeight:700, color:H5.muted,
                    textTransform:'uppercase', letterSpacing:'0.4px' }}>Lower priority</div>
                  <div style={{ fontSize:11, color:H5.muted, marginTop:2 }}>
                    {lowRisk.length === 1 ? 'issue' : 'issues'} — good to address over time
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gate */}
          <div style={{ borderTop:`1px solid ${H5.border}`, paddingTop:16 }}>
            <p style={{ fontSize:14.5, fontWeight:700, color:H5.primary, marginBottom:6 }}>
              {critCount >= 3
                ? `Your site has ${critCount} high-risk issues that commonly appear in ADA Title III lawsuits.`
                : critCount >= 1
                ? `Your site has ${critCount} high-risk issue${critCount>1?'s':''} that could attract legal attention.`
                : `Your site has ${medRisk.length} issue${medRisk.length>1?'s':''} to address for full compliance.`
              }
            </p>
            <p style={{ fontSize:13, color:H5.muted, lineHeight:1.6, marginBottom:16 }}>
              Enter your details to see exactly what they are, who they affect, and what it
              would cost to fix — plus get a branded PDF report to share with your team.
            </p>
            <button onClick={onGetReport}
              style={{ padding:'14px 28px', border:'none', background:H5.secondary,
                color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer',
                borderLeft:`3px solid ${H5.tertiary}`, display:'block',
                width:'100%', maxWidth:400, textAlign:'left' }}>
              See what's broken and how to fix it →
            </button>
            <p style={{ fontSize:11.5, color:H5.muted, marginTop:8 }}>
              Free. Takes 30 seconds. You'll also get a PDF report to share with your team.
            </p>
          </div>
        </div>
      )}

      {/* ── UNLOCKED or HIGH SCORE — full issue list ── */}
      {(unlocked || isHighScore) && issues.length > 0 && (
        <>
          {unlocked && (
            <div className="context-bar" style={{ background:riskColor.bg, border:`1px solid ${riskColor.fg}33`,
              padding:'14px 20px', marginBottom:24,
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <p style={{ fontSize:13.5, color:riskColor.fg, lineHeight:1.6, margin:0, maxWidth:560 }}>
                {critCount >= 3
                  ? `Your site has ${critCount} high-risk issues commonly cited in ADA Title III lawsuits. Remediation typically resolves legal exposure within 60–90 days.`
                  : critCount >= 1
                  ? `Your site has ${critCount} high-risk issue${critCount>1?'s':''} that could attract legal attention. Addressing these first significantly reduces your exposure.`
                  : 'No high-risk issues found. Address medium-risk items to reach full compliance.'
                }
              </p>
              <button onClick={onEmailReport}
                style={{ padding:'10px 18px', border:`1px solid ${riskColor.fg}`, background:'transparent',
                  color:riskColor.fg, fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                Email me this
              </button>
            </div>
          )}

          {highRisk.length > 0 && (
            <section aria-label="High risk issues" style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:700, color:H5.risk.high.fg,
                textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10,
                paddingBottom:8, borderBottom:`2px solid ${H5.risk.high.fg}` }}>
                High legal risk — fix these first ({highRisk.length})
              </h2>
              {highRisk.map(i => <IssueCard key={i.id} issue={i} />)}
            </section>
          )}

          {medRisk.length > 0 && (
            <section aria-label="Medium risk issues" style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:700, color:H5.risk.medium.fg,
                textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10,
                paddingBottom:8, borderBottom:`2px solid ${H5.risk.medium.fg}` }}>
                Medium risk — address after high-risk fixes ({medRisk.length})
              </h2>
              {medRisk.map(i => <IssueCard key={i.id} issue={i} />)}
            </section>
          )}

          {lowRisk.length > 0 && (
            <section aria-label="Low risk issues" style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:700, color:H5.muted,
                textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10,
                paddingBottom:8, borderBottom:`2px solid ${H5.border}` }}>
                Lower priority ({lowRisk.length})
              </h2>
              {lowRisk.map(i => <IssueCard key={i.id} issue={i} />)}
            </section>
          )}
        </>
      )}

      {noIssues && (
        <div style={{ background:'#fff', border:`1px solid ${H5.border}`, padding:'32px 24px',
          textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:32, marginBottom:10 }} role="img" aria-label="Checkmark">✅</div>
          <p style={{ fontSize:14.5, color:'#374151', lineHeight:1.8, maxWidth:480, margin:'0 auto' }}>
            No automated issues found on this page. Automated scans typically catch
            30–40% of real-world issues — a full manual review can confirm the rest.
          </p>
        </div>
      )}

      {/* ── What this scan can't see ── */}
      <div style={{ background:H5.light, border:`1px solid ${H5.border}`, borderTop:'none',
        padding:'20px 24px', marginBottom:24 }}>
        <h2 style={{ fontSize:13, fontWeight:700, color:H5.primary, marginBottom:10,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>
          What this scan can't see
        </h2>
        <p style={{ fontSize:12.5, color:H5.muted, lineHeight:1.7, marginBottom:14 }}>
          Automated tools detect roughly 30–40% of real-world accessibility barriers.
          The items below require a manual review — and are just as likely to appear in litigation.
        </p>
        <div className="cant-see-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',
          gap:10 }}>
          {[
            { icon:'🎹', title:'Keyboard navigation', desc:'Can a user tab through your entire site without a mouse? Screen reader and motor-impaired users depend on this.' },
            { icon:'🔊', title:'Screen reader flow', desc:'Does your content read in the right order? Are dynamic updates announced? Only a real screen reader test reveals this.' },
            { icon:'📄', title:'PDFs & documents', desc:'Downloadable files have their own WCAG requirements. Most PDFs on the web fail basic accessibility checks.' },
            { icon:'🎬', title:'Video captions & audio', desc:'Auto-generated captions often contain errors. Transcripts and audio descriptions may also be required.' },
            { icon:'🧠', title:'Cognitive accessibility', desc:"Plain language, consistent navigation, clear error messages — these aren't detectable by scanners." },
          ].map(item => (
            <div key={item.title} style={{ background:'#fff', padding:'14px 16px',
              border:`1px solid ${H5.border}` }}>
              <div aria-hidden="true" style={{ fontSize:20, marginBottom:6 }}>{item.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color:H5.primary, marginBottom:4 }}>{item.title}</div>
              <div style={{ fontSize:12, color:H5.muted, lineHeight:1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:12.5, color:H5.primary, fontWeight:600, marginTop:14, marginBottom:0 }}>
          A conversation with Hex5 Digital's accessibility team is the only way to get the full picture.{' '}
          <a href="mailto:accessibility@hex5digital.com"
            style={{ color:H5.secondary, textDecoration:'underline' }}>
            Schedule a review →
          </a>
        </p>
      </div>

      {/* ── Bottom CTA (only shown when unlocked or high score) ── */}
      {(unlocked || isHighScore) && (
        <div style={{ background:H5.primary, padding:'28px 24px',
          borderLeft:`4px solid ${H5.secondary}` }}>
          <div className="bottom-cta-top" style={{ display:'flex', alignItems:'flex-start',
            justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:20 }}>
            <div>
              <h2 style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:6 }}>
                Ready to fix this?
              </h2>
              <div style={{ color:'#A8C4DC', fontSize:13.5, lineHeight:1.6, maxWidth:480 }}>
                The estimate above reflects Hex5 Digital's typical remediation rates —
                the same team that can fix it. Most projects are resolved in 30–60 days.
              </div>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <a href="mailto:accessibility@hex5digital.com"
                style={{ padding:'12px 22px', border:'none', background:H5.secondary,
                  color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none',
                  display:'inline-flex', alignItems:'center' }}>
                Talk to us
              </a>
              <button onClick={onEmailReport}
                style={{ padding:'12px 18px', border:'1px solid rgba(255,255,255,0.4)',
                  color:'#fff', fontSize:13.5, fontWeight:600, cursor:'pointer',
                  background:'transparent' }}>
                Email me this
              </button>
            </div>
          </div>
          <div className="steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
            gap:16, borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:18 }}>
            {[
              { step:'1', title:'Full-site audit',  desc:'We scan every page and template, plus a manual review for anything automated tools miss.' },
              { step:'2', title:'Scoped quote',      desc:"A fixed-price remediation plan based on your actual codebase — no surprises." },
              { step:'3', title:'Fix & verify',      desc:'Code, design system, and document fixes, with re-testing to confirm conformance.' },
            ].map(s => (
              <div key={s.step}>
                <div aria-hidden="true" style={{ color:'#7FB8E0', fontSize:11, fontWeight:700,
                  letterSpacing:'0.5px', marginBottom:4 }}>STEP {s.step}</div>
                <div style={{ color:'#fff', fontSize:13.5, fontWeight:700, marginBottom:4 }}>{s.title}</div>
                <div style={{ color:'#A8C4DC', fontSize:12, lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Scan another page ── */}
      <div style={{ background:'#fff', border:`1px solid ${H5.border}`, borderTop:'none',
        padding:'20px 24px' }}>
        <h2 style={{ fontSize:13, fontWeight:700, color:H5.primary, marginBottom:4,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>
          Check another page on this site
        </h2>
        <p style={{ fontSize:12.5, color:H5.muted, lineHeight:1.6, marginBottom:14 }}>
          Issues often vary by page. Enter a URL to scan another page on this site.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap',
          marginBottom: navLinks?.length ? 14 : 0 }}>
          <label htmlFor="rescan-url" className="sr-only">URL of another page to scan</label>
          <input id="rescan-url" type="url" value={nextUrl}
            onChange={e => setNextUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nextUrl.trim()) onScanUrl(nextUrl) }}
            placeholder="https://yourwebsite.com/another-page"
            style={{ flex:'1 1 240px', padding:'10px 14px', fontSize:13.5,
              border:`1px solid ${H5.border}`, minHeight:'auto' }} />
          <button onClick={() => nextUrl.trim() && onScanUrl(nextUrl)}
            style={{ padding:'10px 20px', border:'none', background:H5.primary,
              color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>
            Scan this page
          </button>
        </div>
        {navLinks && navLinks.length > 0 && (
          <div>
            <div style={{ fontSize:11.5, color:H5.muted, marginBottom:8 }}>
              Or pick a page from this site's navigation:
            </div>
            <div className="nav-link-row" style={{ display:'flex',
              flexWrap: showAllLinks ? 'wrap' : 'nowrap',
              overflowX: showAllLinks ? 'visible' : 'auto', gap:6, paddingBottom:4 }}>
              {(showAllLinks ? navLinks : navLinks.slice(0, 6)).map(link => (
                <button key={link.url} onClick={() => onScanUrl(link.url)}
                  aria-label={`Scan ${link.label} (${link.url})`}
                  style={{ fontSize:12, color:H5.secondary, background:H5.light,
                    border:`1px solid ${H5.border}`, padding:'6px 12px', cursor:'pointer',
                    fontWeight:600, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis',
                    whiteSpace:'nowrap', flexShrink:0 }}>
                  {link.label}
                </button>
              ))}
              {!showAllLinks && navLinks.length > 6 && (
                <button onClick={() => setShowAllLinks(true)}
                  style={{ fontSize:12, color:H5.muted, background:'#fff',
                    border:`1px dashed ${H5.border}`, padding:'6px 12px', cursor:'pointer',
                    fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
                  +{navLinks.length - 6} more
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl]         = useState('')
  const [standard, setStandard] = useState('wcag22aa')
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [scanned, setScanned] = useState(false)
  const [scanData, setScanData] = useState(null)
  const [error, setError]     = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const mainRef = useRef()
  const inputRef = useRef()

  // ── Scan history (localStorage) ───────────────────────────────────
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('parity_history') || '[]')
    } catch { return [] }
  })

  const saveToHistory = (data) => {
    const entry = {
      url: data.url,
      score: data.score,
      standard: data.standard,
      scannedAt: data.scannedAt,
      totalDollarMin: data.totalDollarMin,
      totalDollarMax: data.totalDollarMax,
    }
    const updated = [entry, ...history.filter(h => h.url !== data.url)].slice(0, 10)
    setHistory(updated)
    try { localStorage.setItem('parity_history', JSON.stringify(updated)) } catch {}
  }

  const runScan = async (overrideUrl) => {
    const targetUrl = (overrideUrl ?? url).trim()
    if (!targetUrl) { inputRef.current?.focus(); return }
    if (overrideUrl) setUrl(overrideUrl)
    setScanned(false)
    setScanData(null)
    setError(null)
    setLoading(true)
    setUnlocked(false)

    // Rotate through status messages while the real scan runs in the background
    const msgs = [
      'Connecting to your site…',
      'Scanning for accessibility barriers…',
      'Checking color contrast, labels, and structure…',
      'Assessing legal risk…',
      'Estimating remediation costs…',
    ]
    let msgIndex = 0
    setLoadMsg(msgs[0])
    const msgInterval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, msgs.length - 1)
      setLoadMsg(msgs[msgIndex])
    }, 2500)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, standard }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.message || 'Something went wrong while scanning. Please try again.')
        setLoading(false)
        clearInterval(msgInterval)
        return
      }

      setScanData(data)
      setScanned(true)
      saveToHistory(data)
    } catch (err) {
      console.error(err)
      setError("We couldn't reach the scanner. Please try again in a moment.")
    } finally {
      clearInterval(msgInterval)
      setLoading(false)
      setTimeout(() => mainRef.current?.focus(), 50)
    }
  }

  const handleKey = e => { if (e.key === 'Enter') runScan() }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── HERO ── */}
      {!scanned && !loading && (
        <div style={{ background:'#0A0F1E', position:'relative', overflow:'hidden' }}>
          <div aria-hidden="true" style={{
            position:'absolute', inset:0, opacity:0.035, pointerEvents:'none',
            backgroundImage:'linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)',
            backgroundSize:'48px 48px',
          }} />
          <nav aria-label="Site navigation" style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'18px 40px', position:'relative', zIndex:1,
            borderBottom:'1px solid rgba(255,255,255,0.06)',
          }}>
            <a href="https://hex5digital.com" aria-label="Hex5 Digital home"
              style={{ display:'flex', alignItems:'center', gap:12, textDecoration:'none' }}>
              <img src="/logo-white.png" alt="Hex5 Digital" style={{ height:26 }} />
              <span aria-hidden="true" style={{ width:1, height:16, background:'rgba(255,255,255,0.2)' }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11,
                color:'rgba(0,212,255,0.7)', fontWeight:700, letterSpacing:'1px',
                textTransform:'uppercase' }}>Parity</span>
            </a>
            <a href="mailto:accessibility@hex5digital.com"
              style={{ fontSize:12.5, fontWeight:600, color:'rgba(255,255,255,0.6)',
                textDecoration:'none', padding:'8px 16px',
                border:'1px solid rgba(255,255,255,0.12)',
                fontFamily:"'Inter', sans-serif" }}>
              Talk to an expert
            </a>
          </nav>

          <div style={{ maxWidth:640, margin:'0 auto', padding:'72px 32px 64px',
            position:'relative', zIndex:1, textAlign:'center' }}>

            <div style={{ display:'inline-flex', alignItems:'center', gap:8,
              background:'rgba(0,212,255,0.07)', border:'1px solid rgba(0,212,255,0.18)',
              padding:'6px 14px', marginBottom:36 }}>
              <span aria-hidden="true" style={{ width:6, height:6, borderRadius:'50%',
                background:'#00D4FF', boxShadow:'0 0 8px rgba(0,212,255,0.8)', flexShrink:0 }} />
              <span style={{ fontSize:10.5, fontWeight:700, color:'#00D4FF',
                letterSpacing:'1.5px', textTransform:'uppercase',
                fontFamily:"'JetBrains Mono', monospace" }}>
                Free · Instant · No account needed
              </span>
            </div>

            <h1 style={{ fontFamily:"'JetBrains Mono', monospace",
              fontSize:'clamp(56px, 12vw, 96px)', fontWeight:700, color:'#ffffff',
              letterSpacing:'-3px', lineHeight:0.92, marginBottom:8 }}>
              PARITY
              <span aria-hidden="true" style={{ display:'inline-block', width:'0.07em',
                height:'0.82em', background:'#00D4FF', marginLeft:6, verticalAlign:'-0.04em',
                animation:'blink 1.1s step-end infinite' }} />
            </h1>

            <p style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11.5,
              color:'rgba(0,212,255,0.55)', letterSpacing:'1px', marginBottom:36 }}>
              an accessibility scanner by Hex5 Digital
            </p>

            <p style={{ fontSize:'clamp(15px,2.5vw,18px)', color:'rgba(255,255,255,0.65)',
              lineHeight:1.75, marginBottom:40, fontFamily:"'Inter', sans-serif" }}>
              Paste a URL. Get your accessibility score, legal risk level,
              and exact remediation cost in seconds.
            </p>

            <div>
              <div className="url-input-row" style={{ display:'flex',
                background:'rgba(255,255,255,0.04)',
                border:'1.5px solid rgba(255,255,255,0.12)' }}>
                <label htmlFor="site-url" className="sr-only">Your website URL</label>
                <input ref={inputRef} id="site-url" type="url"
                  value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey}
                  placeholder="https://yourwebsite.com"
                  aria-describedby="url-hint"
                  style={{ flex:1, padding:'15px 20px', fontSize:15, border:'none',
                    outline:'none', color:'#fff', background:'transparent',
                    fontFamily:"'Inter', sans-serif" }} />
                <button onClick={runScan}
                  style={{ padding:'15px 28px', border:'none', background:'#0078BD',
                    color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
                    whiteSpace:'nowrap', fontFamily:"'Inter', sans-serif",
                    borderLeft:'2px solid #00D4FF' }}>
                  Check my site
                </button>
              </div>
              <p id="url-hint" style={{ fontSize:11.5, color:'rgba(255,255,255,0.3)',
                marginTop:9, fontFamily:"'Inter', sans-serif", textAlign:'left' }}>
                Any publicly accessible URL — your homepage, a product page, or a landing page.
              </p>
              {error && (
                <div role="alert" style={{ background:'rgba(239,68,68,0.1)',
                  border:'1px solid rgba(239,68,68,0.25)', padding:'14px 16px',
                  marginTop:12, textAlign:'left' }}>
                  <p style={{ fontSize:13, color:'#FCA5A5', fontWeight:600, marginBottom:4 }}>
                    Scan failed
                  </p>
                  <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.55)', lineHeight:1.6, margin:0 }}>
                    {error}
                  </p>
                </div>
              )}
            </div>

            <dl style={{ display:'flex', justifyContent:'center', marginTop:56,
              paddingTop:32, borderTop:'1px solid rgba(255,255,255,0.06)',
              flexWrap:'wrap', gap:0 }}>
              {[
                ['4,000+', 'ADA lawsuits filed in 2023'],
                ['96%',    'of top sites have failures'],
                ['1 in 4', 'Americans have a disability'],
              ].map(([stat, label], i) => (
                <div key={stat} style={{ flex:'1 1 130px', padding:'0 28px',
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                  <dt style={{ fontFamily:"'JetBrains Mono', monospace",
                    fontSize:22, fontWeight:700, color:'#00D4FF', lineHeight:1 }}>{stat}</dt>
                  <dd style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:6,
                    fontFamily:"'Inter', sans-serif", lineHeight:1.4 }}>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* ── Standard selector + history ── */}
      {!scanned && !loading && (
        <div style={{ background:'#F8FAFC', borderBottom:`1px solid ${H5.border}` }}>
          <div style={{ maxWidth:680, margin:'0 auto', padding:'28px 32px' }}>
            <fieldset style={{ border:'none', padding:0, margin:0 }}>
              <legend style={{ fontSize:11, fontWeight:700, color:H5.muted, marginBottom:10,
                display:'block', textTransform:'uppercase', letterSpacing:'0.8px' }}>
                Assess against which standard?
              </legend>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {STANDARDS.map(s => (
                  <label key={s.value} style={{ display:'flex', alignItems:'center', gap:6,
                    cursor:'pointer', padding:'7px 14px',
                    border:`1.5px solid ${standard === s.value ? H5.secondary : H5.border}`,
                    background: standard === s.value ? '#EBF5FC' : '#fff',
                    fontSize:12.5, fontWeight: standard === s.value ? 700 : 400,
                    color: standard === s.value ? H5.secondary : '#374151',
                    transition:'all 0.15s' }}>
                    <input type="radio" name="standard" value={s.value}
                      checked={standard === s.value}
                      onChange={() => setStandard(s.value)}
                      style={{ accentColor:H5.secondary, width:13, height:13, minHeight:'auto' }} />
                    {s.label}
                  </label>
                ))}
              </div>
              <p style={{ fontSize:11.5, color:H5.muted, marginTop:8, lineHeight:1.6 }}>
                {STANDARDS.find(s => s.value === standard)?.desc}
              </p>
            </fieldset>

            {history.length > 0 && (
              <div style={{ marginTop:20, paddingTop:18, borderTop:`1px solid ${H5.border}` }}>
                <h3 style={{ fontSize:10.5, fontWeight:700, color:H5.muted, textTransform:'uppercase',
                  letterSpacing:'0.8px', marginBottom:10 }}>Previously scanned</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {history.map(h => (
                    <button key={h.url} onClick={() => runScan(h.url)}
                      aria-label={`Re-scan ${h.url}, previously scored ${h.score}`}
                      style={{ display:'flex', alignItems:'center', gap:12, width:'100%',
                        background:'#fff', border:`1px solid ${H5.border}`, padding:'9px 14px',
                        cursor:'pointer', textAlign:'left' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, color:H5.primary,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {h.url}
                        </div>
                        <div style={{ fontSize:11, color:H5.muted, marginTop:2 }}>
                          Score: <strong style={{ color: h.score>=80?H5.risk.low.fg:h.score>=50?H5.risk.medium.fg:H5.risk.high.fg }}>{h.score}</strong>
                          {h.standard && <> &nbsp;·&nbsp; {h.standard}</>}
                          &nbsp;·&nbsp;{new Date(h.scannedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span aria-hidden="true" style={{ fontSize:11.5, color:H5.secondary,
                        fontWeight:600, whiteSpace:'nowrap' }}>Re-scan →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div role="status" aria-live="polite"
          style={{ background:'#0A0F1E', minHeight:'100vh', display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center',
            padding:'40px 24px', textAlign:'center' }}>
          <div style={{ width:36, height:36,
            border:'2.5px solid rgba(0,212,255,0.15)',
            borderTop:'2.5px solid #00D4FF', borderRadius:'50%',
            animation:'spin 0.8s linear infinite', marginBottom:24 }} />
          <p style={{ fontSize:16, color:'#fff', fontWeight:600, marginBottom:6,
            fontFamily:"'Inter', sans-serif" }}>{loadMsg}</p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)',
            fontFamily:"'JetBrains Mono', monospace" }}>auditing {url}</p>
        </div>
      )}

      {/* ── Results wrapper ── */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px 64px' }}>
        {scanned && !loading && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 0', borderBottom:`1px solid ${H5.border}`, marginBottom:24,
            flexWrap:'wrap', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <img src="/logo-dark.png" alt="Hex5 Digital" style={{ height:22 }} />
              <span aria-hidden="true" style={{ width:1, height:14, background:H5.border }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11,
                color:H5.secondary, fontWeight:700, letterSpacing:'1px',
                textTransform:'uppercase' }}>Parity</span>
            </div>
            <button onClick={() => { setScanned(false); setScanData(null); setUrl('') }}
              style={{ fontSize:12, color:H5.secondary, background:'none',
                border:'none', cursor:'pointer', textDecoration:'underline',
                padding:0, minHeight:'auto' }}>
              ← New scan
            </button>
          </div>
        )}

        <main id="main-content" tabIndex={-1} ref={mainRef} style={{ outline:'none' }}>
          {scanned && !loading && scanData && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10,
                marginBottom:20, flexWrap:'wrap' }}>
                <div style={{ fontSize:13, color:H5.muted }}>
                  Results for <strong style={{ color:H5.primary }}>{scanData.url}</strong>
                  {scanData.standard && (
                    <span style={{ marginLeft:8, fontSize:10.5, fontWeight:700,
                      color:H5.secondary, background:'#EBF5FC',
                      padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.5px',
                      fontFamily:"'JetBrains Mono', monospace" }}>
                      {scanData.standard}
                    </span>
                  )}
                </div>
              </div>
              <Results
                target={scanData.url}
                data={scanData}
                unlocked={unlocked}
                onUnlock={() => setUnlocked(true)}
                onGetReport={() => setShowModal(true)}
                onScanUrl={runScan}
                onEmailReport={() => setShowEmailModal(true)}
              />
            </>
          )}
        </main>
      </div>

      {showModal && scanData && (
        <LeadModal
          auditData={{
            issues: scanData.issues,
            target: scanData.url,
            score: scanData.score,
            standard: scanData.standard,
            totalDollarMin: scanData.totalDollarMin,
            totalDollarMax: scanData.totalDollarMax,
          }}
          onSubmit={() => { setUnlocked(true) }}
          onClose={() => setShowModal(false)}
        />
      )}

      {showEmailModal && scanData && (
        <EmailReportModal
          auditData={{ url: scanData.url, score: scanData.score }}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      {/* ── Footer ── */}
      {!loading && (
        <footer style={{ background:'#0A0F1E', padding:'24px 40px',
          borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth:860, margin:'0 auto', display:'flex',
            alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src="/logo-white.png" alt="Hex5 Digital" style={{ height:20 }} />
              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:10,
                color:'rgba(0,212,255,0.5)', fontWeight:700, letterSpacing:'1px',
                textTransform:'uppercase' }}>Parity</span>
            </div>
            <div style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)',
                fontFamily:"'Inter', sans-serif" }}>
                DHS Trusted Tester certified · WCAG 2.2 & Section 508 methodology · Powered by axe-core
              </span>
              <a href="https://hex5digital.com" style={{ fontSize:11, color:'rgba(255,255,255,0.35)',
                textDecoration:'none', fontFamily:"'Inter', sans-serif" }}>
                © {new Date().getFullYear()} Hex5 Digital
              </a>
            </div>
          </div>
        </footer>
      )}
    </>
  )
}

// ── Nav CTA — drop into hex5digital.com navigation ────────────────
export function ParityNavCTA({ href = '/parity' }) {
  return (
    <a href={href} aria-label="Parity — free accessibility auditor by Hex5 Digital"
      style={{ display:'inline-flex', alignItems:'center', gap:8,
        padding:'8px 18px', background:'#0078BD', color:'#fff',
        fontSize:13.5, fontWeight:700, textDecoration:'none',
        borderLeft:'3px solid #470069' }}>
      <span aria-hidden="true" style={{ width:7, height:7, background:'#fff', display:'inline-block' }} />
      Free Audit
    </a>
  )
}
