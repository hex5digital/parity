// api/crawl.js
// Discovers internal links from a URL using Browserless + Playwright.
// Returns up to MAX_PAGES unique same-domain URLs for the team full-site scanner.
// Requires valid session cookie (team members only).

import { chromium } from 'playwright-core'

const MAX_PAGES = 30

async function verifySession(req) {
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) return null
  const cookie = req.headers.cookie || ''
  const match  = cookie.match(/parity_session=([^;]+)/)
  if (!match) return null
  try {
    const { data, sig } = JSON.parse(Buffer.from(match[1], 'base64url').toString())
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(authSecret), { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    )
    const sigBytes = new Uint8Array(sig.match(/.{2}/g).map(h => parseInt(h, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!valid) return null
    const payload = JSON.parse(data)
    if (payload.exp && Date.now() > payload.exp) return null
    return payload.user
  } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await verifySession(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  let { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'Missing url' })
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  const browserlessToken = process.env.BROWSERLESS_TOKEN
  if (!browserlessToken) return res.status(500).json({ error: 'config_error' })

  let browser
  try {
    browser = await chromium.connectOverCDP(
      `wss://production-sfo.browserless.io?token=${browserlessToken}`,
      { timeout: 15000 }
    )

    const origin = new URL(url).origin
    const context = browser.contexts()[0] || await browser.newContext()
    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'load', timeout: 20000 })

    // Extract all same-domain links from the page
    const links = await page.evaluate((origin) => {
      const seen = new Set()
      const results = []
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
            href.startsWith('tel:') || href.startsWith('javascript:')) continue
        try {
          const abs = new URL(href, location.href).href
          if (!abs.startsWith(origin)) continue
          const clean = abs.split('#')[0].replace(/\/$/, '') || abs
          if (seen.has(clean)) continue
          seen.add(clean)
          const label = a.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) || clean
          results.push({ url: clean, label })
        } catch { continue }
      }
      return results
    }, origin)

    await browser.close()

    // Always include the root URL first
    const rootUrl = url.split('#')[0].replace(/\/$/, '') || url
    const allLinks = [
      { url: rootUrl, label: 'Homepage' },
      ...links.filter(l => l.url !== rootUrl)
    ].slice(0, MAX_PAGES)

    return res.status(200).json({ ok: true, links: allLinks, total: allLinks.length })

  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error('Crawl error:', err)

    const msg = err.message || ''
    let friendlyMessage = 'We couldn\'t crawl that site. Please check the URL and try again.'

    if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('ERR_CONNECTION_RESET')) {
      friendlyMessage = 'This site refused the connection — it may be blocking automated access. Try a different URL.'
    } else if (msg.includes('ERR_NAME_NOT_RESOLVED') || msg.includes('net::ERR_NAME')) {
      friendlyMessage = 'That domain couldn\'t be found. Check the URL for typos and try again.'
    } else if (msg.includes('ERR_SSL') || msg.includes('certificate')) {
      friendlyMessage = 'This site has an SSL/certificate issue that prevented access.'
    } else if (msg.includes('timeout') || msg.includes('Timeout')) {
      friendlyMessage = 'The site took too long to respond. It may be slow or blocking automated access.'
    } else if (msg.includes('403') || msg.includes('Forbidden')) {
      friendlyMessage = 'This site returned a 403 Forbidden — it\'s actively blocking automated scanners.'
    }

    return res.status(500).json({ error: 'crawl_failed', message: friendlyMessage })
  }
}
