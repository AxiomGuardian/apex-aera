# APEX Design Bible — Public Marketing Website (apexera.com)
### For Mitchell — Copy this entire document as your first message in a new Claude project.

---

> **Context for Claude:** You are helping build the public marketing website for APEX (apexera.com). APEX is a premium AI-powered brand intelligence agency. Their private client dashboard already exists and is built in Next.js 15 with a deeply considered design system. This document is the complete source of truth for the public website. Every decision here has been made deliberately to reflect APEX's positioning: sophisticated, precise, humble, excellent. Build with that same spirit.

---

## Section 1 — Overall Brand Direction & Aesthetic

### The Core Idea

APEX operates at the intersection of intelligence and taste. The visual language must communicate both: dark, spacious, and controlled — like a high-end instrument rather than a loud advertisement. Think Vercel's website, Linear's dashboard, and Apple's keynote slides — but warmer, more human, and purposefully calm.

Everything must feel like it was made with intention. No noise. No decoration for decoration's sake. Every element earns its place.

---

### Color System (Exact Values — Copy Directly)

These are the canonical tokens used in the private dashboard. The public website must use the same values so the brand feels like one continuous experience from first impression to client login.

```css
/* ── Backgrounds — deep warm black, not cold ── */
--bg:          #0d0d0d;   /* Page background */
--bg-deep:     #080808;   /* Deepest sections, sidebars, hero overlay */
--bg-raised:   #101010;   /* Slightly elevated panels */

/* ── Surfaces — layered depth system ── */
--surface:     #161616;   /* Cards, primary panels */
--surface-2:   #1d1d1d;   /* Secondary surfaces, input backgrounds */
--surface-3:   #252525;   /* Hover states, chips */
--surface-4:   #2e2e2e;   /* Active states, highest surface */

/* ── Typography — clean white hierarchy ── */
--text:        #f4f4f4;   /* Headlines, primary copy */
--text-2:      #e8e8e8;   /* Body text */
--text-3:      #d0d0d0;   /* Secondary body */
--text-4:      #a3a3a3;   /* Labels, captions */
--text-5:      #737373;   /* Subtle labels, eyebrows */
--text-6:      #525252;   /* Placeholder, timestamps */

/* ── APEX Cyan — the brand accent, from the logo ── */
--cyan:          #2DD4FF;               /* Primary accent — buttons, links, highlights */
--cyan-bright:   #7EEEFF;               /* Hairlines, decorative dots, thin accents */
--cyan-display:  #52DFFF;               /* Large display text accents */
--cyan-dim:      rgba(45, 212, 255, 0.55);
--cyan-subtle:   rgba(45, 212, 255, 0.08);  /* Hover fills, card tints */
--cyan-border:   rgba(45, 212, 255, 0.18);  /* Highlighted borders */
--cyan-glow:     rgba(45, 212, 255, 0.12);  /* Glow effects, shadows */

/* ── Silver accent — metallic refinement ── */
--silver:      #c4c4c4;
--silver-2:    #909090;
--silver-dim:  rgba(196, 196, 196, 0.45);

/* ── Borders — barely there, always intentional ── */
--border:      rgba(255, 255, 255, 0.08);   /* Default — almost invisible */
--border-mid:  rgba(255, 255, 255, 0.14);   /* Hover, emphasis */
--border-high: rgba(255, 255, 255, 0.26);   /* Active, selected */

/* ── Hover fills — always subtle, never jarring ── */
--hover-fill:      rgba(255, 255, 255, 0.04);
--hover-fill-cyan: rgba(45, 212, 255, 0.038);

/* ── Shadows — depth without heaviness ── */
--shadow-card:        0 1px 3px rgba(0,0,0,0.55), 0 4px 24px rgba(0,0,0,0.40);
--shadow-card-hover:  0 1px 3px rgba(0,0,0,0.55), 0 10px 40px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.08);
--shadow-lg:          0 20px 64px rgba(0,0,0,0.65), 0 6px 20px rgba(0,0,0,0.45);
--shadow-cyan:        0 0 28px rgba(45,212,255,0.10), 0 4px 20px rgba(0,0,0,0.40);
--shadow-inset-top:   inset 0 1px 0 rgba(255,255,255,0.05);

/* ── Border radius scale ── */
--r-xs:  4px;
--r-sm:  6px;
--r-md:  10px;
--r-lg:  14px;
--r-xl:  20px;
--r-2xl: 28px;
```

**Why these choices:**

- **Deep warm black (#0d0d0d, not #000000):** Pure black feels harsh and flat on screens. A slightly warm near-black creates depth and is easier on the eyes during extended reading — it communicates premium without aggression.
- **Cyan (#2DD4FF):** This comes directly from the APEX logo. It is the single accent color — used sparingly so it always signals "this matters." It is bright enough to read at any size but not so electric that it feels cheap or gaming-oriented.
- **Silver:** The secondary metallic tone that makes the wireframe orb geometry feel precious and refined. Think brushed aluminum rather than chrome.
- **Ultra-subtle borders:** Borders at 8% white opacity are visible enough to define structure but never create a "cage" feeling. The UI breathes.
- **Layered surfaces:** The 6-step surface system ($080808 → #2e2e2e) creates depth without needing heavy shadows everywhere. It's how high-end software like Figma and Linear achieve their clean depth.

---

### Typography

**Font family:**
```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Use the system font stack. On macOS this renders as San Francisco — one of the finest screen typefaces ever made. On Windows it renders as Segoe UI. This is intentional: it matches what clients see in their operating system, creating an immediate sense of trustworthiness and precision. No web font licensing risk, no flash of unstyled text, zero performance cost.

If you want to upgrade to a purchased typeface later, **Inter** is the closest match and the most appropriate choice for this brand.

**Typography hierarchy — exact rules:**

```css
/* Display headlines — hero, section titles */
font-size: clamp(48px, 6vw, 88px);
font-weight: 700;
letter-spacing: -0.04em;   /* tight tracking — premium, editorial */
line-height: 1;             /* or 1.05 for multi-line */
color: #f4f4f4;

/* Section subheadlines */
font-size: clamp(24px, 3vw, 36px);
font-weight: 600;
letter-spacing: -0.03em;
line-height: 1.15;

/* Body copy */
font-size: 15px;            /* 15px base, not 16px — tighter, more refined */
font-weight: 400;
letter-spacing: -0.003em;
line-height: 1.72;          /* generous — gives prose room to breathe */
color: #d0d0d0;             /* text-3, not full white — reduces eye strain */

/* Eyebrow / overline labels (above section titles) */
font-size: 10px;
font-weight: 600;
letter-spacing: 0.16em;     /* wide tracking for small text — makes it readable */
text-transform: uppercase;
color: #737373;             /* text-5 */

/* Metric values / KPI display numbers */
font-size: clamp(36px, 5vw, 56px);
font-weight: 700;
letter-spacing: -0.04em;
font-feature-settings: "tnum";   /* tabular numbers — they align perfectly */
color: #f4f4f4;

/* Caption / footnote */
font-size: 11px;
color: #525252;             /* text-6 */
letter-spacing: 0.02em;
```

**CSS utilities to include in globals.css:**
```css
.heading-display {
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
  font-feature-settings: "ss01", "cv01";
}

.label-eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-5);
}

.value-display {
  font-size: 42px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--text);
  font-feature-settings: "tnum";
}

/* Gradient cyan text — for key phrases or metric highlights */
.text-apex-cyan {
  background: linear-gradient(135deg, #7EEEFF 0%, #2DD4FF 60%, rgba(45,212,255,0.55) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

### Spacing, Padding & Depth Rules

Think of spacing as breathing room for intelligence. APEX never crowds. Every section gets generous vertical space, and elements within sections never feel stacked.

```
Section vertical padding:  120px–160px (desktop), 72px–96px (mobile)
Container max-width:       1180px with auto horizontal margins
Card padding:              26px 24px (desktop), 20px 18px (mobile)
Grid gutter:               20px–24px
Component internal gap:    8px–16px
```

**The depth system:**
- Background (#0d0d0d) is the floor
- Cards (#161616) float 1 level above
- Hover/active states (#1d1d1d → #252525) are 2 levels above
- Use `box-shadow: var(--shadow-card)` on all card surfaces
- Use `box-shadow: var(--shadow-card-hover)` on hover — never use `scale()` for lift; shadow is more refined

---

### Hover Behaviors & Transitions

```css
/* Standard transition — all interactive elements */
transition: background 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.18s ease;

/* Slower, more cinematic — for large hero elements */
transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);

/* Entrance animations — staggered fade up */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); filter: blur(5px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0);   }
}
.animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Stagger delays — for card grids */
.delay-100 { animation-delay: 0.10s; }
.delay-200 { animation-delay: 0.20s; }
.delay-300 { animation-delay: 0.30s; }
.delay-400 { animation-delay: 0.40s; }
```

**Rules:**
- Hover never uses `transform: scale()` on full cards — it's too abrupt
- Color and shadow changes only — the element stays in place, the light around it changes
- Never use `transition: all` in production — specify only the properties you are changing
- CTA buttons are the one exception: a subtle `translateY(-1px)` on hover is acceptable

---

## Section 2 — APEX Logo Usage & Treatment

### The Mark

The APEX geometric "A" is a triangle with:
- A horizontal crossbar (the classic A structure)
- A **cyan dot** at the apex point — this is the defining detail, representing the intelligence vertex
- A **faint secondary glow ring** around the dot

The triangle strokes are thin (1–1.5px equivalent in SVG), white at ~90% opacity. The inner triangle ghost strokes are 20–25% opacity. The cyan dot is full #2DD4FF with a soft bloom.

**SVG reference (from the dashboard — use this exactly):**
```svg
<svg viewBox="0 0 64 64" fill="none">
  <!-- Outer triangle -->
  <path d="M32 6L58 56H6L32 6Z"
    stroke="#f4f4f4" stroke-width="1.5" stroke-linejoin="round" fill="none" opacity="0.9" />
  <!-- Crossbar -->
  <path d="M18 40H46"
    stroke="#f4f4f4" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
  <!-- Inner ghost strokes -->
  <path d="M32 20L42 40" stroke="#f4f4f4" stroke-width="1.2" stroke-linecap="round" opacity="0.25" />
  <path d="M32 20L22 40" stroke="#f4f4f4" stroke-width="1.2" stroke-linecap="round" opacity="0.25" />
  <!-- The apex dot — always cyan, always present -->
  <circle cx="32" cy="6" r="2" fill="#2DD4FF" opacity="1" />
  <circle cx="32" cy="6" r="5" fill="#2DD4FF" opacity="0.12" />
</svg>
```

### Sizing

| Context | Mark size | Full logo |
|---|---|---|
| Navbar (desktop) | 28–32px | Mark + "APEX" wordmark at 14px |
| Navbar (mobile) | 24px | Mark only |
| Hero section | 64–80px | Mark + full name |
| Footer | 32px | Mark + name |
| Favicon | 32×32px | Mark only |

### Treatment Rules

1. **Never stretch or distort** the triangle proportions
2. **Always keep the cyan apex dot** — it is the soul of the mark. Removing it for "simplicity" destroys the brand signal
3. **On dark backgrounds:** White strokes, cyan dot — exact as above
4. **On light backgrounds:** Use #0d0d0d strokes, keep cyan dot
5. **Minimum clear space:** Equal to the height of the crossbar (roughly 25% of the mark height) on all sides
6. **3D treatment in hero:** The mark can be rendered in Three.js with the icosahedron wireframe behind it (see Section 5) — this should only appear in the hero, not throughout the site

**Why consistency matters here:** The private dashboard client logs in and sees this exact mark. If the public website uses a different treatment, the brand trust built during onboarding breaks. The mark must feel like the same instrument in both contexts — just different applications of the same precision.

---

## Section 3 — Core Messaging Pillars & Voice-Locked Tone

### Brand Voice: Precise, Humble, Earned

APEX speaks like the world's most capable colleague who never brags. Every claim is backed by specificity. No superlatives without evidence. No hype language. The voice reflects Christ-centered values: excellence in craft, integrity in claims, genuine service to clients.

**The test for every sentence:** Would a quietly confident expert say this? Or does it sound like a pitch deck trying to impress?

If it sounds like a pitch deck, rewrite it.

---

### Tone Examples

**❌ Wrong (hype, vague, generic):**
> "We leverage cutting-edge AI to supercharge your brand and unlock explosive growth."

**✅ Right (specific, earned, precise):**
> "AERA processes your brand's voice architecture and produces campaign-ready content at 3–5× your current velocity — without touching your tone."

---

**❌ Wrong:**
> "The future of marketing is here."

**✅ Right:**
> "Most brands produce three to five pieces of content per week. APEX clients maintain fifteen to twenty — with higher brand consistency scores than they had before."

---

**❌ Wrong:**
> "Our AI is revolutionary."

**✅ Right:**
> "AERA is trained on your brand specifically. It doesn't sound like AI. It sounds like you — on your best day."

---

### Key Positioning Statements (Use These Exactly)

These have been refined deliberately. Use them verbatim or as close anchors.

```
"AERA is your always-on brand intelligence layer."

"3–5× content velocity. Zero brand drift."

"AERA doesn't replace your team. It removes the ceiling on what your team can produce."

"Built for brands that refuse to compromise on taste."

"The private intelligence layer for APEX clients."

"Your brand voice, preserved perfectly — at scale."

"Not more content. Better content, faster."

"Every output is reviewed against your brand voice architecture before it reaches you."

"APEX clients don't post more. They post better, and more often."
```

### Messaging Pillars

1. **Speed without sacrifice** — Content velocity goes up. Brand quality does not come down. These are not a trade-off at APEX.
2. **Intelligence that sounds human** — AERA is trained on the client's specific brand, not generic AI output.
3. **Precision over volume** — We are selective. This is not for every brand. Only those committed to excellence.
4. **Partnership, not software** — APEX is a relationship. AERA is the tool. The team is the partner.

### Why the Tone Must Stay Humble

Hype creates skepticism. Precision creates trust. A brand that says "we are the best" makes the visitor work to believe it. A brand that says "here is what our clients produce, here is how we do it, here is who it is for" does the work for them. This reflects our integrity — we do not overclaim. We show. The tone is an act of respect for the visitor's intelligence.

---

## Section 4 — Website Structure & Funnel Flow

This is a "yes ladder" — each section resolves a question the visitor is already asking, then earns their attention for the next one.

---

### Section Order

```
1. Navigation
2. Hero
3. The Problem
4. The APEX Difference (Introduce AERA)
5. How AERA Works
6. Real Results
7. Who This Is For
8. Ready to Begin? (CTA)
9. Footer
```

---

### 1. Navigation

**Purpose:** Instant orientation. Trust signal. Entry point.

**Layout:** Fixed top bar, full-width, blurred dark background (`backdrop-filter: blur(20px); background: rgba(13,13,13,0.85);`). Left: APEX mark + wordmark. Center (desktop): Nav links — About, How It Works, Results, For Brands. Right: "Request Access" CTA button (cyan, small).

**Rules:**
- Navigation is not a menu — it is a signal that this is a professional environment
- No hamburger animations or fancy transitions — clean slide-down for mobile
- The "Request Access" button in the nav is always visible on desktop. On mobile, it lives in the drawer.
- Border bottom: `1px solid rgba(255,255,255,0.07)` — barely visible

**Why it exists:** The first 2 seconds of a visit determine whether someone stays. A clean, confident nav communicates "you are in the right place" before a word is read.

---

### 2. Hero

**Purpose:** Bold statement of what APEX is. Establish the visual identity immediately. Create emotional resonance.

**Layout:** Full viewport height. Dark background with layered radial gradients. The APEX geometric A or the 3D orb centered or right-aligned. Headline left or centered. One subheadline. Two CTAs.

**Copy structure:**
```
[Eyebrow — tiny, tracking wide]
APEX Intelligence Layer

[Headline — large, tight]
Your brand at
3× velocity.
Zero compromise.

[Sub]
AERA is the private AI intelligence layer for brands
that refuse to trade speed for taste.

[CTAs]
[Primary] Request Access    [Secondary] See How It Works
```

**Visual elements:**
- Layered radial gradients (subtle cyan bloom at center)
- Faint grid overlay (white 2.5% opacity, 56px × 56px)
- Animated rings around the mark (slow spin, 24s period)
- Orbiting cyan dot

**Why it exists:** The hero must answer three questions in under 4 seconds: What is this? Is it for me? Do I trust it? The headline handles what. The visual handles trust. The sub handles "is it for me."

---

### 3. The Problem

**Purpose:** Create resonance. Make the visitor feel understood before you offer anything.

**Copy structure:**
```
[Eyebrow]
The Challenge

[Headline]
Great brands are drowning
in content demands.

[Body]
Your team is talented. Your brand standards are high.
But the volume required to compete today — across channels,
formats, and audiences — is unsustainable at that standard.

Something has to give. Usually, it's the brand.

[3 problem cards]
• Volume pressure forces shortcuts
• AI tools sound generic — off-brand
• Strategy and execution compete for the same hours
```

**Why it exists:** Nobody buys a solution before they feel their problem is understood. This section does not mention APEX. It simply reflects the visitor's reality. The silence where the solution would go creates the pull toward the next section.

---

### 4. The APEX Difference — Introducing AERA

**Purpose:** Introduce AERA as the answer. Position it as intelligence, not just software.

**Copy structure:**
```
[Eyebrow]
The APEX Intelligence Layer

[Headline]
Meet AERA.

[Sub]
AERA is not a content tool. It is your brand's
private intelligence layer — trained on your voice,
your positioning, and your standards.

[Feature points — 3 or 4]
• Trained specifically on your brand — not generic AI
• Produces at 3–5× velocity without touching your tone
• Always on, watching every signal, recommending next moves
• Every output reviewed against your brand architecture

[Visual]
The 3D orb or a clean dashboard preview (screenshot or recreation)
```

**Why it exists:** After the problem, the visitor is primed for relief. This section provides it — but with precision, not hype. The name "AERA" is introduced here for the first time and should feel like meeting someone, not installing software.

---

### 5. How AERA Works

**Purpose:** Demystify the process. Build confidence. Remove anxiety about "AI."

**Copy structure:**
```
[Eyebrow]
The Process

[Headline]
Intelligence built
specifically for your brand.

[3-step flow]

Step 1 — Brand Architecture
We work with your team to capture voice, tone,
positioning, and standards. This becomes AERA's foundation.

Step 2 — Intelligence Layer Active
AERA monitors performance signals, audience behavior,
and competitive landscape — continuously.

Step 3 — Campaign-Ready Output
Briefs, content, strategy recommendations, and performance
insights delivered inside your private dashboard.
```

**Why it exists:** "AI" is a scary word for many brand leaders. They worry about sounding generic. This section shows the human process behind the tool — reassuring them that APEX is a partnership, not a vending machine.

---

### 6. Real Results

**Purpose:** Social proof through specificity. Numbers, not adjectives.

**Layout:** Full-width dark section. Metric cards (same style as dashboard KPI cards). Optional: 1–2 brief client quotes in clean pull-quote format.

**Metric card examples:**
```
4.2×    Content Velocity
        vs. baseline, sustained

94%     Brand Consistency Score
        Across all AERA-produced outputs

+38%    Email Open Rate
        Q2 2026 campaign average

$18     CPA
        Down from $47 pre-APEX
```

**Why it exists:** Claims need evidence. These numbers are specific enough to be credible and modest enough to be believable. Avoid round numbers (100%, 10×) — they read as invented. Specific numbers (94%, 4.2×) read as measured.

---

### 7. Who This Is For

**Purpose:** Qualify the visitor. APEX is not for everyone — saying so is a trust signal.

**Copy structure:**
```
[Eyebrow]
Is APEX Right for You?

[Headline]
Built for brands that
take their voice seriously.

[Right-fit signals — left column]
✓ You have clear brand standards and refuse to compromise them
✓ You need to scale content output without losing quality
✓ Your team is already strong — you need leverage, not replacement
✓ You understand that great brand work compounds over time

[Not-right signals — right column, lighter treatment]
— You're looking for cheap, fast, generic content
— You don't have existing brand direction to build from
— You want a fully automated solution with no partnership
```

**Why it exists:** Exclusivity, when stated with humility, creates desire. Saying "this is not for everyone" tells the right visitor: "this was made for me." It also filters out poor-fit inquiries, which protects the team's time and the clients' experience.

---

### 8. Ready to Begin? (CTA Section)

**Purpose:** Convert the visitor who has traveled this far.

**Copy structure:**
```
[Eyebrow]
Begin

[Headline]
Ready to see what
your brand can become?

[Sub]
Request access. We review every application personally
and respond within 48 hours.

[CTA — large, prominent]
Request Access →

[Beneath the button — no pressure]
No commitment required. We'll have a real conversation
about your brand and whether APEX is the right fit.
```

**Why it exists:** After 7 sections of building understanding and trust, the visitor who reaches here is warm. The CTA must feel like a door opening, not a wall with a form. The "no commitment" line removes the last friction point.

---

### 9. Footer

**Layout:** Dark background (#080808). APEX mark + tagline left. Navigation links center. Contact/social right. Bottom: legal micro-text.

**Tagline for footer:**
> "Intelligence that protects your brand."

---

## Section 5 — Component Examples & Visual References

### Hero Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Nav: APEX mark]              [About] [How] [Results]  │
│                                             [Request →]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  APEX INTELLIGENCE LAYER          ╭─────────────────╮  │
│  ─────────────────────            │  [3D Orb or     │  │
│                                   │   APEX mark     │  │
│  Your brand at                    │   with rings]   │  │
│  3× velocity.                     ╰─────────────────╯  │
│  Zero compromise.                                       │
│                                                         │
│  AERA is the private AI intelligence                    │
│  layer for brands that refuse to trade                  │
│  speed for taste.                                       │
│                                                         │
│  [Request Access →]  [See How It Works]                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Background treatment:**
```css
background: #080808;
/* Cyan bloom — centered, subtle */
background-image:
  radial-gradient(ellipse 60% 70% at 60% 45%, rgba(45,212,255,0.055) 0%, transparent 65%),
  radial-gradient(ellipse 100% 60% at 50% 110%, rgba(45,212,255,0.03) 0%, transparent 55%);

/* Grid overlay */
background-image:
  linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
background-size: 56px 56px;
mask-image: radial-gradient(ellipse 80% 85% at 50% 50%, black 10%, transparent 75%);
```

---

### Metric / Result Cards

Mirror the dashboard KPI cards exactly. These are the most important trust-building components on the page.

```css
/* Card */
background: #161616;
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
padding: 26px 24px 24px;
box-shadow: 0 1px 3px rgba(0,0,0,0.55), 0 4px 24px rgba(0,0,0,0.40);
transition: background 0.25s, box-shadow 0.25s, border-color 0.25s;

/* Card hover */
background: rgba(45,212,255,0.038);
border-color: rgba(45,212,255,0.12);
box-shadow: 0 1px 3px rgba(0,0,0,0.55), 0 10px 40px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.08);

/* Top cyan edge hairline — appears on hover */
position: absolute; top: 0; left: 24px; right: 24px; height: 1px;
background: linear-gradient(90deg, transparent, rgba(45,212,255,0.32), transparent);
opacity: 0 → 1 on hover;

/* Metric value */
font-size: clamp(32px, 4vw, 40px);
font-weight: 700;
letter-spacing: -0.04em;
color: #f4f4f4;
font-feature-settings: "tnum";

/* Delta badge */
font-size: 10px;
color: #2DD4FF;
background: rgba(45,212,255,0.07);
border: 1px solid rgba(45,212,255,0.14);
border-radius: 999px;
padding: 2px 8px;
```

---

### Buttons & CTAs

**Primary CTA (cyan — for main conversion actions):**
```css
background: #2DD4FF;
color: #000000;
font-size: 13px;
font-weight: 600;
letter-spacing: 0.01em;
padding: 10px 20px;
border-radius: 10px;
border: none;
cursor: pointer;
transition: box-shadow 0.2s, opacity 0.15s;

/* Hover */
box-shadow: 0 0 20px rgba(45,212,255,0.35);
opacity: 0.92;
```

**Secondary / Outline (ghost — for secondary actions):**
```css
background: transparent;
color: #f4f4f4;
border: 1px solid rgba(255,255,255,0.14);
font-size: 13px;
font-weight: 500;
padding: 9px 19px;
border-radius: 10px;

/* Hover */
border-color: rgba(255,255,255,0.26);
background: rgba(255,255,255,0.04);
color: #f4f4f4;
```

**Ghost / Text button (for low-emphasis actions):**
```css
background: transparent;
border: none;
color: #737373;
font-size: 13px;

/* Hover */
color: #d0d0d0;
```

---

### Navigation Style

```css
/* Nav bar */
position: fixed;
top: 0; left: 0; right: 0;
height: 56px;
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: rgba(13, 13, 13, 0.85);
border-bottom: 1px solid rgba(255,255,255,0.07);
z-index: 100;

/* Nav links */
font-size: 13px;
font-weight: 450;
color: #737373;
letter-spacing: 0.01em;
transition: color 0.15s;

/* Nav link hover */
color: #f4f4f4;

/* Active nav link */
color: #f4f4f4;
```

---

### Section Label / Eyebrow

Use the `.section-label` pattern from the dashboard — a left cyan hairline before the eyebrow text:

```css
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #737373;
}

.section-label::before {
  content: '';
  display: block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #2DD4FF, rgba(45,212,255,0.3));
  opacity: 0.6;
  flex-shrink: 0;
}
```

---

### 3D Element Usage

The Three.js orb (React Three Fiber, icosahedron wireframe) should appear in **one place only on the public site** — the hero. It is a statement piece, not a decoration.

**Orb geometry:**
- Outer shell: `IcosahedronGeometry(1.25, 1)` — cyan wireframe, slow rotation, 9s breath cycle
- Mid shell: `IcosahedronGeometry(0.88, 1)` — silver/white wireframe, counter-rotation
- Inner core: `IcosahedronGeometry(0.52, 0)` — white wireframe, tight pulse
- Equatorial ring: `TorusGeometry(1.55, 0.007, 3, 90)` — cyan, slow drift
- Ambient cyan PointLight at `[2, 2, 2]`, intensity ~3.2, color #2DD4FF

**CSS companion:** A breathing ring behind the orb (CSS, not Three.js):
```css
@keyframes orbRingBreath {
  0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
  50%       { opacity: 0.75; transform: translate(-50%, -50%) scale(1.06); }
}
.animate-orb-ring {
  animation: orbRingBreath 5s ease-in-out infinite;
}
```

If Three.js adds complexity in the initial build, use the SVG APEX mark with CSS ring animations as a fallback — it is nearly as effective and far simpler to ship.

---

### Dividers

Never use heavy horizontal rules. Use these instead:

```css
/* Fade divider — elegant section separator */
.divider-fade {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  margin: 0 auto;
}

/* Cyan hairline — for section entry points */
.divider-cyan {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(45,212,255,0.18), transparent);
  width: 60%;
  margin: 0 auto;
}
```

---

## Section 6 — Technical Stack

```
Framework:     Next.js 15 (App Router)
Language:      TypeScript (strict mode)
Styling:       Tailwind CSS v4 (CSS-first, @import "tailwindcss")
Components:    shadcn/ui (unstyled primitives, APEX-themed)
3D:            React Three Fiber + @react-three/drei
Animation:     Framer Motion (page transitions, component entrances)
Fonts:         System font stack (no web font dependency)
Icons:         Lucide React
```

**Why the exact same stack as the dashboard:**

This is not a preference — it is a strategic decision.

1. **Shared design tokens:** The CSS custom properties (`--cyan`, `--surface`, `--text-5`, etc.) can be copied verbatim from the dashboard's `globals.css` into the public site. There is no translation layer, no risk of color drift.
2. **Shared component patterns:** Buttons, cards, inputs, and layout primitives built once in either project can be migrated to the other with zero rework.
3. **Developer context switching:** When the same developer works across both projects, they never have to shift mental models. The same patterns, same naming, same file structure.
4. **Future monorepo:** If APEX ever moves to a monorepo (shared `packages/ui`), this stack makes that trivial.
5. **TypeScript:** Prevents entire classes of runtime bugs. Worth the setup cost.

**Tailwind configuration note:** Use Tailwind v4 CSS-first import:
```css
@import "tailwindcss";
```
No `tailwind.config.js` needed. Define your design tokens in CSS custom properties and extend Tailwind via `@theme inline {}` in globals.css.

---

## Section 7 — Final Guardrails

### The Single Most Important Rule

**The public website and the private dashboard must feel like they were designed on the same day, by the same person, for the same client.**

A visitor who books a call after seeing the website, then logs into the client dashboard for the first time, should feel: "This is exactly what I expected." Not "Oh — the dashboard looks different." That continuity is the brand experience.

---

### Guardrails Checklist

**Visual:**
- [ ] Background is #0d0d0d (not pure black, not grey, not dark blue)
- [ ] Cyan accent is exactly #2DD4FF — no approximations
- [ ] Borders are never more than rgba(255,255,255,0.14) in standard state
- [ ] Body text is never pure white — use #d0d0d0 or #e8e8e8 for paragraphs
- [ ] Cards use the exact shadow values from this document
- [ ] No more than one primary CTA per section
- [ ] Animations are subtle — never call attention to themselves
- [ ] The APEX mark always has the cyan apex dot

**Tonal:**
- [ ] No superlatives without specific evidence
- [ ] No phrase: "cutting-edge," "revolutionary," "game-changing," "unleash," "supercharge"
- [ ] Every metric is specific (4.2×, not "4×+")
- [ ] The word "partnership" appears — this is not SaaS, it is a relationship
- [ ] AERA is always introduced as an intelligence layer, not a "tool" or "platform"
- [ ] The tone assumes the visitor is intelligent — no over-explanation

**Structural:**
- [ ] The funnel follows the section order in this document
- [ ] Every section answers one question the visitor is already asking
- [ ] The CTA section never uses urgency language ("Limited spots!", "Act now!")
- [ ] The footer includes the brand tagline

---

### On Christ-Centered Values in the Work

Excellence, integrity, and humility are not marketing strategies here — they are convictions. Every line of copy, every component decision, every pixel of spacing is an opportunity to reflect those values.

- **Excellence** means we do not ship half-finished work. We revisit until it is genuinely good.
- **Integrity** means every claim on this website must be true. If a metric is shown, it was measured.
- **Humility** means we do not position APEX as superior to competitors. We describe our work and let it speak.

The public website is APEX's first word to the world. Let it be a word worth saying.

---

*Design Bible compiled from the APEX AERA Client Dashboard design system. Version 1.0. All values are production-exact.*
