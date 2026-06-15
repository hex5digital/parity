// api/auth.js
// Google OAuth 2.0 for Hex5 Digital team members only.
// Restricts access to @hex5digital.com email addresses.
//
// Flow:
//   GET  /api/auth?action=login   → redirects to Google OAuth
//   GET  /api/auth?action=callback → handles Google callback, sets session cookie
//   GET  /api/auth?action=logout  → clears session cookie
//   GET  /api/auth?action=me      → returns current session user (or 401)
//
// Required env vars:
//   GOOGLE_CLIENT_ID      — from Google Cloud Console OAuth credentials
//   GOOGLE_CLIENT_SECRET  — from Google Cloud Console OAuth credentials
//   AUTH_SECRET           — random string for signing session tokens (32+ chars)
//   APP_URL               — e.g. https://parity.hex5digital.com

const ALLOWED_DOMAIN = 'hex5digital.com'
const SCOPES = 'openid email profile'

function getRedirectUri(req) {
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`
  return `${appUrl}/api/auth?action=callback`
}

// Simple HMAC-based token — avoids needing jsonwebtoken package
async function signToken(payload, secret) {
  const data = JSON.stringify(payload)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
  return Buffer.from(JSON.stringify({ data, sig: sigHex })).toString('base64url')
}

async function verifyToken(token, secret) {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, 'base64url').toString())
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    )
    const sigBytes = new Uint8Array(sig.match(/.{2}/g).map(h => parseInt(h, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!valid) return null
    const payload = JSON.parse(data)
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const { action } = req.query
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const authSecret   = process.env.AUTH_SECRET

  if (!clientId || !clientSecret || !authSecret) {
    return res.status(500).json({ error: 'Auth not configured' })
  }

  // ── GET /api/auth?action=me ──────────────────────────────────────
  if (action === 'me') {
    const cookie = req.headers.cookie || ''
    const match  = cookie.match(/parity_session=([^;]+)/)
    if (!match) return res.status(401).json({ user: null })
    const payload = await verifyToken(match[1], authSecret)
    if (!payload) return res.status(401).json({ user: null })
    return res.status(200).json({ user: payload.user })
  }

  // ── GET /api/auth?action=logout ──────────────────────────────────
  if (action === 'logout') {
    res.setHeader('Set-Cookie', 'parity_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax')
    return res.redirect(302, '/')
  }

  // ── GET /api/auth?action=login ───────────────────────────────────
  if (action === 'login') {
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  getRedirectUri(req),
      response_type: 'code',
      scope:         SCOPES,
      access_type:   'online',
      prompt:        'select_account',
    })
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  // ── GET /api/auth?action=callback ────────────────────────────────
  if (action === 'callback') {
    const { code, error: oauthError } = req.query

    if (oauthError) {
      return res.redirect(302, `/?auth_error=${encodeURIComponent(oauthError)}`)
    }

    if (!code) {
      return res.redirect(302, '/?auth_error=no_code')
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  getRedirectUri(req),
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      return res.redirect(302, '/?auth_error=token_exchange_failed')
    }

    const tokens = await tokenRes.json()

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userRes.ok) {
      return res.redirect(302, '/?auth_error=userinfo_failed')
    }

    const googleUser = await userRes.json()
    const email = googleUser.email || ''

    // Enforce domain restriction
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.redirect(302, `/?auth_error=unauthorized_domain`)
    }

    const user = {
      email,
      name:    googleUser.name || email,
      picture: googleUser.picture || null,
    }

    // Create session token (24h expiry)
    const token = await signToken(
      { user, exp: Date.now() + 24 * 60 * 60 * 1000 },
      authSecret
    )

    // Set httpOnly cookie
    res.setHeader('Set-Cookie',
      `parity_session=${token}; Path=/; Max-Age=${24*60*60}; HttpOnly; Secure; SameSite=Lax`
    )

    return res.redirect(302, '/')
  }

  return res.status(400).json({ error: 'Unknown action' })
}
