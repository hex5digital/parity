// generatePDF.js — Hex5 Parity · Browser-side PDF generator
// Uses jsPDF + jspdf-autotable. No server needed.
// Built from real axe-core scan results (see api/scan.js).

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { LOGO_WHITE, LOGO_DARK } from './logoAssets.js'

// ── Brand ─────────────────────────────────────────────────────────
const NAVY   = [25,  51,  90]   // #19335A
const BLUE   = [0,   120, 189]  // #0078BD
const PURPLE = [71,  0,   105]  // #470069
const WHITE  = [255, 255, 255]
const LIGHT  = [232, 239, 245]  // #E8EFF5
const MUTED  = [85,  95,  110]
const TEXT   = [31,  41,  55]
const BORDER = [176, 186, 196]

// Risk colors — matches H5.risk in App.jsx
const RISK_COLORS = {
  high:   { bg:[254,226,226], fg:[127,29,29], label:'High legal risk' },
  medium: { bg:[254,243,199], fg:[120,53,15], label:'Medium legal risk' },
  low:    { bg:[209,250,229], fg:[6,78,59],   label:'Lower priority' },
}

const RISK_ORDER = { high:0, medium:1, low:2 }

function setFill(doc, rgb)   { doc.setFillColor(...rgb) }
function setDraw(doc, rgb)   { doc.setDrawColor(...rgb) }
function setFont(doc, rgb)   { doc.setTextColor(...rgb) }

const fmt = n => n >= 1000 ? `$${(n/1000).toFixed(1).replace(/\.0$/,'')}K` : `$${n}`

// Draw the running header + footer on every page
function addPageChrome(doc, pageNum, totalPages, target, logoDataUri) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Header bar — taller to give logo room to breathe
  setFill(doc, NAVY)
  doc.rect(0, 0, W, 18, 'F')

  // Logo in header (white version) — left side, vertically centered in bar
  if (logoDataUri) {
    try { doc.addImage(logoDataUri, 'PNG', 6, 2, 26, 8, '', 'FAST') } catch(_) {}
  }

  // Vertical separator between logo and text
  setFill(doc, [255,255,255,0.2])
  doc.setDrawColor(255,255,255)
  doc.setLineWidth(0.3)
  doc.line(35, 3.5, 35, 14.5)

  // "Parity · Accessibility Audit Report" — right of separator, top line
  setFont(doc, [168,196,220])
  doc.setFontSize(6)
  doc.setFont('helvetica','bold')
  doc.text('PARITY  ·  ACCESSIBILITY AUDIT REPORT', 38, 8)

  // Standard line below
  doc.setFont('helvetica','normal')
  doc.setFontSize(5.5)
  setFont(doc, [120,160,200])
  const stdLabel = target ? target.replace(/^https?:\/\//, '').slice(0, 60) : ''
  if (stdLabel) doc.text(stdLabel, 38, 13)

  // Right side: date + page
  setFont(doc, WHITE)
  doc.setFontSize(7)
  doc.setFont('helvetica','normal')
  const dateStr = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
  doc.text(dateStr, W - 8, 8, { align:'right' })
  doc.text(`Page ${pageNum} of ${totalPages}`, W - 8, 13, { align:'right' })

  // Blue underline on header
  setFill(doc, BLUE)
  doc.rect(0, 18, W, 1.2, 'F')

  // Footer
  setFill(doc, LIGHT)
  doc.rect(0, H - 10, W, 10, 'F')
  setFont(doc, NAVY)
  doc.setFontSize(6.5)
  doc.text('© 2025 Hex5 Digital  ·  hex5digital.com  ·  Confidential', 6, H - 4)
  doc.text('Powered by Parity — Hex5 Digital Accessibility Suite', W - 6, H - 4, { align:'right' })
}

// ── Main export ───────────────────────────────────────────────────
// Expects `issues` shaped like api/scan.js output:
//   { id, risk: 'high'|'medium'|'low', plain, who, fix, count,
//     effort: '2–8 hours', dollarMin, dollarMax, devDetail }
export async function generateAuditPDF({ issues, target, score, lead, totalDollarMin, totalDollarMax, standard }) {
  const doc = new jsPDF({ unit:'mm', format:'letter', orientation:'portrait' })
  const W   = doc.internal.pageSize.getWidth()   // 215.9mm
  const H   = doc.internal.pageSize.getHeight()  // 279.4mm
  const L   = 12   // left margin
  const R   = W - L // right margin
  const CW  = R - L // content width

  const logoWhite = LOGO_WHITE

  const ts = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})

  const highRisk = issues.filter(i=>i.risk==='high')
  const medRisk  = issues.filter(i=>i.risk==='medium')
  const lowRisk  = issues.filter(i=>i.risk==='low')
  const critCount = highRisk.length

  const dMin = totalDollarMin ?? issues.reduce((s,i)=>s+i.dollarMin,0)
  const dMax = totalDollarMax ?? issues.reduce((s,i)=>s+i.dollarMax,0)
  const finalScore = score ?? Math.max(0, 100 - critCount*18 - medRisk.length*9)

  const riskLabel = critCount >= 3 ? 'High' : critCount >= 1 ? 'Medium' : 'Low'
  const riskColor = critCount >= 3 ? RISK_COLORS.high : critCount >= 1 ? RISK_COLORS.medium : RISK_COLORS.low

  // ── PAGE 1: COVER ─────────────────────────────────────────────────
  // Dark navy hero band
  setFill(doc, NAVY)
  doc.rect(0, 0, W, 90, 'F')

  setFill(doc, BLUE)
  doc.rect(0, 90, W, 3, 'F')

  // Logo — larger, with clear breathing room below it
  if (logoWhite) {
    try { doc.addImage(logoWhite, 'PNG', L, 14, 60, 18, '', 'FAST') } catch(_) {}
  }

  // Purple accent bar — positioned clear of logo
  setFill(doc, PURPLE)
  doc.rect(L - 3, 44, 2, 32, 'F')

  // "PARITY · ACCESSIBILITY AUDITOR" tagline — well below logo
  setFont(doc, [168,196,220])
  doc.setFontSize(8.5)
  doc.setFont('helvetica','bold')
  doc.text('PARITY  ·  ACCESSIBILITY AUDITOR', L, 46)

  // Report title
  setFont(doc, WHITE)
  doc.setFontSize(28)
  doc.setFont('helvetica','bold')
  doc.text('Accessibility', L, 60)
  doc.text('Audit Report', L, 72)

  // Meta block
  let y = 100
  const metaRows = [
    ['Audit target', target || 'Not specified'],
    ['Report date',  ts],
    ['Standards',    standard || 'WCAG 2.2 AA'],
    ['Auditor',      'Hex5 Parity — automated scan, hex5digital.com'],
  ]
  if (lead?.name) metaRows.push(['Prepared for', `${lead.name}  ·  ${lead.company}  ·  ${lead.email}`])

  doc.autoTable({
    startY: y,
    margin: { left:L, right:L },
    head: [],
    body: metaRows,
    styles: { fontSize:9, cellPadding:3, font:'helvetica' },
    columnStyles: {
      0: { fontStyle:'bold', cellWidth:38, textColor:MUTED, fillColor:LIGHT },
      1: { textColor:TEXT, fillColor:LIGHT },
    },
    tableLineColor: BORDER,
    tableLineWidth: 0.3,
  })

  y = doc.lastAutoTable.finalY + 8

  // Score cards row — the three numbers that matter
  const cards = [
    { val:finalScore.toString(), label:'Accessibility Score',
      color: finalScore>=80?[6,78,59]:finalScore>=50?[120,53,15]:[127,29,29] },
    { val:riskLabel, label:'Legal Risk Level', color:riskColor.fg },
    { val: issues.length===0 ? '$0' : `${fmt(dMin)}–${fmt(dMax)}`, label:'Est. Remediation Cost', color:BLUE },
  ]
  const cardW = CW / cards.length
  cards.forEach((card, i) => {
    const cx = L + i * cardW
    setFill(doc, LIGHT)
    setDraw(doc, BORDER)
    doc.rect(cx, y, cardW - 2, 26, 'FD')
    doc.setFontSize(20)
    doc.setFont('helvetica','bold')
    setFont(doc, card.color)
    doc.text(card.val, cx + cardW/2 - 1, y + 13, { align:'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica','normal')
    setFont(doc, MUTED)
    doc.text(card.label.toUpperCase(), cx + cardW/2 - 1, y + 21, { align:'center' })
  })

  y += 34

  // Context summary box
  setFill(doc, riskColor.bg)
  setDraw(doc, riskColor.fg)
  doc.rect(L, y, CW, 22, 'FD')
  setFont(doc, riskColor.fg)
  doc.setFontSize(8.5)
  doc.setFont('helvetica','normal')
  const summaryText = issues.length === 0
    ? 'Our automated scan found no high or medium risk issues on this page. A full manual review is still recommended to catch issues automated tools cannot detect.'
    : critCount >= 3
    ? `This site has ${critCount} high-risk issues commonly cited in ADA Title III web accessibility lawsuits. Over 4,000 such lawsuits were filed in 2023. Remediation typically resolves legal exposure within 60-90 days.`
    : critCount >= 1
    ? `This site has ${critCount} high-risk issue${critCount>1?'s':''} that could attract legal attention. Addressing these first significantly reduces exposure.`
    : 'No high-risk issues found. Addressing medium-risk items moves this site toward full WCAG 2.2 AA conformance.'
  const summaryLines = doc.splitTextToSize(summaryText, CW - 8)
  doc.text(summaryLines, L + 4, y + 7)

  // ── PAGE 2+: FINDINGS ─────────────────────────────────────────────
  doc.addPage()
  y = 20

  const sorted = [...issues].sort((a,b)=>(RISK_ORDER[a.risk]??3)-(RISK_ORDER[b.risk]??3))

  setFont(doc, NAVY)
  doc.setFontSize(16)
  doc.setFont('helvetica','bold')
  doc.text('What we found', L, y)
  setFill(doc, BLUE)
  doc.rect(L, y + 2, CW, 0.8, 'F')
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica','normal')
  setFont(doc, MUTED)
  doc.text('Findings are ordered by risk level — highest priority first.', L, y + 4)
  y += 12

  if (sorted.length === 0) {
    setFill(doc, RISK_COLORS.low.bg)
    setDraw(doc, RISK_COLORS.low.fg)
    doc.rect(L, y, CW, 20, 'FD')
    setFont(doc, RISK_COLORS.low.fg)
    doc.setFontSize(10)
    doc.setFont('helvetica','bold')
    doc.text('No automated issues found', L + 4, y + 8)
    doc.setFont('helvetica','normal')
    doc.setFontSize(8.5)
    const noneLines = doc.splitTextToSize(
      'Automated scans typically catch 30-40% of real-world accessibility issues. A full manual review by our team can confirm the rest.',
      CW - 8
    )
    doc.text(noneLines, L + 4, y + 14)
    y += 24
  }

  for (const issue of sorted) {
    const rc = RISK_COLORS[issue.risk] || RISK_COLORS.low

    if (y > H - 70) { doc.addPage(); y = 20 }

    // Issue title bar
    setFill(doc, rc.bg)
    setDraw(doc, rc.fg)
    doc.rect(L, y, CW, 10, 'FD')

    // Risk badge
    setFill(doc, rc.fg)
    doc.rect(L, y, 32, 10, 'F')
    setFont(doc, WHITE)
    doc.setFontSize(6.5)
    doc.setFont('helvetica','bold')
    doc.text(rc.label.toUpperCase(), L + 16, y + 6.5, { align:'center' })

    // Plain-language title
    setFont(doc, TEXT)
    doc.setFontSize(10)
    doc.setFont('helvetica','bold')
    doc.text(issue.plain, L + 36, y + 6.5, { maxWidth: CW - 70 })

    // Count, right-aligned
    setFont(doc, BLUE)
    doc.setFontSize(8)
    doc.setFont('helvetica','bold')
    doc.text(`${issue.count} found`, R, y + 6.5, { align:'right' })

    y += 13

    // "Likely site-wide" badge, if applicable
    if (issue.likelySitewide) {
      setFill(doc, PURPLE)
      doc.rect(L, y - 6, 32, 5, 'F')
      setFont(doc, WHITE)
      doc.setFontSize(6)
      doc.setFont('helvetica','bold')
      doc.text('LIKELY SITE-WIDE', L + 16, y - 3, { align:'center' })
      y += 2
    }

    // Who this affects
    setFont(doc, NAVY)
    doc.setFontSize(8)
    doc.setFont('helvetica','bold')
    doc.text('Who this affects', L, y)
    y += 4.5
    doc.setFont('helvetica','normal')
    setFont(doc, TEXT)
    doc.setFontSize(8.5)
    const whoLines = doc.splitTextToSize(issue.who, CW)
    doc.text(whoLines, L, y)
    y += whoLines.length * 4.2 + 4

    if (issue.likelySitewide) {
      if (y > H - 30) { doc.addPage(); y = 20 }
      setFill(doc, [243, 232, 255])
      setDraw(doc, PURPLE)
      const swLines = doc.splitTextToSize(
        "This was found in your site's shared header, navigation, footer, or global stylesheet -- it likely affects every page that uses this template, not just the one scanned.",
        CW - 8
      )
      const boxH = swLines.length * 4 + 4
      doc.rect(L, y - 3, CW, boxH, 'FD')
      setFont(doc, PURPLE)
      doc.setFontSize(8)
      doc.setFont('helvetica','normal')
      doc.text(swLines, L + 4, y + 1)
      y += boxH + 3
    }

    // What needs to happen
    if (y > H - 40) { doc.addPage(); y = 20 }
    setFont(doc, NAVY)
    doc.setFontSize(8)
    doc.setFont('helvetica','bold')
    doc.text('What needs to happen', L, y)
    y += 4.5
    doc.setFont('helvetica','normal')
    setFont(doc, TEXT)
    doc.setFontSize(8.5)
    const fixLines = doc.splitTextToSize(issue.fix, CW)
    doc.text(fixLines, L, y)
    y += fixLines.length * 4.2 + 4

    // Cost / effort / count row
    if (y > H - 22) { doc.addPage(); y = 20 }
    const statCols = [
      { label:'Instances found', val:`${issue.count}` },
      { label:'Est. hours',      val:issue.effort },
      { label:'Est. cost',       val:`${fmt(issue.dollarMin)}-${fmt(issue.dollarMax)}` },
    ]
    const statW = CW / 3
    statCols.forEach((c, i) => {
      const cx = L + i * statW
      setFill(doc, LIGHT)
      setDraw(doc, BORDER)
      doc.rect(cx, y, statW - 2, 14, 'FD')
      setFont(doc, MUTED)
      doc.setFontSize(6.5)
      doc.setFont('helvetica','normal')
      doc.text(c.label.toUpperCase(), cx + 3, y + 5)
      setFont(doc, NAVY)
      doc.setFontSize(10)
      doc.setFont('helvetica','bold')
      doc.text(c.val, cx + 3, y + 11)
    })
    y += 18

    // Technical detail — small, muted, for the dev team
    if (y > H - 16) { doc.addPage(); y = 20 }
    setFont(doc, MUTED)
    doc.setFontSize(7)
    doc.setFont('helvetica','italic')
    const devLines = doc.splitTextToSize(`For your dev team: ${issue.devDetail}`, CW)
    doc.text(devLines, L, y)
    y += devLines.length * 3.6 + 8
  }

  // ── REMEDIATION ROADMAP PAGE ──────────────────────────────────────
  if (sorted.length > 0) {
    doc.addPage()
    y = 20

    setFont(doc, NAVY)
    doc.setFontSize(16)
    doc.setFont('helvetica','bold')
    doc.text('Remediation Roadmap', L, y)
    setFill(doc, BLUE)
    doc.rect(L, y + 2, CW, 0.8, 'F')
    y += 10

    doc.setFontSize(9)
    doc.setFont('helvetica','normal')
    setFont(doc, TEXT)
    const introLines = doc.splitTextToSize(
      'This phased plan prioritizes issues by risk level. Completing Phase 1 addresses the highest-impact issues first and meaningfully reduces legal exposure under ADA Title III and Section 508.',
      CW
    )
    doc.text(introLines, L, y)
    y += introLines.length * 5 + 6

    const phases = [
      { label:'Phase 1 — High risk',   risk:'high',   est:'Weeks 1-2' },
      { label:'Phase 2 — Medium risk', risk:'medium', est:'Weeks 2-4' },
      { label:'Phase 3 — Lower priority', risk:'low', est:'Weeks 4-6' },
    ]

    for (const phase of phases) {
      const phaseIssues = sorted.filter(i=>i.risk===phase.risk)
      if (!phaseIssues.length) continue
      if (y > H - 50) { doc.addPage(); y = 20 }

      const rc = RISK_COLORS[phase.risk]
      setFill(doc, rc.bg)
      setDraw(doc, rc.fg)
      doc.rect(L, y, CW, 9, 'FD')
      setFont(doc, rc.fg)
      doc.setFontSize(10)
      doc.setFont('helvetica','bold')
      doc.text(phase.label, L + 4, y + 6.5)
      doc.text(phase.est, R, y + 6.5, { align:'right' })
      y += 11

      doc.autoTable({
        startY: y,
        margin: { left:L, right:L },
        head: [['Issue','Instances','Est. Hours','Est. Cost']],
        body: phaseIssues.map(i => [i.plain, i.count.toString(), i.effort, `${fmt(i.dollarMin)}-${fmt(i.dollarMax)}`]),
        headStyles: { fillColor:NAVY, textColor:WHITE, fontStyle:'bold', fontSize:8 },
        bodyStyles: { fontSize:8, textColor:TEXT },
        alternateRowStyles: { fillColor:LIGHT },
        columnStyles: {
          0: { cellWidth:'auto' },
          1: { cellWidth:22, halign:'center' },
          2: { cellWidth:28, textColor:BLUE, fontStyle:'bold' },
          3: { cellWidth:28, fontStyle:'bold' },
        },
        tableLineColor: BORDER,
        tableLineWidth: 0.3,
      })
      y = doc.lastAutoTable.finalY + 8
    }
  }

  // ── METHODOLOGY PAGE ──────────────────────────────────────────────
  doc.addPage()
  y = 20

  setFont(doc, NAVY)
  doc.setFontSize(16)
  doc.setFont('helvetica','bold')
  doc.text('How this report was built', L, y)
  setFill(doc, BLUE)
  doc.rect(L, y + 2, CW, 0.8, 'F')
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica','normal')
  setFont(doc, TEXT)

  const methodSections = [
    ['Automated scan', 'This report is based on an automated scan of the page above using axe-core, the accessibility testing engine used by Google, Microsoft, and the U.S. government. The scan checks the page against WCAG 2.1 and 2.2 success criteria at levels A and AA.'],
    ['Risk levels', 'Each finding is assigned a risk level (high, medium, or low) based on its likely impact on users with disabilities and its frequency in real-world ADA Title III litigation. High-risk findings — missing alt text, low contrast, inaccessible forms — are the issues most commonly cited in legal complaints.'],
    ['Cost estimates', "Cost ranges are based on Hex5 Digital's typical project rates and remediation time for comparable work -- the same rates Hex5 would quote for this work. These figures reflect only the issues detected on the single page scanned. Most sites share templates and components across many pages, and a full manual review frequently surfaces additional issues automated tools cannot detect -- actual project scope and cost are often higher than the estimate shown here. A full-site audit gives a fixed-price quote based on your actual codebase."],
    ['What this scan does not cover', 'Automated tools detect roughly 30-40% of real-world accessibility barriers. This scan does not evaluate PDF documents, video captioning, screen reader usability testing, or cognitive accessibility -- these require manual expert review.'],
    ['Important disclaimer', 'This report is an automated screening tool, not a legal opinion or a substitute for a full accessibility audit. It is intended to give you a general sense of your exposure and is not a complete inventory of every issue on your site -- think of it as the tip of the iceberg. A conversation with Hex5 Digital\'s accessibility team, including a full manual review, is the only way to identify everything that may affect your legal risk and your customers.'],
    ['Next steps', 'For a complete WCAG 2.2 AA conformance review including manual testing, document and presentation audits, and a formal VPAT for procurement, contact Hex5 Digital.'],
  ]

  for (const [heading, body] of methodSections) {
    if (y > H - 30) { doc.addPage(); y = 20 }
    setFont(doc, NAVY)
    doc.setFontSize(10)
    doc.setFont('helvetica','bold')
    doc.text(heading, L, y)
    y += 5
    setFont(doc, TEXT)
    doc.setFontSize(8.5)
    doc.setFont('helvetica','normal')
    const lines = doc.splitTextToSize(body, CW)
    doc.text(lines, L, y)
    y += lines.length * 4.2 + 8
  }

  // ── CLOSING CTA PAGE ──────────────────────────────────────────────
  doc.addPage()
  const midY = 30

  setFill(doc, NAVY)
  doc.rect(L, midY - 6, CW, 48, 'F')
  setFill(doc, BLUE)
  doc.rect(L, midY - 6, 3, 48, 'F')

  setFont(doc, WHITE)
  doc.setFontSize(15)
  doc.setFont('helvetica','bold')
  doc.text('Ready to fix this?', L + 10, midY + 10)

  doc.setFontSize(9)
  doc.setFont('helvetica','normal')
  setFont(doc, [168,196,220])
  const ctaLines = doc.splitTextToSize(
    'Hex5 Digital remediates accessibility issues end-to-end - code, design system, and documents. Our team holds DHS Trusted Tester certification for Section 508 conformance testing. The estimate in this report reflects the same rates we would quote for this work.',
    CW - 20
  )
  doc.text(ctaLines, L + 10, midY + 18)

  setFont(doc, WHITE)
  doc.setFontSize(9)
  doc.setFont('helvetica','bold')
  doc.text('hex5digital.com  ·  accessibility@hex5digital.com', L + 10, midY + 38)

  // ── WHAT HAPPENS NEXT ─────────────────────────────────────────────
  let stepY = midY + 60
  doc.setFontSize(11)
  doc.setFont('helvetica','bold')
  setFont(doc, NAVY)
  doc.text('What happens next', L, stepY)
  stepY += 10

  const steps = [
    ['1', 'Full-site audit', 'We scan every page and template, plus a manual review for issues automated tools miss.'],
    ['2', 'Scoped quote', 'A fixed-price remediation plan based on your actual codebase -- no surprises.'],
    ['3', 'Fix & verify', 'Code, design system, and document fixes, with re-testing to confirm conformance.'],
  ]

  const colW = CW / 3
  for (let i = 0; i < steps.length; i++) {
    const [num, title, desc] = steps[i]
    const x = L + i * colW

    setFill(doc, BLUE)
    doc.rect(x, stepY, 1.2, 22, 'F')

    setFont(doc, BLUE)
    doc.setFontSize(8)
    doc.setFont('helvetica','bold')
    doc.text(`STEP ${num}`, x + 5, stepY + 4)

    setFont(doc, NAVY)
    doc.setFontSize(10)
    doc.setFont('helvetica','bold')
    doc.text(title, x + 5, stepY + 10)

    setFont(doc, MUTED)
    doc.setFontSize(8)
    doc.setFont('helvetica','normal')
    const descLines = doc.splitTextToSize(desc, colW - 10)
    doc.text(descLines, x + 5, stepY + 15)
  }

  // ── QR CODE ───────────────────────────────────────────────────────
  const qrY = stepY + 40
  const scanUrl = 'https://parity.hex5digital.com'
  try {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(scanUrl)}&format=png&bgcolor=ffffff&color=19335a&margin=2`
    const qrRes = await fetch(qrApiUrl)
    const qrBlob = await qrRes.blob()
    const qrDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(qrBlob)
    })
    doc.addImage(qrDataUrl, 'PNG', L, qrY, 22, 22)
  } catch(e) {
    // QR code fetch failed — skip gracefully, don't break PDF generation
    console.warn('QR code generation failed:', e)
  }

  setFont(doc, NAVY)
  doc.setFontSize(10)
  doc.setFont('helvetica','bold')
  doc.text('Scan to check another page', L + 26, qrY + 7)
  setFont(doc, MUTED)
  doc.setFontSize(8.5)
  doc.setFont('helvetica','normal')
  const qrLines = doc.splitTextToSize(`Run a free scan on any page at ${scanUrl} — share this report with your team, or scan another page to see how your site compares across templates.`, CW - 26)
  doc.text(qrLines, L + 26, qrY + 13)

  // ── ADD RUNNING CHROME TO ALL PAGES ──────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    addPageChrome(doc, p, totalPages, target, logoWhite)
  }

  return doc
}
