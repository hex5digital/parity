// api/submit-lead.js
// Vercel serverless function — receives lead form data, sends
// notification to Hex5 Digital via Resend (free tier: 3,000/month).
//
// Setup:
//   1. Go to resend.com → create a free account
//   2. Add your sending domain (hex5digital.com) and verify DNS
//   3. Create an API key
//   4. In Vercel dashboard → Settings → Environment Variables:
//      Add RESEND_API_KEY = re_xxxxxxxxxxxx
//      Add NOTIFY_EMAIL   = your@hex5digital.com

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, email, company, role, phone, auditTarget, score, pdfBase64, pdfFilename, softLead } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!softLead && !company) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey    = process.env.RESEND_API_KEY
  const notifyTo  = process.env.NOTIFY_EMAIL || 'accessibility@hex5digital.com'

  if (!apiKey) {
    console.log('Lead received (no RESEND_API_KEY set):', { name, email, company, role, phone, auditTarget, score, softLead, hasPdf: !!pdfBase64 })
    return res.status(200).json({ ok: true, dev: true })
  }

  // Resend attachments expect base64 content without the data URI prefix
  const attachments = pdfBase64
    ? [{ filename: pdfFilename || 'Hex5-Parity-Audit.pdf', content: pdfBase64 }]
    : []

  try {
    // 1. Notify Hex5 Digital of the new lead
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Reach Auditor <reach@hex5digital.com>',
        to: [notifyTo],
        subject: softLead
          ? `Soft lead — ${name} requested report by email (${auditTarget || 'unknown site'})`
          : `New Reach lead — ${name} at ${company}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#19335A;padding:20px 24px;margin-bottom:24px">
              <h1 style="color:#fff;font-size:18px;margin:0">${softLead ? 'Soft Lead — Email Report Request' : 'New Reach Audit Lead'}</h1>
              <p style="color:#A8C4DC;font-size:12px;margin:4px 0 0">
                Submitted ${new Date().toLocaleString('en-US', { timeZone:'America/New_York' })} ET
              </p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${[
                ['Name',         name],
                ['Email',        email],
                ...(!softLead ? [
                  ['Company',    company],
                  ['Job title',  role || '—'],
                  ['Phone',      phone || '—'],
                ] : []),
                ['Audit target', auditTarget || '—'],
                ['Score',        score != null ? `${score}/100` : '—'],
              ].map(([label, value]) => `
                <tr>
                  <td style="padding:8px 12px;background:#E8EFF5;font-weight:600;
                    color:#19335A;width:120px;border-bottom:1px solid #B0BAC4">${label}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #B0BAC4;
                    color:#1F2937">${value}</td>
                </tr>
              `).join('')}
            </table>
            <div style="margin-top:24px;padding:16px 20px;
              background:#E8EFF5;border-left:3px solid #0078BD;font-size:13px;color:#19335A">
              ${softLead
                ? 'Soft lead — they opted to receive results by email rather than download the full report. Lower intent but worth a light follow-up.'
                : 'Follow up within 1 business day.'
              }
            </div>
          </div>
        `,
        attachments,
      }),
    })

    // 2. Send confirmation to the lead
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hex5 Digital <reach@hex5digital.com>',
        to: [email],
        reply_to: notifyTo,
        subject: 'Your accessibility audit report from Hex5 Digital',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#19335A;padding:20px 24px;margin-bottom:24px">
              <h1 style="color:#fff;font-size:18px;margin:0">Your report is ready</h1>
              <p style="color:#A8C4DC;font-size:12px;margin:4px 0 0">
                Reach — Accessibility Auditor by Hex5 Digital
              </p>
            </div>
            <p style="font-size:14px;color:#1F2937;line-height:1.7">
              Hi ${name},
            </p>
            <p style="font-size:14px;color:#1F2937;line-height:1.7">
              Thank you for using Reach. Your branded PDF accessibility audit report
              for <strong>${auditTarget || 'your site'}</strong> has been downloaded directly
              to your device.
            </p>
            <p style="font-size:14px;color:#1F2937;line-height:1.7">
              A Hex5 Digital accessibility specialist will review your results and
              may reach out within 1 business day to discuss remediation options.
            </p>
            <div style="margin:24px 0;padding:16px 20px;
              background:#E8EFF5;border-left:3px solid #0078BD">
              <p style="font-size:13px;color:#19335A;margin:0;font-weight:600">
                Questions? Reply to this email or contact us at
                <a href="mailto:accessibility@hex5digital.com"
                  style="color:#0078BD">accessibility@hex5digital.com</a>
              </p>
            </div>
            <p style="font-size:12px;color:#6B7280;margin-top:32px">
              Hex5 Digital · hex5digital.com<br/>
              You are receiving this because you submitted the Reach audit form.
              Your information is never sold.
            </p>
          </div>
        `,
      }),
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Email delivery failed' })
  }
}
