# GovHub "Gold Country" Brand Kit — Implementation Guide for Claude Code (v3)

**Scope:** Apply this kit across govhub.online (Astro on Cloudflare Pages), Resend emails, and social. Graphics facelift only — page structure, routing, and copy hierarchy stay as they are. This kit supersedes v1 (navy blueprint) and v2 (warm civic); it merges them: v2's warmth and shapes with **Federal Navy `#214B89`** and **Signal Teal `#12948C`** restored as core colors.

## 1. The idea

Government contracting is gold country: the opportunities are real, but they're buried in mountains of solicitations, and most small contractors are digging with their hands. **GovHub is the shovel.** The visual system runs on that metaphor — navy mountain ranges (the market), gold nuggets (contracts), a dotted trail (from RFP to ready), the pan (the compliance matrix that catches every requirement), the cart (the pipeline), the lantern and beacon (intelligence and signal — the teal), basecamp (the company), and the vault in the mountain (security). Every page graphic below is drawn from this world, in the same flat, friendly style as the v2 illustration set so people-scenes and metaphor-scenes sit side by side.

Color logic: **Navy** is structure — mountains, headings, secondary buttons, the night bands. **Teal** is the signal — links, checkmarks, veins, beacons. **Gold** is the payoff — nuggets, suns, squiggles; decorative only, never body text. **Brick maroon** stays from v2 as the warm human accent (flags, trails, tents) and remains the primary CTA color so buttons pop against all the blues. **Oat** paper keeps the whole thing warm instead of corporate.

Typography is unchanged from v2: Fraunces display, Bricolage Grotesque brand accents, Figtree body. The logo keeps the v2 lowercase govhub construction, recolored: the arch is now Federal Navy (read it as the mountain, the tunnel mouth, or the dome — all three are true), the dot is a gold nugget, the bars are Signal Teal, and "hub" is teal.

Accessibility floor is unchanged (WCAG 2.2 AA): gold and all tints decorative only; teal-600 for links at 18px+/bold, teal-700 for small text; body is ink-700 on oat/white; on navy bands, oat text with gold-300 accents. Decorative SVGs get `aria-hidden="true"`.

## 2. The page-to-graphic map

Copy the kit to `public/brand/`. Every marketing URL now has a purpose-built graphic in `page-graphics/` (SVG + @2x PNG). Placement default: right side of the page's hero header at 40–55% width on desktop, stacked above the H1 on mobile, `aria-hidden="true"` with the copy carrying the meaning.

| Page (URL) | Graphic | The metaphor |
|---|---|---|
| `/` hero | `home-hero-strike-gold` | Trail from a checked RFP at the base to a planted flag and nugget at the summit; a gold shovel mid-climb. Use via `.gh-hero`. |
| `/` 3-step process | `home-journey-3-steps` | Survey the map → dig with the shovel → strike gold. Place behind/above the three step cards via `.gh-journey`. |
| `/` CTA + all page CTAs | `cta-band-night-mountains` | Night ridge, lantern lit, gold trail. Via `.gh-cta-band`. |
| `/solutions/` | `solutions-index-toolkit` | The full expedition kit on a map: shovel, pickaxe, lantern, pan of nuggets. |
| `/solutions/compliance-matrix-generator/` | `solution-compliance-matrix-pan` | The matrix is the pan: a requirements table pouring into a gold pan that catches every nugget. |
| `/solutions/rfp-shredding/` | `solution-rfp-shredding-strata` | A pickaxe splits the solicitation's strata; every layer comes out as a clean, tagged card. The gold vein runs through the rock. |
| `/solutions/ai-proposal-generator/` | `solution-ai-generator-cart` | The mine cart carries a sparkling draft down the rails toward the flag. |
| `/solutions/form-autofiller/` | `solution-form-autofiller` | One company profile pours gold straight into SF-form fields; checks appear as they fill. |
| `/pricing/` | `pricing-three-peaks` | Solo, Pro, Team as three summits — each with a flag and gold at the top; one trail reaches all three. Align each peak loosely over its pricing column. |
| `/vs/` + `/vs/*` + `/alternatives/*` | `compare-weigh-options` | A prospector's balance scale: nuggets on one side, plain rocks on the other, GovHub shovel standing by. |
| `/case-studies/` | `case-studies-carts-of-proof` | A train of loaded carts coming down from the range under confetti — the wins, in volume. |
| `/blog/` | `blog-trail-map` | The field map: topo lines, marked trails, X marks the gold, a compass and lantern. Also works as a default blog-post cover. |
| `/faq/` | `faq-signpost` | A trail signpost pointing every direction — questions answered before the climb. |
| `/for/small-business-contractors/` | `for-small-business-basecamp-climb` | A one-tent basecamp, campfire, a gold shovel and a checked doc — and a clear trail to the summit flag. The underdog, well equipped. |
| `/for/system-integrators/` | `for-system-integrators-rail-network` | Multiple carts on connected rail lines — many pursuits, one network. |
| `/about/` | `about-basecamp-dusk` | Basecamp at dusk under the range: tents, fire, the map out, stars up. |
| `/security/` | `security-mountain-vault` | A vault door set into the mountain with a teal shield-check above — the gold stays inside. |
| `/compliance/` | `compliance-survey-checkpoint` | A surveyor's measuring post against the strata plus a sealed checklist — everything measured against the standard. |
| `/contact/` | `contact-signal-beacon` | A watchtower beacon broadcasting Signal Teal waves across the range. |
| 404 | `404-no-gold-here` | An empty pan, a few plain rocks, a question mark — "nothing here; back to the trail." Pair with a maroon "Back to home" pill. |
| Footer (site-wide) | `footer-ridge-strip` | Teal/navy layered ridgeline that sits directly above the navy-800 footer. Via `.gh-footer-ridge`. |

Legal pages (`/privacy/`, `/terms/`) intentionally get no scene — just the `ridge-divider` ornament under the H1. Blog posts without custom art default to `blog-trail-map` crops.

## 3. System assets

`logos/` — full recolored suite (horizontal/compact/stacked/icon/white/mono, favicon + 512 app icon, avatar SVG/PNG), all path-based. `icons/` — the 12 base stroke icons plus 8 new mining icons (`icon-shovel`, `icon-pickaxe`, `icon-nugget`, `icon-pan`, `icon-lantern`, `icon-map`, `icon-peak-flag`, `icon-cart`), all `currentColor` — tint navy/teal/ink. `graphics/` — `topo-pattern-tile` (quiet contour-line texture for `.gh-section-pattern`), `nugget-confetti-tile` (testimonials/celebrations), `ridge-divider` (section ornament, `.gh-divider-ridge`), `squiggle-underline` + `highlight-swash` (one per viewport, unchanged rules), `sticker-badge` (teal check seal for the trust strip). `illustrations/` — the four people scenes from v2 recolored to Federal Navy/Signal Teal shirts so humans and metaphor scenes share one palette; same placements as v2 (people scenes for collaboration/drafting/team/wins moments, metaphor scenes for page heroes). `email/` + `social/` — mountain-scape header/divider/footer PNGs at @2x, OG card ("Dig up your next contract."), LinkedIn cover.

`tokens/tokens.css` carries the merged palette and updated helpers (`.gh-hero`, `.gh-journey`, `.gh-cta-band`, `.gh-section-pattern`, `.gh-divider-ridge`, `.gh-footer-ridge`, buttons, focus states). Import globally; no hardcoded brand hex in components.

## 4. Application notes

Header/nav, buttons, cards, type roles, and email mechanics follow the v2 guide verbatim with these substitutions: headings and secondary buttons in navy-600; links teal-700; success checks teal; the CTA band and footer move from maroon-900 to navy-800 (night mountains); testimonial left-borders gold; the compliance/security strip keeps its sober treatment with `sticker-badge` chips. Homepage copy hooks that unlock the metaphor if wanted (optional, copy changes are Jerr's call): hero eyebrow "GOLD COUNTRY FOR GOVERNMENT CONTRACTORS", CTA headline "Dig up your next contract."

Voice guardrail: the mining metaphor lives in visuals and occasional headline moments — never in compliance claims, security language, or pricing terms, which stay literal.

## 5. Definition of done

Tokens + fonts wired; recolored logo suite in header/footer/favicon; every URL in the table above showing its graphic (SVG preferred on-site, PNG for email/social); footer ridge above a navy-800 footer site-wide; people illustrations placed with alt text; email chrome and OG/LinkedIn swapped; one squiggle/highlight max per viewport; Lighthouse a11y ≥ 95; QA at 360/768/1280 confirming graphics scale and never sit behind body copy.
