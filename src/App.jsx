import { useState, useRef, useEffect } from "react"
import { generateAuditPDF } from './generatePDF.js'

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

// ── Global CSS ─────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; }
  :focus-visible { outline: 3px solid #0078BD; outline-offset: 3px; }
  button, a, input, select { min-height: 44px; }
  .skip-link { position:absolute; top:-100px; left:0; background:#19335A; color:#fff;
    padding:12px 20px; font-weight:600; font-size:14px; z-index:9999; text-decoration:none; }
  .skip-link:focus { top:0; }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px;
    overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
`

// ── Lead Modal ─────────────────────────────────────────────────────
function LeadModal({ onClose, onSubmit, auditData }) {
  const [form, setForm]         = useState({ name:'', email:'', company:'', role:'', phone:'' })
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const firstRef = useRef()

  useEffect(() => { firstRef.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
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
      style={{ position:'fixed', inset:0, background:'rgba(25,51,90,0.8)',
        zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', maxWidth:480, width:'100%', border:`2px solid ${H5.primary}` }}>
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
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
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
            )}
          </div>
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
function Results({ target, data, onGetReport, onScanUrl }) {
  const { issues, score, totalDollarMin, totalDollarMax, navLinks } = data
  const [nextUrl, setNextUrl] = useState('')
  const [showAllLinks, setShowAllLinks] = useState(false)
  const highRisk = issues.filter(i=>i.risk==='high')
  const medRisk  = issues.filter(i=>i.risk==='medium')
  const lowRisk  = issues.filter(i=>i.risk==='low')
  const critCount = highRisk.length
  const riskLabel = critCount >= 3 ? 'High' : critCount >= 1 ? 'Medium' : 'Low'
  const riskColor = critCount >= 3 ? H5.risk.high : critCount >= 1 ? H5.risk.medium : H5.risk.low

  const noIssues = issues.length === 0

  return (
    <div>
      {/* ── Big three numbers ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',
        gap:2, marginBottom:2, border:`1px solid ${H5.border}` }}>
        {[
          { val:score,                      sub:'out of 100',        label:'Accessibility score',
            color: score>=80?H5.risk.low.fg:score>=50?H5.risk.medium.fg:H5.risk.high.fg },
          { val:riskLabel,                  sub:'legal risk level',  label:'Your exposure',        color:riskColor.fg },
          { val: noIssues ? '$0' : `${fmt(totalDollarMin)}–${fmt(totalDollarMax)}`, sub:'estimated to remediate',
            label:'Remediation cost',       color:H5.secondary },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', padding:'24px 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, fontWeight:700, color:c.color, lineHeight:1 }}>{c.val}</div>
            <div style={{ fontSize:12, color:H5.muted, marginTop:4 }}>{c.sub}</div>
            <div style={{ fontSize:11, fontWeight:700, color:H5.primary, marginTop:6,
              textTransform:'uppercase', letterSpacing:'0.5px' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Scope caveat ── */}
      <p style={{ fontSize:11.5, color:H5.muted, lineHeight:1.6, margin:'8px 0 8px',
        padding:'0 2px' }}>
        Estimate reflects only the issues detected on this single page. Where possible,
        we've flagged issues found in your site's shared header, navigation, footer, or
        global stylesheet as <strong>likely site-wide</strong> — but a full manual
        review often surfaces additional issues automated scans cannot detect, and
        total project scope is often higher than shown here.
      </p>

      {/* ── Legal + "tip of the iceberg" disclaimer ── */}
      <p style={{ fontSize:11.5, color:H5.muted, lineHeight:1.6, margin:'0 0 16px',
        padding:'0 2px' }}>
        This scan is an automated screening tool, not a legal opinion or a substitute
        for a full accessibility audit. It is intended to give you a general sense of
        your exposure and is not a complete inventory of every issue on your site —
        think of it as the tip of the iceberg. A conversation with our accessibility
        team, including a full manual review, is the only way to identify everything
        that may affect your legal risk and your customers.
      </p>

      {/* ── Context bar ── */}
      <div style={{ background:riskColor.bg, border:`1px solid ${riskColor.fg}33`,
        borderTop:'none', padding:'14px 20px', marginBottom:24,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <p style={{ fontSize:13.5, color:riskColor.fg, lineHeight:1.6, margin:0, maxWidth:560 }}>
          {noIssues
            ? "Great news — our automated scan found no high or medium risk issues on this page. A full manual review is still recommended to catch issues automated tools can't detect."
            : critCount >= 3
            ? `Your site has ${critCount} high-risk issues that are commonly cited in ADA Title III web accessibility lawsuits. Over 4,000 such lawsuits were filed in 2023. Remediation typically resolves legal exposure within 60–90 days.`
            : critCount >= 1
            ? `Your site has ${critCount} high-risk issue${critCount>1?'s':''} that could attract legal attention. Addressing these first significantly reduces your exposure.`
            : 'No high-risk issues found. Address medium-risk items to reach full WCAG 2.2 AA compliance.'
          }
        </p>
        <button onClick={onGetReport}
          style={{ padding:'12px 24px', border:'none', background:H5.secondary,
            color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            borderLeft:`3px solid ${H5.tertiary}` }}>
          Get the full report →
        </button>
      </div>

      {/* ── Issues — high risk first ── */}
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

      {noIssues && (
        <div style={{ background:'#fff', border:`1px solid ${H5.border}`, padding:'32px 24px',
          textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:32, marginBottom:10 }} role="img" aria-label="Checkmark">✅</div>
          <p style={{ fontSize:14.5, color:'#374151', lineHeight:1.8, maxWidth:480, margin:'0 auto' }}>
            No automated issues found on this page. Automated scans typically catch
            30–40% of real-world accessibility issues — a full manual review by
            our team can confirm the rest.
          </p>
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <div style={{ background:H5.primary, padding:'28px 24px',
        borderLeft:`4px solid ${H5.secondary}` }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          flexWrap:'wrap', gap:16, marginBottom:20 }}>
          <div>
            <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:6 }}>
              Ready to fix this?
            </div>
            <div style={{ color:'#A8C4DC', fontSize:13.5, lineHeight:1.6, maxWidth:480 }}>
              The estimate above reflects Hex5 Digital's typical remediation rates —
              the same team that can fix it. Most projects are resolved in 30–60 days,
              start to finish.
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={onGetReport}
              style={{ padding:'12px 22px', border:'none', background:H5.secondary,
                color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Download full report
            </button>
            <a href="mailto:accessibility@hex5digital.com"
              style={{ padding:'12px 22px', border:'1px solid rgba(255,255,255,0.4)',
                color:'#fff', fontSize:14, fontWeight:600, textDecoration:'none',
                display:'inline-flex', alignItems:'center' }}>
              Talk to us
            </a>
          </div>
        </div>

        {/* What happens next */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
          gap:16, borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:18 }}>
          {[
            { step:'1', title:'Full-site audit',  desc:'We scan every page and template, plus a manual review for what automated tools miss.' },
            { step:'2', title:'Scoped quote',      desc:'A fixed-price remediation plan based on your actual codebase — no surprises.' },
            { step:'3', title:'Fix & verify',      desc:'Code, design system, and document fixes, with re-testing to confirm conformance.' },
          ].map(s => (
            <div key={s.step}>
              <div style={{ color:'#7FB8E0', fontSize:11, fontWeight:700, letterSpacing:'0.5px',
                marginBottom:4 }}>STEP {s.step}</div>
              <div style={{ color:'#fff', fontSize:13.5, fontWeight:700, marginBottom:4 }}>{s.title}</div>
              <div style={{ color:'#A8C4DC', fontSize:12, lineHeight:1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scan another page ── */}
      <div style={{ background:'#fff', border:`1px solid ${H5.border}`, borderTop:'none',
        padding:'20px 24px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:H5.primary, marginBottom:4,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>
          Check another page on this site
        </div>
        <p style={{ fontSize:12.5, color:H5.muted, lineHeight:1.6, marginBottom:14 }}>
          Issues often vary by page. Enter a URL to scan another page on this site.
        </p>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: navLinks?.length ? 14 : 0 }}>
          <input type="url" value={nextUrl} onChange={e => setNextUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nextUrl.trim()) onScanUrl(nextUrl) }}
            placeholder="https://yourwebsite.com/another-page"
            aria-label="URL of another page to scan"
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
            <div style={{ display:'flex', flexWrap: showAllLinks ? 'wrap' : 'nowrap',
              overflowX: showAllLinks ? 'visible' : 'auto', gap:6, paddingBottom:4 }}>
              {(showAllLinks ? navLinks : navLinks.slice(0, 6)).map(link => (
                <button key={link.url} onClick={() => onScanUrl(link.url)}
                  title={link.url}
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
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [scanned, setScanned] = useState(false)
  const [scanData, setScanData] = useState(null)
  const [error, setError]     = useState(null)
  const [showModal, setShowModal] = useState(false)
  const mainRef = useRef()
  const inputRef = useRef()

  const runScan = async (overrideUrl) => {
    const targetUrl = (overrideUrl ?? url).trim()
    if (!targetUrl) { inputRef.current?.focus(); return }
    if (overrideUrl) setUrl(overrideUrl)
    setScanned(false)
    setScanData(null)
    setError(null)
    setLoading(true)

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
        body: JSON.stringify({ url: targetUrl }),
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

      {/* ── App bar ── */}
      <header style={{ background:H5.primary, borderBottom:`3px solid ${H5.secondary}` }}>
        <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px',
          display:'flex', alignItems:'stretch', minHeight:56 }}>
          <a href="https://hex5digital.com" aria-label="Hex5 Digital — home"
            style={{ display:'flex', alignItems:'center', paddingRight:28,
              borderRight:`1px solid rgba(255,255,255,0.15)`, textDecoration:'none' }}>
            <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAFFBAUDASIAAhEBAxEB/8QAHQABAAMAAwEBAQAAAAAAAAAAAAcICQQFBgMCAf/EAF0QAAECBAICCQ4LBAcGBQQDAAABAgMEBQYHERIhCBcxQVaUlbLSCRMYIjU4UVdhdHWBktEUFjI3VXGEs7TT1CNykaEVNkJSYnaxJDNDVIKjNFNjosElJmSkwsPh/8QAHAEBAAIDAQEBAAAAAAAAAAAAAAYHAwQFAgEI/8QAPhEBAAEDAgIHBgQEBAYDAAAAAAECAwQFEQYxIUFRcYGR0RIiYaGxwSMy4fAHE0JSFGJy8RUkNENEkjNTwv/aAAwDAQACEQMRAD8ApkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADs7boVUuGptp9JlHzEZU0nZamw277nLuIn176om6qITlZWEVEpDYc1XFbV51Ml0FRUl2Lq1I1db9eet2pUX5KHRwdLyM6fw46O2eTjarruHpdP49XvdVMdMz6d8oNodv1uuP0aRSpucRHIxz4cNVYxV3NJ3yW+tUPZ07Bq8JqErphabIORfkR5hXKvrho5P5lhoMKHAgw4EGGyHChtRrGMTJrWpuIiJuIfslNjhWxTH4tczPw6I+6BZfH2VXO2PbimPjvM/aEEy2B9XdBRZmtyMOJvthw3vanrXL/Q+EXBG5UivSDVKO6GnyXPfFa53qRi5fxJ9BtTw3gzHKfNz4421WJ39qPJWarYWXrT2xYiUts5ChJmr5aM16u+pmaPX1NPI1CSnafNOlZ+UmJSYb8qFHhqx6fWi6y45xanT5GpyiylRk5ecgLr63Gho9qLllmiLuL5d00cjhS3Mb2a5jv6fps62Hx/eidsm1Ex209Hynf6wp0Cbr5wal4jHzlpxFgxUTP4DGiZsdq3GPcuaL5HKqa/lImohedlZmSmokpOQIsvMQnaMSFEarXNXwKi7hFc3Av4Vfs3Y2+PVKfaZq+Lqdv28erftjrjvj9w+IANN0gAAAAAAAAAAAAAAAA/qIqqiIiqq7iIfSUl483MwpWVgxI0eK9GQ4bGq5z3KuSIiJuqWIwsw4lLal4dRqsKFM1pyI7NcnMld/RZvK7wv9Sas1d0NO027n3PZo6IjnPY4+s61j6TZ/mXemZ5R1z+nbKO7Owhr1WayZrD/wCh5VdaNiM0o7v+jVo+DtlRU8CkqUHDKzaRoOSlpPxm5/tZ53XdJF3lZqZq/dPZAneJoWHjR+X2p7Z6flyVRqPFWo5tU7V+xT2U9Hz5z++h8ZCVlafL/B6fLQZODryhwIaQ2p6m5IfYA69NNNMbUxsjtddVc71TvI7toaw3a2O3WruL6jz1Usm0akzQm7dp65u0ldChdZe5fK6HouX+J6EGO7j2rsbXKYnvjdmsZmRjzvarmnumYRBc2CcpFa6NbtTfLxM1XrE52zFzXcR7UzaiJ4Ucq+EiO5LfrNuzqSlZkIsrEcmbFXJWPTwtcmaO3d5dW+W7OHWKZT6xT4lPqkpCm5WJ8qHETf8ACi7qLrXJUyVCP53DVi7E1WPdq+X6fvoS/SuN8vHqijL9+nt/qj7T4+angPc4oYfTdpTPwuVdEmqRFflDjKnbQlXcY/Lf8DtSL5Nw8MQfIx7mPcm3cjaYWniZdnMsxes1b0yAAwtkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHe0uzbvqshDn6XatdnpOLn1uPLU+LEhvyVUXJzWqi5Kip9aKcna9v7gPc3JUfomhmwl72K0ftv42OTMBkbte39wHubkqP0Rte39wHubkqP0TXIAZGPw/vxjFe+ybla1qZqq0qOiInsnmjYuvdw5/zaJzVMdAAAAAAAAAAAAAAAAAAAAAAD70+TnKhOwpKQlI83NRnaMKDAhq9718CNTWq/Ud/te39wHubkqP0T0+xX74ayvSTea41LAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+idbXLcuGhMhPrlBqlLbGVUhLOSkSCj1TLPR0kTPLNNzwmwhUDql3cSyPOZzmwgKTAAAAAO/p9k3nUJKFOyFo1+blYzdKFGgU6M9j08KORuSp9R99r2/uA9zclR+iaTbFfvebK9Gt5ziTAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfonU1uiVmhzDJet0ioUyNEZpshzks+C5zc8s0RyIqpmi6zYgob1SL51Lc9CJ9/FAqyAAB3dk21PXVXoVLklRmaK+NGcmbYUNN1y/wAkRN9VRNW6dNCY+LEbDhsc971RrWtTNXKu4iIWlw0tSDaVtw5NWsWej5RJ2KiJ2z8vk577W5qietdWkp1tH02c+/7M/ljn6eKP8R63TpOL7VPTXV0Ux9+6PR2Np27S7ZpLadS4GgzUsSI7W+K7L5Tl31/km9kduAWVatUWqIoojaIUjfv3Mi5N27VvVPOZAAe2IAAAAADw+Klhy11018zJwocKswW5wYupvXkRP925fLvKu4vgTM9wDXysW3lWptXI3iW3g517Bv037M7VR8/hPwUzjwYsvHiQI8J8KNDcrIkN7Va5rkXJUVF3FRd4/BLmyGtZkrOwbok4aNhTTkgzbWpuRUTtX7v9pEVF1brc91xEZV2biV4l+qzV1fOF86ZqFvUMWjIt8p6uyeuAAGq3wAAAAAAAAAAADubKorriuqn0ZHK1szFyiOaqIrYbUVz1TPVmjUcqeU9UUVV1RTTzl4u3KbVE3K52iI3nuhLmAVnNk5Bt1T8L/aplqtkmub/u4S6lfr33a0T/AA+FHEtHzgQYUvAhy8vCZCgwmIyHDYmTWNRMkRE3kRNR9C1dPwqMOxTap8fjKgtX1O5qWVVfr6+UdkdUfvrAAbjmAAAAAAAAOPUZKUqUhGkJ+XhzErHZoRIT0zRyf/C76KmtFyVNZVjEC2o9qXNMUqKqvg/72Wir/wASEqror9epUXyouWoteRnshaGyftCHWIbG9fpsVFc7PJVhPVGqnl7bQXyJpeEj3EWBF/Hm9THvUfTr9Ux4N1arEzIx6p9y50d1XVPjy8uxXwAFeridlQ6BXa6+Kyh0WpVR0FEWKknKvjKxF3NLRRcs8l3fAdpte39wHubkqP0SzPU0e7l7+bSfOil2QMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADI3a9v7gPc3JUfoja9v7gPc3JUfomuQAyN2vb+4D3NyVH6I2vb+4D3NyVH6JrkAMjdr2/uA9zclR+iNr2/uA9zclR+ia5ADICs2pdNFlEnKzbVZpssr0YkabkYsJmkueSaTmomepdXkOmNDOqGfMLA9Ny/3cUzzAAADTLYS97FaP238bHJmIZ2EvexWj9t/GxyZgAAA4Ve7hz/AJtE5qmOhsXXu4c/5tE5qmOgAAAAAAAAAAAAAAAAAAAAABJuxX74ayvSTea41LMtNiv3w1lekm81xqWAAAAqB1S7uJZHnM5zYRb8qB1S7uJZHnM5zYQFJgAAAAGpmxX73myvRrec4kwjPYr97zZXo1vOcSYAAAAAAAAAAAAAAAAAAAAAAAAAAAAob1SL51Lc9CJ9/FL5FDeqRfOpbnoRPv4oFWQABImAVBSq3olRjQ9KXpbOv5qmaLFVcoaeRU7Z6L4WFiyLdjdKQodo1CdRipGjzyw3KqfKYxjVb/N7yUix+HseLOFTV11dPp8lLcZZlWRqdVHVRtEfWfnIADuIqAAAAAAAAAADqbvo0O4LYqFHiaOczBVsNXOVEbETWxyqm8jkavqKjva5jla5qtci5KipkqKXOKuYvU1KZiLV4LOuKyNG+Etc5uWfXER7svIjnOT1EO4rxo2ovx3T9Y+6yOAM2d7uLM/5o+k/Z5MAENWWAAAAAAAAAAAS9saaY2JU6tWHo7OBBZLw829qumuk5UXwpoN9TiISx2x/kXSmHUKO5yKk7NRZhurcRFSHl/21X1na4fsxdzqd+ref34oxxhkzY0q5tzq2p8+fyiUggAslSYAAAAAAAAAABwLhkFqtAqFLarUdNysSA1zm5o1XNVqLl5FXM54aqtcjkXJUXNDxcoi5RNE9cbMlm7Nq5Tcp5xMT5KYAAp9+j1v+po93L382k+dFLslJupo93L382k+dFLsgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABXPqhnzCwPTcv93FM8zQzqhnzCwPTcv93FM8wAAA0y2EvexWj9t/GxyZiGdhL3sVo/bfxscmYAAAOFXu4c/wCbROapjobF17uHP+bROapjoAAAAAAAAAAAAAAAAAAAAAASbsV++Gsr0k3muNSzLTYr98NZXpJvNcalgAAAKgdUu7iWR5zOc2EW/KgdUu7iWR5zOc2EBSYAAAABqZsV+95sr0a3nOJMIz2K/e82V6NbznEmAAAABwbhqkvQ6BUa1Nsivl6fKxZqK2EiK9zIbFcqNRVRM8kXLNUK6dmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZKG9Ui+dS3PQiffxSWezVws+gLz4nLfqCtGy2xXt3Fu9KTWrbkqrKS8nTvgsRtQhQ2PV/XHuzRGPemWTk30AhcAAWRwDVFw5lsl3I8XP2j3xFOxrnYUS2apT2tXrsvOpGevhbEYjWp/2nfxJWLP0WuK8G3Mdm3l0KJ4mt1W9VvxPbv5xuAA6jhAAAAAAAAAAAEGbJeRWHW6PU9JMo8s+XRvg627Sz/7v8icyL9kfJsi2dJTqQldGl55rdNG56DHsdpa95FVrPXkcbX7X8zAr+G0/P0SXhDI/k6tb7Kt4849dkAAArVdwAAAAAAAAAABarC6S+AYeUOXRVVHSjY2tc/95nE//mVVLe2tLxJO16TJxlRYkvIwILlRN9sNrf8A4JTwpRvkV1dkfWf0QLj+5th2qO2rfyifV2QAJ0qkAAAAAAAAAAA+U1MwJKVizk05GS8BixYrlXca1M1X+CH1PD42V1tGsObgsiaMzUP9khImWei7/eLl4NDSTPeVyGtmX4x7Fd2eqP8AZu6biVZmXbsU/wBUxHh1+UK0AAqV+hlv+po93L382k+dFLslJupo93L382k+dFLsgAAAAK83Zsu8NrauqrW5PUS7Yk3Sp6NJR3wZWXWG58J6scrVWOiq3Nq5Zoi5byAWGBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAWZBWbs1cLPoC8+Jy36gdmrhZ9AXnxOW/UAc3qhnzCwPTcv93FM8y0+yo2RlkYqYZQrZt6l3DKzjKjCmlfPS8FkPQa16KmbIrlz7ZN7wlWAAAA0y2EvexWj9t/GxyZiGdhL3sVo/bfxscmYAAAOFXu4c/5tE5qmOhsXXu4c/5tE5qmOgAAAAAAAAAAAAAAAAAAAAABJuxX74ayvSTea41LMtNiv3w1lekm81xqWAAAAqB1S7uJZHnM5zYRb8qB1S7uJZHnM5zYQFJgAAAAGpmxX73myvRrec4kwjPYr97zZXo1vOcSYAAAHmcWfmru30JO/cPMjTXLFn5q7t9CTv3DzI0AAAAAAAAAAAAAAAAAAAAAAAAAAAPa4MXDDt+9oCzMRsOTnWrKx3OXJGaSorXa1REyciZqu41XFmimBYrBe+Idw0llHqMdf6Xk2ZZvXNZmGianou+5Nx2etfla81yl3DOo00TONXPPpjv7PRXfHGjVXaYzrUb+zG1Xd1T4dfh2JFABNVYAAAAAAAAAAAHlcW5GJUMOK1Agtar2QEj613EhvbEcvstceqPxFhw4sJ0KLDbEhvarXscmaORd1F8hgybP8+zXanriYbWDkzi5Nu/H9MxPlKmYO7vm349sXPN0iMj1ZDdpQIjk/wB7CXW13g3NS5bioqbx0hU1dFVuqaKo2mH6FtXaLtEXKJ3iY3jukAB4ZAAAAAAAAH0l4MSYmIcCC3TiRHoxjfCqrkiFzHZK5VamSZ6kKq4VyL6hiJQ4ENzWqybbMLpbipC/aKnrRip6y1JNeE7W1Fy52zEeX+6sf4g34m5YtdkTPntEfSQAEuV0AAAAAAAAAHzmY8GWl4kxMxocGDDbpPiRHI1rE8KqupEPkzERvL7TTNUxERvL9RYkOFCfFixGQ4bGq573uRGtaiZqqqu4iJvlYcVrtW7LmdGgK5KdKosKTauetueuIqLuK5fImpGou5md7i3iStwpEotEc9lJR37WKqK100qLmmpdaMzTNEXWupVy3EjMgWvaxGVP8izPuRzntn0hbfCXDlWBT/isiPxJ5R/bHrPyjxAARpN1v+po93L382k+dFLslJupo93L382k+dFLsgAAAMmsdvnvvz/MlR/ExDWUyax2+e+/P8yVH8TEA8YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANMthL3sVo/bfxscmYhnYS97FaP238bHJmAAADhV7uHP+bROapjobF17uHP+bROapjoAAAAAAAAAAAAAAAAAAAAAASbsV++Gsr0k3muNSzLTYr98NZXpJvNcalgAAAKgdUu7iWR5zOc2EW/KgdUu7iWR5zOc2EBSYAAAABqZsV+95sr0a3nOJMIz2K/e82V6NbznEmAAAB5nFn5q7t9CTv3DzI01yxZ+au7fQk79w8yNAAAAAAAAAAAAAAAAAAAAAAAAAAAAfeRm5mQnIU5Jx3wJiC5Hw4jFyVqpvofAH2J26YfJiJjaU/4c4sSFWZCp1yRIUhUETJJlcmwI6+XeY5fL2upclTNGkoFMD1FpX7c1stZBkJ/rso1f/CTCdchb+pE3W61z7VUz3yU6fxNXaiKMmPajt6/HtQHWOB7d+qbuFMUzP9M8vDs7umO5acEOUXHGA7rbKzQojMm/tI0pFR2bvJDdlkm7/bU9FT8YLLmlXrsaekURck+ESyrn5f2auJJa1zBuR0XIjv6ELv8AC2q2Z2mzM920/RIIPG7aFhaOfxhbnlufA5j8s/O2nYf07/8AqR+gbEalhz/3afOGlOialH/j1/8ArPo9oDxrcUbCXPO4Gt+uUj9AOxRsJEzS4Wu8iSkf8s+TqeHH/dp84fY0PUp/8ev/ANZ9HsgeMbilYarkteRPKspH6Bz6bflnVBrnS9x09qNXL/aInWFX6kiaKn2jUcSudqbtPnD5c0XULcb1WKtv9MvSA/EGIyNBZGhPbEhPTNj2rm1yeFF3z9m5ExMbw5tVM0ztPN47FGyZe8KS3rasgVOWRVlo67iou7Dd/hXw7qLrTdVFrXVqdPUmoRqfUpWJLTUF2i+G9MlTy+VF3UVNSprQuKdHdtq0O6ZRIFYlOuOYmUKPDXRiwt35LvBrXUuaZ61RciO6xoUZk/zbPRX8p/VM+HOK6tOpjHyImq31dtPrHw/2VMBKVzYL12UiOiUKagVOCqpow3uSDGTPP+8ugqImWvSRV8BH9YoNbo+S1Wkzsk1XKxr40BzWuVP7rlTJfUQnIwsjGna7RMfTz5LQw9Uw82N7FyKvHp8ubrQAarfAAAB9JaBHmY7JeWgxI0aIuiyHDarnOXwIia1JKsLCSrVOPDnLihvpsgio5YLtUeLr3NH+wm7mrte5q15psY2Jeyq/YtU7z++bSzdQxsG3NzIrimPnPdHW7zY5W5Fhtm7omWK1kRqysoip8pM0V79aeFEaiov99CZT4yUrLyUpClJSCyBLwWIyHDYmSNam4h9izdNwowsem1HPr71Ha1qdWp5lWRMbRPREdkRy9Z+ID5zEaDLS8SYmI0ODBhN0okSI5GtYnhVV1InlPG1zFKzKU58P+knz8Vjka6HJQ+uetHrkxU+pxmv5djHje7XEd8tbE0/KzJ2sW5q7o+/J7YEOVDHOXbEiMp9uxYjM/wBnEjzSMX1sRq846GLjZdT2K1khRoarnk5IMRXJ/GJl/I5VziPBo5VTPdHrskFngvVbn5qYp75j7brAgrRExYvp0Z0SHV4cJrtxjZOCrW/VpNVf5nwj4n31GYrX15yIv9yWgtX+KMQ1auKsXqoq+Xq3qOAc6fzXKI8/RZ4/EeLCgQIkePEZChQ26T4j3IjWp4VVdxCq03fN4TSNSJcdSbormnWoywv46OWfrOnqdUqVUiti1Oozc9EamTXzEZ0RUT63KpgucWUbe5bnf4y2rP8AD67M/i3oiPhG/wBZhYa7MV7XoqPhSUb+mJtq5dblXfs0XUuuL8nLJd1ulrTJciFL2vevXZFRKhHSFKMdpQ5SDm2E1css1Tdcu7rXPLNcskXI8yCPZ2sZWb0VztT2Ry/VMdK4cwdM961TvV/dPTPh1R4AAOW7wAALf9TR7uXv5tJ86KXZKTdTR7uXv5tJ86KXZAAAAZNY7fPffn+ZKj+JiGspk1jt899+f5kqP4mIB4wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaZbCXvYrR+2/jY5MxDOwl72K0ftv42OTMAAAHCr3cOf82ic1THQ2Lr3cOf82ic1THQAAdxDta54jGxIduVh7HIitc2SiKiou+moDpwd18U7p4NVniMXoj4p3TwarPEYvRA6UHdfFO6eDVZ4jF6I+Kd08GqzxGL0QOlB3XxTung1WeIxeiPindPBqs8Ri9EDpQd18U7p4NVniMXoj4p3TwarPEYvRA6UHdfFO6eDVZ4jF6I+Kd08GqzxGL0QOlB3XxTung1WeIxeiPindPBqs8Ri9EDpQd18U7p4NVniMXoj4p3TwarPEYvRA9nsV++Gsr0k3muNSzMjYxW3cUpj9ZszNUGqwIEOotV8SJJxGtami7WqqmSGm4AAACoHVLu4lkecznNhFvyoHVLu4lkecznNhAUmAAAAAambFfvebK9Gt5ziTCM9iv3vNlejW85xJgAAAeZxZ+au7fQk79w8yNNcsWfmru30JO/cPMjQAOZRKXUK1V5SkUqViTc9ORWwZeBDTtoj3LkjU8qqSDtA4yeL2tew33gRkCTdoHGTxe1r2G+8bQOMni9rXsN94EZAk3aBxk8Xta9hvvG0DjJ4va17DfeBGQJN2gcZPF7WvYb7xtA4yeL2tew33gRkCTdoHGTxe1r2G+8bQOMni9rXsN94EZAk3aBxk8Xta9hvvG0DjJ4va17DfeBGQJN2gcZPF7WvYb7xtA4yeL2tew33gRkCTdoHGTxe1r2G+8bQOMni9rXsN94EZA51fo9ToFZmqNWZOLJVCUf1uPAipk6G7wKcEAAAAAAAAAAAAAAAAAAAOZS6pUqVGdGplQmpKK5NFz5eM6Grk8C5LrTyEjWrjNWpJ7YNflodTl1XXFhokKM1NXgTRdkmerJFVd1xFoNrGzb+NO9qqY+nlyaObpmJnU+zkW4q+vhPOFuLWuSjXNIfDKPONjNbl12GuqJCVU1I9u6m4uvcXJclXI7cqBb9YqNBqkKpUuZfAmIa7qbjk32uTfRfAWcw+uuUu6gNn4CNhTMNdCal0dmsJ/8Aroruov1puopOdH1unN/CuRtX8pVTxJwvVpf49mfatz509/w7J8J+Pow1VauaKqL4UAJAiDr6jRaNUXo+oUmQnHIuaLHl2RFT+KHw+K9r8GKFybB6J24MM41mrnRHlDZpzcmmNqblUeMuo+K9r8GKFybB6I+K9r8GKFybB6J24PP+Esf2R5Q9f8Qy/wD7avOfV8JCTlKfLfBpCVgSkBP+HBhoxv8ABNR9wDPTTFMbRGzWrrqrn2qp3kI5xIxRkLcixaZSWQ6hVWO0Yma/sYCpuo5U1ucm5ooqZb6oqZHHxsvyJQZZKDR4+hU5hmlGjMd20tDXcy8D3by7qJrTWrVSvxE9b12qzVOPjz0xzns+ELB4X4UoyKIy8yN6Z/LT2/Gfh2R19ztrjuSuXFMpHrFRjTSoubGKuUNmrLtWJk1u5vJrOpAIXXXVXPtVTvKzbdui3TFFEbRHVAADy9gAAAAAAAAAAAAC3/U0e7l7+bSfOil2Sk3U0e7l7+bSfOil2QAAAGTWO3z335/mSo/iYhrKdTHti2piPEjx7epMWLEcr4kR8lDc5zlXNVVVTWqrvgY+g1/+Kdq8GaLxGF0R8U7V4M0XiMLogZAA1/8AinavBmi8RhdEfFO1eDNF4jC6IGQANf8A4p2rwZovEYXRHxTtXgzReIwuiBkADX/4p2rwZovEYXRHxTtXgzReIwuiBkADX/4p2rwZovEYXRHxTtXgzReIwuiBkADX/wCKdq8GaLxGF0R8U7V4M0XiMLogZAA1/wDinavBmi8RhdEfFO1eDNF4jC6IGQANf/inavBmi8RhdE/EazrRjQnQo1q0OJDdutfT4SovqVoGQYNXaxg3hRVmqk7h3bKq7PN8GnQ4L1+tzERd7wkdXVsRMH6wj3U6Uq1AiuzVFkp1z25/uxtPV5Ey9QGc4LT4g7C686WyJM2ZXpC4YTUzSWmE+CTC+RM1WGv1q5v1Fcbuta47RqrqXc1EnqTOJnlDmoKs0k8LVXU5PKmaAdMAAAAAAADTLYS97FaP238bHJmIZ2EvexWj9t/GxyZgAAA4Ve7hz/m0TmqY6Gxde7hz/m0TmqY6ADX+xP6j0H0bL/dNMgDX+xP6j0H0bL/dNA7kAAAAAAAAAAAAAAAAAAAAAAAAqB1S7uJZHnM5zYRb8qB1S7uJZHnM5zYQFJgAAAAGpmxX73myvRrec4kwjPYr97zZXo1vOcSYAAAHmcWfmru30JO/cPMjTXLFn5q7t9CTv3DzI0CQNjh8/Vjem5b7xDVgyn2OHz9WN6blvvENWAAAAAAAAAAAAAAAAAAAAy02VHfDXr6SdzWkZEm7Kjvhr19JO5rSMgAAAAAAAAAAAAAAAAAAAAAAe+wIrT6XfkCUfFRktUWOl4iOVctLLShrluaWkiNRfA9fCeBO+w8a59+2+jYbomVSl3K1qZ9qkRqqvqRFU2cK5VbyKK6ecTDR1OzRfw7tuvlNM/RbEAFtPz0AAAAABxqpOwKbTJqozSqkCVgujRMt3RaiquXl1ajkkf4/Tz5PDqNBaxHJOzUKXc7P5O7Ez/7eXrNXOyP8Pj13Y6o/2b+l4kZmZasTyqmInu6/kr7XKnN1msTVVnomnMTURYj1zXJM9xqZ55NRMkRN5ERDhAFT1TNU7y/QVNMURFNMbRAAD49AAAAAAAAAAAAAAAALf9TR7uXv5tJ86KXZKTdTR7uXv5tJ86KXZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1F3Wxb920aLRrlo8nVZCKnbQZmGjkRf7zV3WuTecioqbynbgCjuP2xDnqRCmK/he+PUpNqK+JRortKYhpur1l3/ET/CvbeBXKVMjQosCM+DGhvhRYbla9j2qjmuRclRUXcU2VK/7KDY6UjEqTmLjtuFBp13w2K7STJkKoZbjIvgfkmSP9Ts0y0QznBy6zTKhRqrNUqqycaSnpSKsKPAjMVr4b0XJUVFOIAAAGmWwl72K0ftv42OTMQzsJe9itH7b+NjkzAAABwq93Dn/ADaJzVMdDYuvdw5/zaJzVMdABr/Yn9R6D6Nl/ummQBr/AGJ/Ueg+jZf7poHcgAAAAAAAAAAAAAAAAAAAAAAAFQOqXdxLI85nObCLflQOqXdxLI85nObCApMAAAAA1M2K/e82V6NbznEmEZ7FfvebK9Gt5ziTAAAA8ziz81d2+hJ37h5kaa5Ys/NXdvoSd+4eZGgSBscPn6sb03LfeIasGU+xw+fqxvTct94hqwAAAAAAAAAAAAAAAAAAAGWmyo74a9fSTua0jIk3ZUd8NevpJ3NaRkAAAAAAAAAAAAAAAAAAAAAACRtj5Snz19f0iqKkGnQHxFXRzar3orGtXwLk5zk/cI5LO4Q2q61rTZDmoSMqM47r83q1t1dpDXUnyU3t5znbx2dCw5ycumeqnpnw5fNGuK9SpwtOrjf3q/djx5z4R89nsgAWUpEAAAAACPdkDJRJvDqJGY5rWyc3CmHou+nbQ8k9cRF9RIRx6jJy9Qp8zITbFfLzMJ0GK1FyVWuRUXJd5cl3TVzsf/E49dqOuG/peZGFmW788qZiZ7uv5KcA7q87dnbXuCPSZ1FdodtBi6OSRoa56L0+vJdW8qKm8dKVRXRVbqmmqNph+gLV2i7RFyid4npiQAHlkAAAAAAAAAAAAAAAAW/6mj3cvfzaT50UuyZ+bBPESzMP6tdca8a7BpMOdgSzZdYkOI/ritdEVydo1dzSTd8JarskcEuH0lxaY/LAlkETdkjglw+kuLTH5Y7JHBLh9JcWmPywJZBE3ZI4JcPpLi0x+WOyRwS4fSXFpj8sCWQRN2SOCXD6S4tMfljskcEuH0lxaY/LAlkETdkjglw+kuLTH5Y7JHBLh9JcWmPywJZBE3ZI4JcPpLi0x+WOyRwS4fSXFpj8sCWQRN2SOCXD6S4tMfljskcEuH0lxaY/LAlkETdkjglw+kuLTH5Y7JHBLh9JcWmPywJZBE3ZI4JcPpLi0x+WOyRwS4fSXFpj8sCWQRN2SOCXD6S4tMfljskcEuH0lxaY/LAlkETdkjglw+kuLTH5Z9JfZF4KR4nW2X/TkXLPN8KMxP4uYiASqDzttX3ZVzPSHb120KqxF/4cpPw4j0+tqLmn8D0QAAAAABW7ZpYHwr5t2Le1tyn/ANz0yDnHhw01z8u1Nbct+I1M1au6qZt19rlnwbMGcWzawwh2DiitXpUt1qh3DpzUBrU7WDHz/bQ08CZqjkTeR+SbgECAADTLYS97FaP238bHJmIZ2EvexWj9t/GxyZgAAA4Ve7hz/m0TmqY6Gxde7hz/AJtE5qmOgAvfbWzIwxpluUymx6FeDospKQoERWSksrVc1iNVUzjpqzQogAL/APZq4WfQF58Tlv1A7NXCz6AvPict+oKAAC//AGauFn0BefE5b9QOzVws+gLz4nLfqCgAAv8A9mrhZ9AXnxOW/UDs1cLPoC8+Jy36goAAL/8AZq4WfQF58Tlv1A7NXCz6AvPict+oKAAC/wD2auFn0BefE5b9QOzVws+gLz4nLfqCgAAv/wBmrhZ9AXnxOW/UDs1cLPoC8+Jy36goAAL/APZq4WfQF58Tlv1A7NXCz6AvPict+oKAADRywNldh3et5Uu1aVRrpgztSjpAgxJmVgNhNcqKublbGVUTVvIpPhlpsV++Gsr0k3muNSwAAAFQOqXdxLI85nObCLflQOqXdxLI85nObCApMAAAAA1M2K/e82V6NbznEmEZ7FfvebK9Gt5ziTAAAA8ziz81d2+hJ37h5kaa5Ys/NXdvoSd+4eZGgeiwzuNln4g0G6Yko6cZSp+FNugNfoLERjkXRR2S5Z5buRbfs46V4up3lRv5ZSYAXZ7OOleLqd5Ub+WOzjpXi6neVG/llJgBdns46V4up3lRv5Y7OOleLqd5Ub+WUmAF2ezjpXi6neVG/ljs46V4up3lRv5ZSYAXZ7OOleLqd5Ub+WOzjpXi6neVG/llJgBdns46V4up3lRv5Y7OOleLqd5Ub+WUmAF2ezjpXi6neVG/ljs46V4up3lRv5ZSYAXZ7OOleLqd5Ub+WOzjpXi6neVG/llJgB6nFm6od8Yj1y7YUk6RZVJpY7Zd0TTWHmiJlpZJnueA8sAAAAAAAAAAAAAAAAAAAP3BhxI0VkKFDdEiPcjWMamauVdxETfUD8H9RFVUREVVXcRD3VsYVXZWXNiTMqlJllXW+cza/JFyXKH8rPfTNGovhJjsfDq37WVkzChunqi1P/Fx0TNq6s9Bu4zc8rtappKh2MHQ8rLmJ29mntn7R1o3qnFOBp8THte3X2U9PnPKPr8HkMH8M48jMwLiuKD1uYZk+Vk3p20N28+Ii7jk3UbuoutclTImAH5ixIcKE+LFiMhw2NVz3vcjWtaiZqqqupERN8n2Dg2cG17FvxntVJqmq5Gq5H8273REcojsj99L9HCqlWpVKRq1OpyUjpoqs+ER2w1cieDSVM/UQliJi3UJ6ZjU+14z5KQauj8LaitjRvCrVXXDb4Msnas1VM1akWxosSPGfGjRHxIsRyue97s3OVdaqqruqcHN4ot26posU+18Z5fr8ks0zgS7eoi5l1+xv1Rz8Z5R81m4mJ9iQ3OY64GK5rlaqNlozk1eBUZkqeVFOJExbslj1a2fmIiJ/abKvyX+KIpWwHJq4nzZ5RTHh+qQUcC6ZTHTNU+MfaFmYGKliRIem+tOhL/cfKRs/wCTFT+Z6ek1ik1dHLS6nJz2i1HPSBHa9WIu5pIi5t9ZT8/cGJEgxWRYUR0OIxyOY9q5K1U3FRd5TNZ4pyaZ/EpiY8Y9fo18jgHCrj8G5VTPx2mPtPzXMBXOzsWbio0RkGqRHVmS3FbHdlGburmkTLNVzX+1pakyTInO0rno1009ZykTPXEYqJFhPTRiwlVM0Rzd7f1pmi5Lkq5KSbT9Zxs33aZ2q7J+3ag+r8NZul+/XHtUf3Ry8ez6fF8b4tSmXbR1kKg1WRGZulplidvAeu+nhRckzbuLlvKiKldb3smuWnMr8Pl+uybnaMKchJnDfvoi/wB127qXwLlmmstSfiNDhxoL4MaGyJCiNVr2Paitc1d1FRd1PIYtT0Szne/Hu19vb3s+hcUZOlfhzHtW+zs7p+3JTMFirpwhtqrPfHpzotGmHLn+xTTg555qvW1VMvAiNc1E8BHNZweu6SeqyTZOpw1VclgxkY5GpuK5ImjrXwIriG5Wh5uPPTR7UdsdP6/JZWDxTpmZEbXPZnsq6Pny8pR2DuJ21rlkmOfNW/VYMNqqivdKPRmr/Flkp05yqqKqZ2qjZ36LlFyN6J3j4AAPL2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/rVVrkc1VRUXNFTeJUw02QOKdhxYTKfckepU9ipnIVRVmYKtT+ymkukxP3HNIqAGkuAeyVs7E2LBos+z4vXK/tWyUeIjoUy7/0YmrNf8CojterSyVSczGqDEiQYrIsKI6HEY5HMe1claqbiou8poNsKMbJjEG341o3NNdduSkQUfDjvXt52WTJum5d97VVEcu+jmrrXSAseAABDezIspl54E1nrcLSnqM3+lJVUTNc4SKsRvh1w1emXhy8BMh85mBCmZaLLR4bYkGKxWRGO3HNVMlRfUBjWDt71oz7cvKt2/EVVfTKhHk3Ku+sOI5mf8gBo3sJe9itH7b+NjkzEM7CXvYrR+2/jY5MwAAAcKvdw5/zaJzVMdDYuvdw5/zaJzVMdAAAAAAAAAAAAAAAAAAAAAACTdiv3w1lekm81xqWZabFfvhrK9JN5rjUsAAABUDql3cSyPOZzmwi35UDql3cSyPOZzmwgKTAAAAANTNiv3vNlejW85xJhGexX73myvRrec4kwAAAPM4s/NXdvoSd+4eZGmuWLPzV3b6EnfuHmRoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH0loEeamIctLQYkePFcjIcOG1XOe5dxERNar5CYrGwaVyQ527IytTdSRgP17qfLenr1N8Kdsi6jbw8G/mV+zap3+kOdqOq4um2/byKtuyOue6EPSsvHmphkvKwIseNEXJkOGxXOcvgRE1qelpuHd6z6KsC3puHkuSpM6MBf4RFaWWolHpVElfgtIp8vJQlREckJmSvy3Fc7dcvlcqqc8lFjhSnbe9c6fh6z6IJlfxAq9rbHs9HbVP2j1V2p2DV4TUHrkd1NkXa/2ceYVXf8Aba5P5noadgb2sJ9QuLJf+JCgSur6kerv9Wk0A6VrhvBo5xM98+mzi3+NtVuflqinuj13eApeENlyauWNLTlQz3PhMyqaK+TraM/nmeypVJpVJa5tLpsnIo9ER/weA2Gr0Tc0sk1+s5oOnYwMax/8dER4dPm4WVq2bl9F67VVHZv0eXIABtueEX7IevxadbctRpZ6tiVJ7uvK1UzSEzJVb4U0lVuvwNcm+SgV12Qk7DmsQOsMTtpOThQH6t9VdE/0iIcPiHImzhTFP9UxH78ISng3EpydUpmqN4oiavLoj5zEo6ABXC6gAAAAAOytut1G3qvCqlLjrCjw9Soutr277XJvov8A/qZKiKdaD1TVNExVTO0w810U3KZpqjeJ5wtnY9ySd1W9Bqsoiw3KvW48FVzWFETLNue+mtFRd9FTcXNE7wrhgTcLqNekOQiPVJSq5S7016ouvrS5JurpLo/U9VLHll6NqE5uNFVX5o6J9fFR/E2kRpebNFH5Kumn08PpsAA6yPB/Ue9Gq1HORF3URT+ATETzfYmYneHDqFKpdQarZ+myc2i5ZpHgNfnlubqHXzFoWpHZoPtqjon+CShsX+LURTvAYKsWzX+aiJ8IbNvOybf5LlUd0y8RNYU2NGl3QodIfLvVMkiw5qKrk8vbOVP5HnqngfRoiN/oytz8qqfKWYhsj5/Vo6GX8yWAad3RsG7ztx4dH0dKxxLqtj8t+Z7+n67q4XBhHdtLY6NKwYFVhNRzl+CPXriIm5mxyIqqvgbpHg5mBGlpiJLzEGJBjQ3K18OI1WuaqbqKi60UuWdFd1pUK6ZbrVWk2uiomUOZh9rGh7u47wa17Vc038jh5nC1MxNWNV09k+qVabx5XFUUZtG8dtP3jr8Nu5U0HqsQLGq1nzafCP8AaZCI7RgzjGZNcu7ouTXouyRVyz3lyVclPKkPvWa7Nc0XI2mFj4+RaybcXbNXtUzymAAGNmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD3ux6uiPZ+NNq1uDFcyG2ow4Ezkq5OgRV63ERU3+1cqp5UQ8EdhbcJ8a4qbBhN0okSbhNanhVXoiIBsQAAAAAy72W0glN2Rl5y7Wq1HzrY+Sp/5sJkTP16eYOy2bXfO3d9i/BQABczYS97FaP238bHJmIZ2EvexWj9t/GxyZgAAA4Ve7hz/m0TmqY6Gxde7hz/AJtE5qmOgAAAAAAAAAAAAAAAAAAAAABJuxX74ayvSTea41LMtNiv3w1lekm81xqWAAAAqB1S7uJZHnM5zYRb8qB1S7uJZHnM5zYQFJgAAAAGpmxX73myvRrec4kwjPYr97zZXo1vOcSYAAAHmcWfmru30JO/cPMjTXLFn5q7t9CTv3DzI0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHLo9OnavU5em06XfMTUw/Qhw27676r4ERM1VV1IiKq6kOIWIwOs9lDoLa1OQ/wD6lUYaOTPL9lBXW1v1u1OX/pTJFRc+hpmBVnX4tx0R1z2Q4+uavb0rFm9V0zyiO2fTtdvhxYdNtCSR+TJqqxG/t5tU3P8ABDz3G/zdurvInsACzMfGt41uLdqNohR2Zm3829N6/VvVP76PgAAztUAAAAAAAAKz46fOlVv3Zf8ADwyzBWfHX50qt+7L/h4ZGOKv+lo/1faU54B/6+5/on60vEAAga2gAAAAAAAH1lJiNKTcGbloiw40GI2JDem61yLmi/xQuVmx3bQ1zYutq+FCmBbu0piJN2pSJqK1rYkeRgRHI1MkRXQ2rq8msl3Cdc+3cp+EfdXf8QbcTasV9kzHnt6O0ABNVYAAAAAAAAAAA41UkJOqU+PT6hLQ5mVjs0IsJ+45P9UVFyVFTWioipkqFYMSbSj2jcT5JViRJKMixJSM7dezPcVU1aTdxdzeXJEVC1B4/F2223JZsyyHDR07JoszKqiZuVWp2zE1ZrpNzTJN1dHwHC13TacuxNymPfp+cdnolfCet1YGXFmufw652n4T1T6/DuVgABXK6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAl3YhWXHvTHagw+tOdJUmMlUnH5amtgqjmIv70TQbl4FUje07drd11+VoNvU2PUalNO0YUCC3NV8Kqu4iImtVXJETWppbsZsH5HCOyPgT3Q5mvVDRi1WbZra56IujDZqRdBma5Z61VXLqzyQJWAAAA+U5MwJOUjTc1FbCgQIbokWI7ca1qZqq+REQDL/ZaVBKlsjLzmEcrtCebL5r/6UJkLL/2A8DeNYfcN3Vm4IrVbEqc/HnHIu6ixIjnrzgBo7sJe9itH7b+NjkzEM7CXvYrR+2/jY5MwAAAcKvdw5/zaJzVMdDYuvdw5/wA2ic1THQAAAAAAAAAAAAAAAAAAAAAAk3Yr98NZXpJvNcalmWmxX74ayvSTea41LAAAAVA6pd3Esjzmc5sIt+VA6pd3Esjzmc5sICkwAAAADUzYr97zZXo1vOcSYRnsV+95sr0a3nOJMAAADzOLPzV3b6EnfuHmRpsrMQYMzLxJeYhQ40GKxWRIcRqOa9qpkqKi6lRU3jzm15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRG15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRG15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRKR9UHolGoeJlAl6JSKfTIMSjI98OTlmQWud16Imao1ERVyRNYFaQAAAAHpcMaGy4b3p1Pjs05ZHrGmEyVUWGxNJWrluI7JG5/4i1S61zUg3YzySPq9ZqWk5FgS8OX0d5UiOV3/9SfxUnIn/AAxYijFm511T8o6PVUPHWXVdz4s9VEfOemflsAAkiFAAAAAAAAAAAFZ8dfnSq37sv+HhlmCsWNcVsXE6sOa7SRFgtz8qQWIqfyIxxVP/AC1Ef5vtKdcAR/z1yf8AL94eNABA1sgAAAAAAABbOwIzY9i0F7VzRKdAZub7YbWr/oVMLNYIRYcXDGlNY7SdDWMyJr3F689UT+CoSbhavbLqp7afvCD8e2/a0+iuOqqPnEvagAnqpAAAAAAAAAAAAiqi5ouSoABUq+aYlGvGrU1kFYMKDNPSCxVzVISrmz/2q06U9vjoiJilVsky7WX/AA8M8QVJlW4t366I5RMx836I0+7VexbVyrnVTE+cQAtb1O2gUKvVm8mVyi02qNgy8osJJyVZGRiq6Lno6SLlnkm54C4u15YHAe2eSYHRNdtsjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRG15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRG15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdEbXlgcB7Z5JgdEDI0GuW15YHAe2eSYHRG15YHAe2eSYHRAyNBrlteWBwHtnkmB0RteWBwHtnkmB0QMjQa5bXlgcB7Z5JgdE5ElZVmyMTrklaVBln5oulBp0Ji5puLqbvAZP2xaV03PHSBblu1arxFXLKTlHxUT61aionrJ8ww2Ht/wBejwpm8ZiWtenrkr4avbHm3J4EY1dFv1udmmfyV3DQFjWsYjGNRrWpkiImSIh/QPC4RYT2ThbSnSdq0zQmIzUSZn5h3XJmYy/vPyTJP8LURu/lnrPdAAAAAIX2Z17Ms3Amrw4UXQn62n9FyqIuvKIi9dX1Q0fr8KoTQZtbM/FFmImKT5GlzHXaDQEdKSbmuzbGi5/toyfWqI1F3FaxF3wIMAAGmWwl72K0ftv42OTMQzsJe9itH7b+NjkzAAABwq93Dn/NonNUx0Ni693Dn/NonNUx0AAAAAAAAAAAAAAAAAAAAAAJN2K/fDWV6SbzXGpZlpsV++Gsr0k3muNSwAAAFQOqXdxLI85nObCLflQOqXdxLI85nObCApMAAAAA1M2K/e82V6NbznEmEZ7FfvebK9Gt5ziTAAAAAAAAAAAAAAAAAAAAAAAAAAAAFDeqRfOpbnoRPv4pfIob1SL51Lc9CJ9/FAqyAAAAAmnYxPRGXEzPtlWVVPV173kzFedjvPw5W+4kpEfE/wBtk4kOGxM8le1WvzX6mtfr8vlLDFi8N3IqwYjsmY+/3UzxtZm3qtVU/wBURPy2+wADvIkAAAAAAAAAAAVLvyOkze9cjtiuisdUI+g9XZ5s64qN9WWRaO5aoyi29P1Z/W/9kl3xWtiLk17kTtW+tck9ZUEhvFl6N7dqPjP2j7rK/h9jTtevzy6Ij6z9gAEOWSAAAAAAAAE77GqfZEt2q0xGZPl5tsdXataRGI1E9XWl/ihBB73AitMpN+wZeMuUGow1lFVVXJHqqOYuSbqq5qN/61Opo2RGPm0VTy328+hwuJcOcvTLtumOmI3jw6VkgAWeokAAAAAAAAAAAA665qtBoVvz1YmEarJSCsTRcqoj3bjW572k5Ub6zxcuU26Jrq5R0slm1XeuU26I3mZiI75Vsxcnm1DEitx2tVuhHSXVF8MJqQ1/mw8ofuPFizEeJHjxHRIsRyve9y5q5yrmqqvhPwVHeuTduVVz1zM+b9E41mLFmi1HKmIjyjZb/qaPdy9/NpPnRS7JSbqaPdy9/NpPnRS7JjZgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArTspdkvTrIl5q07GmoE/dDkWHHmmZPg05d/PefF/wAOtGr8rc0VDi7NjHWDalFmMPbVnUdcE/C0KhHgv1yEBya25puRXourfa1c9Sq0oOfeoTk3UZ+Yn56YizM3MxXRY8aK5XPiPcubnKq7qqqquZ8AAAA0y2EvexWj9t/GxyZisGxOxfw0tfY/21QrgvKmU6py3wrr0tGcqPZpTcZ7c9W+1zV9ZKe39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273Ae/r3cOf82ic1THQ1BrGPWD0WkTkKHiBRnPfAe1rUe7WqtXJNwy+AAAAAAAAAAAAAAAAAAAAAAJN2K/fDWV6SbzXGpZlLsd6xTKBjbalZrM5CkqfKT7YkePEXJsNuiutTQ7b+wa8YVG9t3uAkwEZ7f2DXjCo3tu9w2/sGvGFRvbd7gJMKgdUu7iWR5zOc2ETnt/YNeMKje273FY9ntiHZV8Um0oVpXHJVh8pHmnTDZdyr1tHNh6Krmm/kv8AKngAAAANTNiv3vNlejW85xJhXTY7YzYW0DBK1KNWb2pUlUJSQbDjwIr3I6G7SXUuo9/t/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmFDeqRfOpbnoRPv4pabb+wa8YVG9t3uKdbOy87WvbEShz9qVuVq8rApKQYsWXVVRj+vRF0VzTdyVF9YFeAAAAAHY21VY1Dr8jV4DVc+VjNiaGlo6bUXtm57yKmaestzKTECclIM3LREiQI8NsWE9Ey0muTNF9aKhTUm3Y/3iyJL/FOoxUbEh5vkHO/tN1q6Hn4U1uTyKqbyISXhvPixemzXPRVy7/19EI420mrLxoybcb1W+f8Ap/Tn3bpiABPlRgAAAAAAAAB1lz1yQt2iR6tUomhBhJkjU+VEevyWNTfcv8tarkiKp4uXKbdM11ztEMlmzXfuRbtxvVPREI52RdxJLUiWtqXeqRpxUjzKJ/5TV7Vq6t96Z7uadb8pBJ2Ny1mcuCuTVXn3IseYfpKjfksTca1PIiIiJ9R1xVupZk5mTVd6uruX1ommRpuFRjxzjpn4zPP07gAGi6oAAAAAAAAfqE98KI2JDe5j2KjmuauStVNxUU/IAtZh1c0G6rXl6ijmJNNTrU3DTVoRUTWuW8i/KTyLluop6Mqph7ds9aFcbOy+cSVi5Mm5dV1RWZ/ycmvJd7Wm4qotm7frNNr9KhVOlTLZiWiZpmmpWuTda5N5yeD6l3FRSxtE1WnMtRRXPvxz+Px9VL8UaBXpt+btuPwqp6PhPZP2+DsAAd1FAAAAAAAAAgvZA3cycnGWtT42lBlX6c65rkVHRU3Ier+7rzTP5S5KmbT1WLmIsCgS0Wj0eM2LV4jVa97XZpKpuZrl/b8Cb26u8i17e5z3K5zlc5VzVVXNVUhvEWr01ROLZn/VP29fJZXBvDtdNUZ+RG39sf8A69PPsfwAEOWSt/1NHu5e/m0nzopdkoFsCb7tCx6vdsW7a/J0dk3AlWy7phyp1xWuiaSJkm9mn8S2O39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7ht/YNeMKje273ASYCM9v7BrxhUb23e4bf2DXjCo3tu9wEmAjPb+wa8YVG9t3uG39g14wqN7bvcBJgIz2/sGvGFRvbd7j4TWyHwWltHrmIFMdpZ5dbZFifx0WLl6wJTBBtW2V+CUkxywLjnKi5E+TLUyOiqvgziNan88iPrp2blsQGPbbFmVafibjXz8eHLN+vJnXFVPJq9QFszyWI+JNk4e09Zy7bhk6eqt0ocurtOYi/uQm5udr1Z5ZJvqhQy/9ldi1c7Xy8hUZW2pRyKmhTIWjEVPLFernIvlarSD6jPTtSnYs9UZyYnJqM7Six48RYkR6+FXLmqr9YFjcedljc15Qo1EseHMW1RX5tiTGmiTsw3wK5q5Qk8jVVf8AFkqoVrVVVc1XNVP4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfuDFiQIzI0GI+HFhuRzHsdk5qprRUVNxT8ACfsMMUpSrQ4VKuKNDlaiiaMOZcujDmF8u8x38lXcyVUQlFUVFyVMlQpge0s3Eq5bbhw5VsZk/IMyRJeazdoN1amOTW3UmSJrame4SzTeJJtUxbyY3jt6/Ht/fNX2t8E036pvYMxTM86Z5eHZ3cu5ZsEa0DGW155GtqkKapMXJVcr2LGhJ4ERzE0lX/AKUPWSd5WlNyzZiFctJaxyZokWbZCd62uVFT6siU2dTxL0b0XI89vlKBZOh6jjTtcs1eEbx5xvDvgcCWrNImYKRpaqyMaGu4+HMMc1fWinF+Nlq6Ku+M1EyT/wDPhZ/w0jYnJsxG81x5w06cLJqnam3VM90u5B4aqYr2TIw3LDqMaeiNdorDlZdyr9aK/RaqfU4j+5saqvNNdBoMhCprM1Tr8VUjRV16lRFTRbq3UVHeRTnZOu4ViPz+1PZHT+nzdnC4U1PLmPw/Zjtq6Plz+SXruumi2tI/CqtNIxzv91AZk6LF/db4NW6uSJvrrQrff14VK8Kr8KnP2MtCzSWlWuzZBau7r33Lqzdv+RERE6KfnJuoTcScnpqNNTERUV8WM9XvdkmSZquvcRE9R8CGaprV7O938tHZ6rM0LhnH0qPb/Nc7ezujq+oADjJKAAAAAAAAAAAAAB3FqXLWLYqCTtImlhKqp12E5NKHGRN5zd/dXXupmuSodOD1RXVRVFVM7TDxdtUXaJouRvE84nksRZ+Llv1ZsOXq+dInFyRViLnAcu5qf/Z8PbZInhUkKVjwJqWZMyseFHgREzZFhPRzHp4UVNSlNTmUuqVOlxHxKZUZyRe9NF7peO6Grk8Cq1UzQk2JxRftx7N6n2vjyn0QfUOBMW9M141c0T2c49Y+a4YK20vFu9ZN7VjTstPsa3JGTEs3L1qzRcq/Wp28tjfcCRldNUilRIeWpsJIjFRfDmrnat07NvifDqj3t48PRGb3A2p0T7s01d0+sQnsECTGN9wrG0pak0lkPL5MVsR65/Wj2/6HRVjFS9Ki2JDbUmSMKImSslITWKn1PXN6epx8ucT4dMe7Ez4er7Z4F1KuffmmmO/f6QsTXKzSaHKfCqvUJeShKiq1Yrslflu6Ld1y69xqKpDV+4wzU4yLIWsyJJwXZtdOv1RnJll2if2N/tvlbipoqRVOzU1OzT5qdmY0zMRFzfFivV73L5VXWp8SP5/EWRkxNFv3Kfhz8/RMNJ4Nw8KqLl6f5lUdvKPD13f1VVVVVVVVd1VP4AR9MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXm7CG1uHFZ4rCHYQ2tw4rPFYQFGQXm7CG1uHFZ4rCPFX9sKblp8nEm7MumUrb2orkk5uB8Fiu8jX6TmOX97QTygVOBz7ho1Wt6szNGrlPmadUZV+hHl5iGrHsXd1ou8qZKi7ioqKmo4AAAAAAAAAAAAAAAAAAAAAAABcm3th7bdTsCnXJEvGrQ4s3SoU86E2Xhq1rnwkfoovgzXIpsAAAAAAAAAAAAAAAAAAAAAAAf1EVVyRM1UsLhJsTMQLzp8GrVyYl7Up0ZEdD+FwnRJp7V3HJBRUyT95zV8gFeQXjhbCC2UhtSLfdXc/LtlbJw2ovqzXL+J++whtbhxWeKwgKMgvN2ENrcOKzxWEVa2QlgyeGWKVQs+RqEeoQJWFBe2PGYjXO04bXrmiatWeQEfAAAAAAAAAAAAAAAAAAAAAAPdYC2PK4j4sUWzJ2ejSMvUev6ceC1HPZ1uBEipki6tasRPWStsoNjpRcIrBkbkp1x1CpxZmqQ5FYUxBYxrWuhRX6Wbd/OGiesCt4AAAAAAAAAAAAAAAAAAAAACSNjlh1JYpYlwbTn6lMU6BElY0dY0BiOcisRFRMl1ayz3YQ2tw4rPFYQFGQXm7CG1uHFZ4rCHYQ2tw4rPFYQFGQXm7CG1uHFZ4rCKp492PK4cYsVqzJKejT0vTusaEeM1Gvf1yBDirmiatSvVPUB4UAAAAAAAAAAAAAAAAAAAAAB9JaBGmZmFLS8J8aNFejIcNjc3Pcq5IiIm6qqXCszYUPnLObM3RdsanV+YhI9kvLS7YsGVVU+S9VVFiKm/oq1E3lXdUKcg9LiZZVcw9vSftS4ILWTsm5Mnw1zhxmKmbYjF32qmvwpuLkqKh5oAAAAAAAAAAAAAAAAAAAAAAAFs8Etijb9/4W0O8Jy7KpJR6lCe98CFLw3NZoxHs1Kuv+zmBUwHOuGRZTK/UabDiOiMlJqLAa9yZK5GPVua/wADggAAAAAGtWM9cqNtYT3TcFIjNg1Cn0uPMS0RzEejXtYqoqoupde8pQjssMbeEklyZL9AvLsj/mEvj0JM/dqZTgTozZY42NejluGRciLmrVpkDJfJqaThsfdlw25K9KWxiLIydPmpyI2DK1OURWwHRFXJrYrHKuhmuSaaLlmutGprSjYA0e2Z+E0lfuG03cUjKtS5KDAdMS8ViIjo8BvbRILl30y0nNTecmSZaS55wmr2AtZmrnwStOrVRevzM1SYTZhz+2665G6DnOz3Vdo5r9ZlXWJdkpVpyVhqisgx3w2qi55ojlRNe/uAcUAAAAAAAAAAAAAAAAAAAABrLYnzH0H/AC1L/hmmTRrLYnzH0H/LUv8AhmmTQAAAAAAAAAAAAAAAAAAAAABbDYB4SyFw1KbxHuCUbMylLmEl6XBiNzY6ZREc6KqLu6CK3R3tJVXdahPmyU2QVEwjgwqXKyrKxc0zD65DkuuaMOAxdyJFcmtM13GprXJdaJrOVsLpKDJbGy1EhJ20dsxGiO/vOdMRf9EyT1GfmOVemrmxhuyszj3ufGqsdrEdushMerIbf+ljWp6gJIqOy4xompp0aBVaVIsduQYFNhqxv1LE0nfxU4/ZYY28JJLkyX6B02xxwVmsZZ2tS0tcEGjrS4cGI50SWWN1zriuTJMnNyy0f5ky9g5VfGLJclu/MAjPssMbeEklyZL9AizEK8a/ft0zFzXNNQ5qpzDGMiRGQmw0VGNRre1aiImpELP9g5VfGLJclu/MI42QuxxncILLk7lmbrl6uyZqLJFIMOSWErVdDiP0s1ev/l5ZZb4EDgAAAAAAAAAAAAAAAAAAAAJm2EvfO2j9t/BRyzPVHfmQo3+ZIH4aZKzbCXvnbR+2/go5ZnqjvzIUb/MkD8NMgUAAAAAAAAAAAAAAAAAAAAAAekw4ve4sPrmZcdrzcOUqLIT4TYj4LYqaLkyVNFyKhJ/ZYY28JJLkyX6BBgAvnsKsY79xNui4JG8KpAnIElJQ40BsOUhwtFyvyVc2Imeo42zRxoxBw0vyjUm0KrLycpNUtJiK2JJw4qq/rr255vaqpqamo8R1Nf8Arxdvo2D96cLqkXzqW56ET7+KB4zssMbeEklyZL9Aim/bsrd8XZO3TccyyZqk71vr8VkJsNHaENsNvatRETtWNQ6IAAAAAAAAAAAAAAAAAAAAAPRYb2hVr8val2pRIelOVCMkNHqmbYTN18R3+FrUVy/V4QLC7ATCj4wXTExHrUtpU2jROt01r01RpvLPT8qQ0XP95zcvkqXbqFy0Kn3LTLbnanAg1aqsixJGVcvbxmwkRX5fUi5+XJctxTrLcpVt4XYaS9OhRYcjQ6DIq6LGiau1aiuiRHeFzl0nLluqq5GbeKeLtwXdjS/EaSmI0jGk5li0hmeuVgwnZw2rvLnrVybiq528oFvNnZhV8cbCbelIllfW7ehudFaxubpiTzze3yqxc3p5NPfVDPg1kwavul4n4bU26JNkNEmoSwp2W+V1iO1MokJc97Pcz3Wqi75n1sscLHYX4ozECSgaFAq2lN0pyJ2rGqvbwfrhuXL91WLvgRAAAAAAAAAAAAAAAAAAAAAAGn+w+722zvNo34iIZgGn+w+722zvNo34iIBm1ff9d696SmPvXHSndX3/AF3r3pKY+9cdKAAAAAAasbI/5hL49CTP3amU5sJdtCp90WzUrdqrYjpCoyz5aYSG/RcrHJkuS7y5EKdiFg3/AMlWuUXe4DOY7ux7Vrl6XRJW3bsk+cqE5ERkNifJam+9y/2WomtVXcQv83Yh4NI5FWRrLkRdxai7X/IkO1rNwxwct+anKVIUq2pFGp8KnpmN2z03kfGiKrlTPcbnlnuIB+oj6Xg/geivisfJ2xRUajndr198OHkn/U9+WrwuMpIsR8WK+LEcrnvcrnOXfVd1SxWy92QTMSo7bStN0WHaspGSJEjuRWPqEVu45WrrSG3dRq61XtlyyRErkAAAAAAAAAAAAAAAAAAAAAAay2J8x9B/y1L/AIZpk0ay2J8x9B/y1L/hmmTQAAAAAAAAAAAAAAAAAAAAABof1P8AumXrWBraB1xPhdvzsWA+Gq9t1uK5YzHfUqviNT9xSrezEw1qViYuVSpfB4jqJXpmJPyMyiLoaURyuiQlXcRzXKur+6rVPK4CYo1bCe/IFwyDFmZOInWajJaWSTEFVzVM95ybrV3l8iqi6LWndWGuN1kvZKup9dp8difC6bNsasWA7wRIa62qi7jk1Z62qu6BnJhDixd+FczUZi0o0nCfUWQ2THwiXSLmjFcrcs9z5Skidl5jL/ztG5Ob7yz89sScF5mafGh0epyjXLn1qDUYmg36tJVX+Z8exCwb/wCSrXKLvcBEex62SeJ964yW7a9dmqW+nT8aIyO2FJNY5USE9yZLnq1tQkLqjvzIUb/MkD8NMntrD2NmGFlXdIXRQ5WqMqMg9z4Dos6r2oqtVq5plr1OU8T1R35kKN/mSB+GmQKAAAAAAAAAAAAAAAAAAAAAAJm2EvfO2j9t/BRyzPVHfmQo3+ZIH4aZKzbCXvnbR+2/go5ZnqjvzIUb/MkD8NMgUAAAAAAAAAAAAAAAAAAAAAAAABbPqa/9eLt9GwfvThdUi+dS3PQiffxTm9TX/rxdvo2D96cLqkXzqW56ET7+KBVkAAAAAAAAAAAAAAAAAAAAAL97AvCj4r2a/ECsS2jV69CRJNr264Ennmip5Yiojv3UZ4VKv7FbCyJilifLSc3BctBpmjN1V+4iw0XtYWfhe5MvDoo5U3DQPGy/6XhXhlP3JMMg6cCGkCnSiZNSNHVFSHDRPAmWa5bjWuXeAhrZV31Rbjv2i4KzNyydDo0SKyduqfjTCQkZBbk9ksjlX5bskdlr1rDXcRyEr0vF3Bel0yVplOv61ZaTlILIEvBhz8NGw4bURGtRM9xEREMva/VqhXa3O1qrTL5qfno748xGeut73Lmq/wAV3DggauS+MuFExMQ5eBiHbT4sV6MY1KhDzc5VyRN06zZNYYwcUsLp2jwYbP6YlM5ulRFyTKO1F7RV3mvTNq+DNF3jLY0h2GGK+2Jhsyk1WZ07ioLWS80r3dtMQcsoUbyrkmi5f7zc1+UgGcUzAjS0zFlpiE+DGhPVkSG9uTmORclRUXcVFPmWk2feFXxeu6HiJR5bRplbiaE+jE1QZzLPS8iRERV/ea7woVbAAAAAAAAAAAAAAAAAAAAaf7D7vbbO82jfiIhmAaf7D7vbbO82jfiIgGbV9/13r3pKY+9cdKaQ1LYnYQ1CozM/MydYWPMxnxoitqDkTScqquSZeFTj9iFg3/yVa5Rd7gM5gaM9iFg3/wAlWuUXe4p9srbEoGHOLke2rahzEOnsk4EZqR4qxHaT0VV1qBE4AAk3b+xk8YVa9tvuG39jJ4wq17bfcAB+I2PWMcWE6G7EOuIjt1WRkav8URFQ8bc103Nc8dse5Lhq1YiMVVY6enIkdW/VpKuXqAA6cAAAAAAAAAAAAAAAAAAAAAAAEhymN2LEpSoNKlr6q0KSgwGy8OC17dFsNG6KNTVuIiZEeAAAAAAAAAAAAAAAAAAAAAAAA5NNnp6mzkOdp05MSc1DXOHGl4rob2r5HIqKgAHu5HHHF+Th6EHEW4nJkiftpx0VdXlfmpydv7GTxhVr22+4ABt/YyeMKte233HRXriff960qFSrqumoVaShR0mIcGYcitbERrmo7Um7k5yesADx4AAAAAAAAAAAAAAAAAAAADs7Wr9Zteuy1dt+oxqdU5bS6zMwVyezSarHZfW1zk9Z3t64n3/etKhUq6rpqFWkoUdJiHBmHIrWxEa5qO1Ju5OcnrAA8eAAAAAAAAAAAAAAAAAAAAAAAD0Vj3vdlkTUxNWnXZukR5liQ4z5dyIr2ouaIuaeE/F7XndN7VCBP3XW5qrzUCF1mFFmFRVYzNV0UyTczVV9YAHQAAAAAAAAAAAAAAAAAAAAAPSWjfl52hLR5a17nqtGgzD0fGZJzDoSRHImSKuW7qP5d99Xld8GXg3Rc9WrMKWcroLJyadEbDcqIiqiKu7qAA84AAB29qXPcVqVJ9Stmtz9HnHwlhPjScd0J7mKqKrVVN1M0RcvIgAHeV/FXEa4KHNUOu3lWKpTZrR69LzcwsVjtFyOb8rPLJURdXgQ8YAAAAAAAAAAAAAAAAAAAAA95beMWJ1t0SWolCvSqSFOlWq2BLwnojYaKquVE1eFVX1gAdjt/YyeMKte233Db+xk8YVa9tvuAAbf2MnjCrXtt9x4q77nr93Vl1ZuWqzFUqDmNhujx1RXK1u4mrwAAdOAAP/Z" alt="Hex5 Digital" style={{ height:26, width:'auto' }} />
          </a>
          <div style={{ display:'flex', alignItems:'center', paddingLeft:22, gap:10 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'0.1px' }}>
              Parity
            </span>
            <span style={{ width:1, height:18, background:'rgba(255,255,255,0.2)' }} aria-hidden="true" />
            <span style={{ fontSize:11, color:'#A8C4DC', fontWeight:600,
              letterSpacing:'0.5px', textTransform:'uppercase' }}>
              Accessibility Auditor
            </span>
          </div>
          <a href="mailto:accessibility@hex5digital.com"
            style={{ marginLeft:'auto', display:'flex', alignItems:'center',
              padding:'0 20px', fontSize:13, fontWeight:700, color:H5.primary,
              background:'#fff', textDecoration:'none', borderLeft:`3px solid ${H5.tertiary}` }}>
            Talk to an expert
          </a>
        </div>
      </header>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px 64px' }}>

        {/* ── Hero — URL input ── */}
        {!scanned && !loading && (
          <div style={{ padding:'48px 0 40px', borderBottom:`1px solid ${H5.border}`, marginBottom:32 }}>
            <p style={{ fontSize:12, fontWeight:700, color:H5.secondary, letterSpacing:'1px',
              textTransform:'uppercase', marginBottom:12 }}>
              Free · Instant · No account needed
            </p>
            <h1 style={{ fontSize:28, fontWeight:700, color:H5.primary, lineHeight:1.25,
              letterSpacing:'-0.5px', marginBottom:16, maxWidth:560 }}>
              Is your website accessible to everyone — and are you legally exposed?
            </h1>
            <p style={{ fontSize:15, color:'#374151', lineHeight:1.8, marginBottom:32, maxWidth:540 }}>
              Paste your URL below. In seconds you'll see your accessibility score,
              your legal risk level, and exactly what it would cost to fix.
            </p>

            {/* URL input — the whole hero */}
            <div style={{ display:'flex', gap:0, border:`2px solid ${H5.primary}`,
              background:'#fff', maxWidth:600 }}>
              <label htmlFor="site-url" className="sr-only">Your website URL</label>
              <input ref={inputRef} id="site-url" type="url"
                value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey}
                placeholder="https://yourwebsite.com"
                aria-describedby="url-hint"
                style={{ flex:1, padding:'14px 18px', fontSize:15, border:'none',
                  outline:'none', color:'#1F2937', background:'transparent' }} />
              <button onClick={runScan}
                style={{ padding:'14px 28px', border:'none', background:H5.secondary,
                  color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer',
                  borderLeft:`3px solid ${H5.tertiary}`, whiteSpace:'nowrap' }}>
                Check my site
              </button>
            </div>
            <p id="url-hint" style={{ fontSize:12, color:H5.muted, marginTop:8 }}>
              Enter any publicly accessible URL — your homepage, a product page, or a landing page.
            </p>

            {/* ── Error — appears directly under the URL field ── */}
            {error && (
              <div role="alert" style={{ background:H5.risk.high.bg, border:`1px solid ${H5.risk.high.fg}33`,
                padding:'14px 16px', marginTop:12, maxWidth:600 }}>
                <p style={{ fontSize:13.5, color:H5.risk.high.fg, fontWeight:600, marginBottom:4 }}>
                  We couldn't complete that scan
                </p>
                <p style={{ fontSize:13, color:'#374151', lineHeight:1.6, margin:0 }}>
                  {error}
                </p>
              </div>
            )}

            {/* Trust signals */}
            <div style={{ display:'flex', gap:32, marginTop:36, flexWrap:'wrap' }}>
              {[
                ['4,000+', 'ADA web lawsuits filed in 2023'],
                ['96%',    'of top websites have accessibility failures'],
                ['1 in 4', 'Americans have a disability'],
              ].map(([stat, label]) => (
                <div key={stat}>
                  <div style={{ fontSize:22, fontWeight:700, color:H5.secondary }}>{stat}</div>
                  <div style={{ fontSize:12, color:H5.muted, marginTop:2, maxWidth:140 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hero image + about/credentials ── */}
        {!scanned && !loading && (
          <section aria-label="About Parity and Hex5 Digital" style={{ marginBottom:48 }}>

            {/* Hero illustration */}
            <div style={{ marginBottom:40 }}>
              <img src="/hero-illustration.svg" alt=""
                role="presentation"
                style={{ width:'100%', height:'auto', display:'block' }} />
            </div>

            {/* About copy */}
            <div style={{ maxWidth:640, marginBottom:32 }}>
              <p style={{ fontSize:11, fontWeight:700, color:H5.secondary, letterSpacing:'1px',
                textTransform:'uppercase', marginBottom:10 }}>
                Built by Hex5 Digital
              </p>
              <h2 style={{ fontSize:22, fontWeight:700, color:H5.primary, lineHeight:1.35,
                marginBottom:14, letterSpacing:'-0.3px' }}>
                Parity was built by the same team that tests accessibility for a living.
              </h2>
              <p style={{ fontSize:14.5, color:'#374151', lineHeight:1.85, marginBottom:14 }}>
                Hex5 Digital is a digital accessibility and remediation firm. We built Parity
                because most accessibility tools are made for developers — full of jargon,
                missing the business context that actually drives decisions. Parity translates
                technical findings into the information business leaders need: what's broken,
                who it affects, what it's worth in legal exposure, and what it costs to fix.
              </p>
              <p style={{ fontSize:14.5, color:'#374151', lineHeight:1.85 }}>
                The underlying audit methodology reflects the same standards our team applies
                in client remediation engagements — WCAG 2.2, Section 508, and PDF/UA.
              </p>
            </div>

            {/* Credentials row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',
              gap:1, border:`1px solid ${H5.border}`, marginBottom:24 }}>
              {[
                {
                  title:'DHS Trusted Tester certified',
                  body:'Our team holds Trusted Tester certification from the U.S. Department of Homeland Security — the federal standard for testing websites and applications against Section 508 requirements.',
                },
                {
                  title:'WCAG 2.2 & Section 508 methodology',
                  body:'Every audit in Parity follows the same testing methodology used in our client engagements — covering all four WCAG principles: perceivable, operable, understandable, and robust.',
                },
                {
                  title:'Remediation, not just reporting',
                  body:'Unlike tools that only flag issues, Hex5 Digital fixes them — code-level remediation, design system updates, and documentation, with hour estimates grounded in real project work.',
                },
              ].map(c => (
                <div key={c.title} style={{ background:'#fff', padding:'20px 22px' }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:H5.primary, marginBottom:8,
                    lineHeight:1.4 }}>{c.title}</div>
                  <div style={{ fontSize:12.5, color:H5.muted, lineHeight:1.7 }}>{c.body}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize:12, color:H5.muted, lineHeight:1.7, maxWidth:640 }}>
              Trusted Tester certification is issued by the DHS Office of Accessible Systems
              and Technology and is the recognized standard for federal Section 508 conformance
              testing.
            </p>
          </section>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div role="status" aria-live="polite"
            style={{ padding:'64px 0', textAlign:'center' }}>
            <div style={{ width:48, height:48, border:`4px solid ${H5.light}`,
              borderTop:`4px solid ${H5.secondary}`, borderRadius:'50%',
              animation:'spin 0.8s linear infinite', margin:'0 auto 20px' }} />
            <p style={{ fontSize:16, color:H5.primary, fontWeight:600, marginBottom:4 }}>{loadMsg}</p>
            <p style={{ fontSize:13, color:H5.muted }}>Auditing {url} — this can take up to 30 seconds</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Results ── */}
        <main id="main-content" tabIndex={-1} ref={mainRef} style={{ outline:'none' }}>
          {scanned && !loading && scanData && (
            <>
              {/* Scanned URL + re-scan option */}
              <div style={{ display:'flex', alignItems:'center', gap:12,
                marginBottom:20, paddingTop:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:13, color:H5.muted }}>
                  Results for <strong style={{ color:H5.primary }}>{scanData.url}</strong>
                </div>
                <button onClick={() => { setScanned(false); setScanData(null); setUrl('') }}
                  style={{ fontSize:12, color:H5.secondary, background:'none',
                    border:'none', cursor:'pointer', textDecoration:'underline',
                    padding:0, minHeight:'auto' }}>
                  Scan a different URL
                </button>
              </div>
              <Results
                target={scanData.url}
                data={scanData}
                onGetReport={() => setShowModal(true)}
                onScanUrl={runScan}
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
            totalDollarMin: scanData.totalDollarMin,
            totalDollarMax: scanData.totalDollarMax,
          }}
          onSubmit={() => {}}
          onClose={() => setShowModal(false)}
        />
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
