// api/scan.js
// Vercel serverless function — runs a real WCAG 2.2 audit using axe-core
// inside headless Chrome (Playwright), then maps raw violations into
// plain-language findings with risk levels and cost estimates.
//
// Runtime: Node.js on Vercel, "maxDuration" extended via vercel.json
// (see vercel.json — Hobby plan allows up to 60s on serverless functions)
//
// Dependencies (see api/package.json — versions matter, they must be paired):
//   "playwright-core": "1.41.2"
//   "@axe-core/playwright": "^4.10.0"
//   "@sparticuz/chromium": "121.0.0"
//
// NOTE: newer @sparticuz/chromium versions (123+) can fail on Vercel's
// Node runtime with "libnss3.so: cannot open shared object file" — this
// is a missing system library on Vercel's host, not a code bug.
// 121.0.0 is widely reported to work without requiring libnss3.

import { chromium } from 'playwright-core'
import chromiumBinary from '@sparticuz/chromium'
import AxeBuilder from '@axe-core/playwright'

export const config = {
  maxDuration: 60,
}

// ── Mapping: axe rule ID → plain-language issue template ───────────
// Each entry defines how a raw axe-core violation becomes a
// business-readable finding. dollarPerInstance is a rough blended
// dev-rate estimate ($150/hr) used to compute the cost range.
const RULE_MAP = {
  'image-alt': {
    id:'alt', risk:'high',
    plain:'Images on your site are invisible to some customers',
    who:'Blind customers and anyone using assistive technology cannot access your images, product photos, or chart data. This is one of the most commonly cited violations in ADA website lawsuits.',
    fix:'Each image needs a brief text description added behind the scenes. Most can be fixed in minutes. Charts and graphs take longer because the data itself needs to be described.',
    hoursPerInstance: [0.1, 0.4],
    devDetailTemplate: 'Missing or empty alt attributes on <img> elements. WCAG 1.1.1 (A). Use aria-describedby for complex images.',
  },
  'color-contrast': {
    id:'contrast', risk:'high',
    plain:'Your text is hard to read for many people',
    who:'1 in 12 men and 1 in 200 women have color vision deficiency. Low-contrast text also fails anyone reading in bright light or on a low-quality screen. Contrast failures are among the most common issues found in ADA complaints.',
    fix:"Some text and background color combinations on your site don't meet the legal minimum. Your design team needs to darken certain text colors or lighten backgrounds. Often a brand color adjustment is involved.",
    hoursPerInstance: [0.25, 1],
    devDetailTemplate: 'Text fails 4.5:1 contrast ratio (WCAG 1.4.3 AA). Common failures: gray-on-white body copy, light text on brand color backgrounds.',
  },
  'link-name': {
    id:'link-name', risk:'medium',
    plain:'Some links have no description of where they go',
    who:'Screen reader users navigate by jumping between links. A link with no text or only an icon gives them no information about its destination or purpose.',
    fix:'Links need either visible text describing their destination, or a hidden label that screen readers can announce (such as "Download Q3 report PDF").',
    hoursPerInstance: [0.1, 0.3],
    devDetailTemplate: 'Links lack discernible text. WCAG 2.4.4 (A), 4.1.2 (A). Add aria-label or visually-hidden text inside the link.',
  },
  'button-name': {
    id:'button-name', risk:'medium',
    plain:'Some buttons have no label that assistive technology can read',
    who:'Screen reader users hear "button" with no indication of what it does — common with icon-only buttons like search, menu, or close icons.',
    fix:'Each icon-only button needs a hidden text label describing its action, such as "Open menu" or "Close dialog."',
    hoursPerInstance: [0.1, 0.3],
    devDetailTemplate: 'Buttons lack discernible text. WCAG 4.1.2 (A). Add aria-label to icon-only buttons.',
  },
  'label': {
    id:'labels', risk:'high',
    plain:'Your forms are unusable for customers with disabilities',
    who:'Screen reader users hear only the placeholder text inside a field — which disappears the moment they start typing. They cannot tell what information goes where. This commonly affects contact, checkout, and signup forms.',
    fix:'Each form field needs a permanent, visible label connected to it. This is a quick fix for most forms but may require layout changes if the design relies on placeholder-only labels.',
    hoursPerInstance: [0.25, 0.75],
    devDetailTemplate: 'Inputs lack programmatic label association. WCAG 1.3.1 (A), 4.1.2 (A). Requires <label for> or aria-labelledby on all inputs.',
  },
  'heading-order': {
    id:'headings', risk:'medium',
    plain:"Screen readers can't navigate your page structure",
    who:'Blind users navigate web pages by jumping between headings — like a table of contents. When headings are used for styling instead of structure, the page becomes disorienting and hard to use.',
    fix:'Your page headings are used for visual formatting rather than logical structure. A developer and content editor need to restructure the heading levels across your pages.',
    hoursPerInstance: [0.5, 1.5],
    devDetailTemplate: 'Skipped or non-sequential heading levels. WCAG 1.3.1 (A). Requires semantic restructuring separate from visual styling.',
  },
  'page-has-heading-one': {
    id:'h1', risk:'medium',
    plain:'Your page has no main title for navigation tools',
    who:'Without a primary heading, screen reader users and search engines have no clear sense of the page topic — affecting both accessibility and SEO.',
    fix:'Add a single, descriptive top-level heading (H1) to the page that summarizes its content.',
    hoursPerInstance: [0.25, 0.75],
    devDetailTemplate: 'Page is missing a level-one heading. WCAG 1.3.1 (A), 2.4.6 (AA).',
  },
  'html-has-lang': {
    id:'lang', risk:'medium',
    plain:'Screen readers may mispronounce your content',
    who:'Without a declared page language, screen readers may use the wrong pronunciation rules, voice, or Braille translation table for your content.',
    fix:"A single attribute needs to be added to your page's code declaring its language (e.g., English).",
    hoursPerInstance: [0.1, 0.25],
    devDetailTemplate: 'The lang attribute on the <html> element is missing or invalid. WCAG 3.1.1 (A).',
  },
  'document-title': {
    id:'doctitle', risk:'medium',
    plain:'Your browser tabs and bookmarks show no useful page title',
    who:'Screen reader users hear the page title first when a page loads — it tells them where they are. Search engines and browser tabs also rely on it.',
    fix:'Add a descriptive <title> to the page reflecting its content and purpose.',
    hoursPerInstance: [0.1, 0.25],
    devDetailTemplate: 'Document does not have a non-empty <title> element. WCAG 2.4.2 (A).',
  },
  'aria-allowed-attr': {
    id:'aria-attr', risk:'medium',
    plain:'Some interactive elements have conflicting accessibility instructions',
    who:'Assistive technology may behave unpredictably or ignore the element entirely when accessibility attributes conflict with the element type.',
    fix:'A developer needs to review and correct the accessibility attributes on the flagged elements.',
    hoursPerInstance: [0.25, 0.75],
    devDetailTemplate: 'Elements use ARIA attributes not allowed for their role. WCAG 4.1.2 (A).',
  },
  'aria-required-attr': {
    id:'aria-required', risk:'medium',
    plain:'Some custom controls are missing information assistive technology needs',
    who:'Screen readers cannot correctly announce the state or purpose of custom interactive elements (like custom dropdowns or sliders) without this information.',
    fix:'A developer needs to add the missing accessibility attributes to these custom components.',
    hoursPerInstance: [0.25, 1],
    devDetailTemplate: 'Required ARIA attributes are missing for the given role. WCAG 4.1.2 (A).',
  },
  'duplicate-id-active': {
    id:'dup-id', risk:'medium',
    plain:'Some interactive elements may not work consistently',
    who:'Duplicate IDs on interactive elements can cause assistive technology to interact with the wrong element, leading to unpredictable behavior.',
    fix:'A developer needs to ensure every interactive element on the page has a unique identifier.',
    hoursPerInstance: [0.25, 0.5],
    devDetailTemplate: 'Active elements share duplicate id attributes. WCAG 4.1.1 (A).',
  },
  'frame-title': {
    id:'frame-title', risk:'medium',
    plain:'Embedded content has no description for screen readers',
    who:'Embedded videos, maps, or widgets (iframes) with no title are announced as "frame" with no context, leaving users unsure what the content is.',
    fix:'Add a short, descriptive title attribute to each embedded frame describing its content (e.g., "Customer testimonial video").',
    hoursPerInstance: [0.1, 0.25],
    devDetailTemplate: 'Frames lack an accessible title attribute. WCAG 2.4.1 (A), 4.1.2 (A).',
  },
  'list': {
    id:'list-structure', risk:'low',
    plain:'Some lists on your page are not structured correctly',
    who:'Screen reader users rely on proper list structure to understand grouped content and navigate between items efficiently.',
    fix:'A developer needs to correct the underlying HTML so lists use proper list markup.',
    hoursPerInstance: [0.25, 0.5],
    devDetailTemplate: 'List items (<li>) are not contained within <ul> or <ol>. WCAG 1.3.1 (A).',
  },
  'meta-viewport': {
    id:'viewport', risk:'medium',
    plain:'Some users may not be able to zoom in on your site',
    who:'Users with low vision who need to zoom in to read content are blocked from doing so, making the site unusable for them.',
    fix:'Update the page configuration to allow users to zoom and resize text.',
    hoursPerInstance: [0.1, 0.25],
    devDetailTemplate: 'Viewport meta tag disables zoom (user-scalable=no or maximum-scale<2). WCAG 1.4.4 (AA).',
  },
}

// Fallback for any axe rule not explicitly mapped above
const DEFAULT_TEMPLATE = (rule) => ({
  id: rule.id,
  risk: rule.impact === 'critical' ? 'high' : rule.impact === 'serious' ? 'high' : rule.impact === 'moderate' ? 'medium' : 'low',
  plain: rule.help,
  who: rule.description,
  fix: 'Review the affected elements and apply the recommended fix from the linked accessibility guidance.',
  hoursPerInstance: [0.25, 1],
  devDetailTemplate: `${rule.id}. ${rule.helpUrl || ''}`,
})

const HOURLY_RATE = 150

function buildIssue(rule, nodeCount) {
  const template = RULE_MAP[rule.id] || DEFAULT_TEMPLATE(rule)
  const [hrLo, hrHi] = template.hoursPerInstance
  const totalHrLo = Math.max(0.5, +(hrLo * nodeCount).toFixed(1))
  const totalHrHi = Math.max(1,   +(hrHi * nodeCount).toFixed(1))
  return {
    id: template.id,
    risk: template.risk,
    plain: template.plain,
    who: template.who,
    fix: template.fix,
    count: nodeCount,
    effort: `${totalHrLo}–${totalHrHi} hours`,
    dollarMin: Math.round(totalHrLo * HOURLY_RATE),
    dollarMax: Math.round(totalHrHi * HOURLY_RATE),
    devDetail: template.devDetailTemplate,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'Missing url' })

  // Normalize URL
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try { new URL(url) } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  let browser
  try {
    const executablePath = await chromiumBinary.executablePath()

    browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath,
      headless: chromiumBinary.headless,
    })

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (compatible; Hex5ParityBot/1.0; +https://hex5digital.com/parity)',
    })
    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()

    await browser.close()

    const issues = axeResults.violations
      .map(v => buildIssue(v, v.nodes.length))
      // Merge duplicates if multiple axe rules map to the same plain-language issue
      .reduce((acc, issue) => {
        const existing = acc.find(a => a.id === issue.id)
        if (existing) {
          existing.count += issue.count
          existing.dollarMin += issue.dollarMin
          existing.dollarMax += issue.dollarMax
          const [eLo] = existing.effort.split('–')
          const [, iHi] = issue.effort.split('–')
          existing.effort = `${parseFloat(eLo)}–${parseFloat(existing.effort.split('–')[1]) + parseFloat(iHi)} hours`
        } else {
          acc.push(issue)
        }
        return acc
      }, [])
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.risk] - order[b.risk]
      })

    const critCount = issues.filter(i => i.risk === 'high').length
    const medCount  = issues.filter(i => i.risk === 'medium').length
    const score     = Math.max(0, 100 - critCount * 18 - medCount * 9)
    const totalDollarMin = issues.reduce((s,i) => s + i.dollarMin, 0)
    const totalDollarMax = issues.reduce((s,i) => s + i.dollarMax, 0)

    return res.status(200).json({
      ok: true,
      url,
      scannedAt: new Date().toISOString(),
      score,
      issues,
      totalDollarMin,
      totalDollarMax,
      passes: axeResults.passes.length,
      incomplete: axeResults.incomplete.length,
    })
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error('Scan error:', err)

    // Distinguish common failure modes for a better user-facing message
    if (err.message?.includes('timeout')) {
      return res.status(504).json({ error: 'timeout', message: 'The site took too long to respond.' })
    }
    if (err.message?.includes('ERR_NAME_NOT_RESOLVED') || err.message?.includes('net::')) {
      return res.status(400).json({ error: 'unreachable', message: "We couldn't reach that URL. Check it's correct and publicly accessible." })
    }
    return res.status(500).json({ error: 'scan_failed', message: 'Something went wrong while scanning. Please try again.' })
  }
}
