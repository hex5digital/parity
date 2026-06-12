# Parity — Accessibility Auditor by Hex5 Digital

A real WCAG 2.2 AA / Section 508 auditor. Enter a URL, get a live
axe-core scan translated into plain-language findings — risk level,
who's affected, what it costs to fix — plus a branded PDF report
and lead capture via Resend.

---

## What changed: this is now a real scanner

Earlier versions of this tool used static sample data. Parity now runs
a genuine accessibility scan using **axe-core** — the same engine used
by Google Lighthouse, Microsoft Accessibility Insights, and most
enterprise accessibility tools — inside headless Chrome via Playwright.

When a user submits a URL:
1. `/api/scan` launches headless Chrome (via `@sparticuz/chromium`,
   a lightweight binary built for serverless environments)
2. Playwright loads the page
3. `@axe-core/playwright` runs a full WCAG 2.0/2.1/2.2 A & AA audit
4. Raw axe violations are mapped to plain-language findings with
   risk levels and cost estimates (see `RULE_MAP` in `api/scan.js`)
5. Results stream back to the browser and render in `<Results>`

---

## Deploy to production — free, ~30 minutes

### What you need before you start

- A computer (Mac, Windows, or Linux) with admin access to install software
- A free GitHub account — github.com/join
- A free Vercel account — vercel.com/signup (sign up using your GitHub account, it's the same login)
- A free Resend account — resend.com (for Step 5)
- Access to hex5digital.com's DNS settings (for the custom domain step — ask whoever manages your domain registrar/DNS if that's not you)

You do **not** need to know how to code to follow these steps —
just how to use a terminal/command prompt and copy-paste commands.

---

### Step 0a — Download and unzip the project

Download `parity-app.zip` (shared alongside this README) and unzip it.

- **Mac**: double-click the zip file — it extracts automatically into a `parity-app` folder
- **Windows**: right-click the zip file → "Extract All" → choose a location (e.g. Desktop) → this creates a `parity-app` folder
- **Linux**: `unzip parity-app.zip`

You should end up with a folder called `parity-app` containing
`package.json`, `src/`, `api/`, `public/`, `README.md`, etc.

Remember where this folder is — you'll need to open a terminal inside it.

---

### Step 0b — Install Node.js

The project needs **Node.js** (a JavaScript runtime) to install
dependencies and run locally. If you're not sure whether you have it:

**Check first:**
1. Open a terminal:
   - **Mac**: open the Terminal app (search "Terminal" in Spotlight)
   - **Windows**: open Command Prompt or PowerShell (search "cmd" or "PowerShell" in the Start menu)
   - **Linux**: open your terminal application
2. Type `node -v` and press Enter
3. If you see a version number like `v20.11.0`, skip to Step 0c
4. If you see "command not found" or similar, continue below

**Install Node.js:**
1. Go to nodejs.org
2. Download the **LTS** version (the button labeled "LTS" — not "Current")
3. Run the installer, click through with default options
4. Restart your terminal
5. Run `node -v` again to confirm it worked

---

### Step 0c — Open a terminal in the project folder

You need your terminal's "current directory" to be the `parity-app`
folder before running any commands.

**Mac/Linux:**
- Open Terminal
- Type `cd ` (with a trailing space) — don't press Enter yet
- Drag the `parity-app` folder from Finder into the Terminal window —
  this auto-fills the path
- Press Enter

**Windows:**
- Open the `parity-app` folder in File Explorer
- Click in the address bar at the top, type `cmd`, press Enter —
  this opens a Command Prompt already inside that folder

**Verify you're in the right place:**
Type `ls` (Mac/Linux) or `dir` (Windows) and press Enter. You should
see `package.json`, `src`, `api`, `public`, `README.md` listed. If
you don't see these, you're in the wrong folder — navigate to the
correct one before continuing.

---

### Step 0d — Install project dependencies

Still in that terminal, run:

```bash
npm install
```

This downloads all the libraries the project needs (React, Vite,
jsPDF, etc.) into a new folder called `node_modules`. This can take
1-3 minutes and will print a lot of text — that's normal. When it
finishes, you'll be back at a normal prompt with no errors in red.

If you see warnings (yellow text) — that's fine, ignore them.
If you see errors (red text, often ending in "npm ERR!") — copy
the error text and ask for help before continuing.

**Note:** the project includes a `.gitignore` file that tells Git
to skip the `node_modules` folder created by this step — it's large
(100+ MB) and gets regenerated automatically on Vercel, so it should
never be uploaded to GitHub.

---

### Step 0e — Run it locally to confirm it works

```bash
npm run dev
```

This starts a local development server. After a few seconds you'll
see something like:

```
  VITE v5.0.8  ready in 320 ms

  ➜  Local:   http://localhost:5173/
```

Open that URL (`http://localhost:5173/`) in your browser. You should
see the Parity landing page with the hero illustration and credentials
section.

**Note:** the "Check my site" button won't fully work yet in this
local environment — `/api/scan` and `/api/submit-lead` are Vercel
serverless functions that only run once deployed (or via `vercel dev`,
which is more advanced setup not covered here). Seeing the page render
correctly is enough confirmation to proceed.

Press `Ctrl+C` in the terminal to stop the local server before
continuing to Step 1.

---

### A note on the scan function

`api/scan.js` launches a full headless browser, which is heavier than
a typical serverless function. Two things make this work on Vercel's
free tier:

- `vercel.json` sets `maxDuration: 60` and `memory: 1769` for
  `api/scan.js` specifically (Hobby plan allows up to 60s / ~1.7GB
  on functions — this is within free limits, but cold starts can
  take 5-10 seconds the first time)
- `@sparticuz/chromium` provides a Chromium binary small enough to
  fit in Vercel's deployment size limits

If a site takes longer than 30 seconds to load, the scan will time
out gracefully and show an error with a retry button.

---

### Step 1 — Push to GitHub

You should still have your terminal open inside the `parity-app`
folder from Step 0c. If you closed it, reopen a terminal there
(repeat Step 0c) before continuing.

**Check if Git is installed:**

```bash
git -v
```

If you see a version number, skip ahead. If you see "command not
found":
- **Mac**: run `git -v` again — macOS will usually prompt you to
  install developer tools automatically. Click "Install" and wait.
- **Windows**: download and install Git from git-scm.com (default
  options are fine), then restart your terminal.
- **Linux**: run `sudo apt install git` (Ubuntu/Debian) or the
  equivalent for your distribution.

**Initialize the repository and commit:**

```bash
git init
git add .
git commit -m "Initial commit — Parity by Hex5 Digital"
```

If this is your first time using Git on this computer, it may ask
you to set your name and email first:

```bash
git config --global user.email "you@hex5digital.com"
git config --global user.name "Your Name"
```

Run those two lines (with your real info), then repeat the
`git init` / `git add` / `git commit` block above.

**Create the GitHub repository:**

1. Go to github.com and log in
2. Click the **+** icon (top right) → **New repository**
3. Name it `parity`
4. Leave it **Public** or **Private** — either works
5. Do **not** check "Add a README file" (you already have one)
6. Click **Create repository**

GitHub will show you a page with setup commands. Use these (replace
`YOUR_USERNAME` with your actual GitHub username — you'll see it in
the URL GitHub shows you):

```bash
git remote add origin https://github.com/YOUR_USERNAME/parity.git
git branch -M main
git push -u origin main
```

If this is your first time pushing to GitHub from this computer, it
may open a browser window asking you to log in and authorize — follow
those prompts, then the push will complete.

You can confirm it worked by refreshing the GitHub repository page —
you should see all your project files listed there.

---

### Step 2 — Deploy on Vercel

1. Go to vercel.com → Add New Project
2. Import your `parity` GitHub repo
3. Framework preset: **Vite**
4. Click **Deploy**

Vercel automatically detects both `/api` functions and applies the
settings in `vercel.json`. The `api/package.json` file tells Vercel
to install `playwright-core`, `@axe-core/playwright`, and
`@sparticuz/chromium` specifically for the scan function.

Your app is now live at `parity.vercel.app`. Try it — paste a real
URL and you'll see actual scan results in 10-30 seconds.

---

### Step 3 — Add your custom domain

To use `parity.hex5digital.com`:

1. In Vercel → your project → Settings → Domains
2. Add `parity.hex5digital.com`
3. Vercel gives you a CNAME value — add it in your DNS provider
   (wherever you manage hex5digital.com's DNS)
4. DNS propagates in 5–30 minutes

---

### Step 4 — Wire up Resend (email delivery)

1. Go to resend.com → sign up free
2. Domains → Add Domain → enter `hex5digital.com`
3. Add the DNS records Resend gives you (TXT + MX records)
4. Create an API key (Sending access)

Add environment variables in Vercel:
- Vercel → your project → Settings → Environment Variables
- Add `RESEND_API_KEY` = `re_xxxxxxxxxxxxxxxxxxxx`
- Add `NOTIFY_EMAIL`   = `accessibility@hex5digital.com` (or wherever you want lead alerts)

Redeploy once (Vercel → Deployments → Redeploy) and emails will start flowing.

---

### Step 5 — Add Parity to your nav

In your hex5digital.com navigation, paste this:

```html
<a href="https://parity.hex5digital.com"
   class="parity-cta"
   aria-label="Parity — free accessibility auditor by Hex5 Digital">
  <span aria-hidden="true" class="parity-dot"></span>
  Free Audit
</a>
```

CSS (add to your stylesheet):
```css
.parity-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: #0078BD;
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  text-decoration: none;
  border-left: 3px solid #470069;
}
.parity-cta:hover { background: #005f96; }
.parity-cta:focus-visible { outline: 3px solid #0078BD; outline-offset: 3px; }
.parity-dot { width: 7px; height: 7px; background: #fff; display: inline-block; }
```

---

## How it works end to end

1. User pastes a URL and clicks "Check my site"
2. Frontend posts to `/api/scan` with the URL
3. Serverless function launches headless Chrome, runs axe-core,
   maps violations to plain-language findings (`api/scan.js`)
4. Results return with a score (0-100), risk level, dollar range,
   and a list of findings sorted by risk
5. `<Results>` renders the three headline numbers, then each finding
   as an expandable card — plain-language summary first, technical
   detail behind a toggle
6. User clicks "Get the full report" → fills lead form
7. `generateAuditPDF()` builds a branded PDF client-side via jsPDF —
   cover page with score/risk/cost, detailed findings, a phased
   remediation roadmap, a methodology page, and a closing CTA
8. PDF downloads instantly to the user's device
9. Lead data posts to `/api/submit-lead` → Resend sends two emails:
   - Hex5 Digital gets a formatted lead notification with the scan results
   - The user gets a confirmation

---

## What the scan covers (and what it doesn't)

**Covers:** WCAG 2.0/2.1/2.2 Level A and AA automated checks via
axe-core — missing alt text, color contrast, form labels, heading
structure, ARIA usage, link/button names, language declaration,
viewport/zoom restrictions, and more. See `RULE_MAP` in `api/scan.js`
for the full mapping.

**Doesn't cover:** PDF/document accessibility, video captioning,
screen reader usability testing, cognitive accessibility, or any
issue requiring human judgment. Automated tools catch roughly
30-40% of real-world accessibility issues — this is stated
explicitly in the PDF report's methodology page.

---

## Extending the rule map

To add coverage for more axe-core rules, add an entry to `RULE_MAP`
in `api/scan.js`:

```js
'rule-id-from-axe': {
  id: 'short-id',
  risk: 'high' | 'medium' | 'low',
  plain: 'Plain-language headline',
  who: 'Who this affects and why it matters',
  fix: 'What needs to happen, in plain language',
  hoursPerInstance: [hoursLow, hoursHigh],
  devDetailTemplate: 'Technical detail with WCAG reference',
}
```

Any axe rule not in `RULE_MAP` falls back to `DEFAULT_TEMPLATE`,
which uses axe's own `help` and `description` text — functional
but less polished. Prioritize mapping the rules that fire most often.

---

## Cost breakdown

| Service  | Free tier                  | When you'd pay        |
|----------|-----------------------------|-----------------------|
| Vercel   | Hobby plan, 60s functions    | Pro plan ($20/mo) if you need >60s scans or higher concurrency |
| GitHub   | Unlimited repos              | Never                 |
| Resend   | 3,000 emails/month            | $20/mo after 3K leads |
| Domain   | Already own it               | —                     |

**Total monthly cost to start: $0**

If scan volume grows significantly, the main lever is Vercel's
function execution time/memory — the Hobby plan's 60s/1.7GB limit
on `api/scan.js` covers the vast majority of sites.

---

## File structure

```
parity-app/
  .gitignore              ← tells Git to skip node_modules, build output
  index.html              ← entry point
  vite.config.js          ← Vite config
  vercel.json             ← extends timeout/memory for the scan function
  package.json            ← frontend dependencies
  public/
    logo-white.png        ← Hex5 logo (white, for dark backgrounds)
    logo-dark.png         ← Hex5 logo (dark, for light backgrounds)
    hero-illustration.svg ← front page hero graphic
  src/
    main.jsx              ← React root
    App.jsx               ← full tool UI, calls /api/scan, renders results
    generatePDF.js         ← browser-side PDF generator (jsPDF)
    logoAssets.js          ← embedded base64 logos for PDF generation
  api/
    scan.js               ← runs axe-core scan via headless Chrome
    submit-lead.js        ← Vercel serverless function → Resend
    package.json          ← scan function dependencies (Playwright, axe-core, chromium)

  (after npm install, you'll also see:)
  node_modules/           ← downloaded dependencies (not in Git)
```
