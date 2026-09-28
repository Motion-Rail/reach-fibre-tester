# Fibre Tone Tester — change record

Cable: 432-fibre / 36-ribbon. Tone source: installed EXFO RTU-2 (not MAX-945).
Far-end confirmation: live-fibre detector clamp.

---

## v3 — 9 July 2026

### Cable picker (no more typing the route)
- New relay endpoint `POST /api/routes` searches FMS and returns **distinct cable
  stems** with fibre counts (e.g. `F-RGAC-SNBC-A-R432 — 432 fibres`).
- Route screen replaced: type a fragment (`SNBC`), tap **Find**, then tap the cable.
  Eliminates typos in the route string.
- Manual entry retained behind an **Enter route manually** link as a fallback.
- Recent cables are now tappable and resume saved progress.

### Back navigation
- Added **‹** button in the test header to return to the cable picker mid-session.
  Progress is saved per cable, so switching back and forth is safe.

### Toning indicator made unmissable
- Previous ring was an inset `box-shadow` on a `::before` pseudo-element behind the
  content, animating opacity only — it rendered faintly or not at all on some mobile
  browsers. Replaced with: amber border, warm background shift, an outer glow pulse
  (`heroPulse`), and a sweeping progress bar across the top of the card.

### Honesty about simulated tones
- When the relay reports `simulated: true` (i.e. `LIVE_TONE=0`), the app now shows a
  red **"SIMULATED — no light in fibre"** banner and the state reads
  `SIMULATED — F001` rather than `TONING F001`.
- Rationale: the animation is a *timer*, not a status feed from the RTU. Without this
  banner a field engineer could believe a simulated tone was real.

---

## v2 — 8 July 2026

- Relay resolver wired: fibre name → **OpticalRouteID** via FMS GraphQL
  `searchOpticalRouteByRtu` (matchType CONTAINS), paginated 50 at a time.
- `POST /api/prime` primes all 432 IDs for a cable on start; cached name→`{id, rtuId}`.
- Tone call wired to the captured shape:
  `POST {TOPO_HOST}/api/topology/control/opticalroutes/{route_id}/testsetup/build`
  body `{"name":"","payload":"<stringified inner JSON>"}`, inner
  `{"MeasurementType":"PonXplorer;TimedSource;Modulation={freq};Duration={duration}","WavelengthsUsed":[{wl_m}]}`.
  Wavelength converted nm → metres (1550 → `0.00000155`).
- `LIVE_TONE` master switch; simulation is the default so the app is safe to trial.
- `TONE_ID_FIELD` switch (`id` | `rtuId`) in case `build` wants the numeric id.
- Login fully wired: Keycloak password grant at
  `{AUTH_BASE}/auth/realms/Fiber/protocol/openid-connect/token`, client `fg-topologyui`.
  Token cached server-side and refreshed; **never sent to the phone**.
- Optional `APP_KEY` so only your app can call the relay.

### Deployment
- Relay on Render (FastAPI). Notes: set **Root Directory** blank when files are at repo
  root; pin Python (`PYTHON_VERSION=3.12.7`) or use `pydantic>=2.12`, which ships
  wheels and avoids the Rust/maturin compile that fails on Python 3.14.

---

## v1 — initial rebuild

- **NEXT** as the dominant control: confirms the current fibre and advances,
  crossing ribbon boundaries automatically. One thumb walks all 432.
- 36-ribbon rail with per-ribbon progress dots; tap to jump.
- Current-fibre hero card: number, IEC 60304 colour, ribbon, position (n/12), overall (n/432).
- Keyboard / Bluetooth clicker support: Space or → next, ← back, R repeat, F off.
- **Off** marks a fibre as not-detected; **Issue** records a per-fibre note.
- End-of-run summary with copy-to-clipboard report (confirmed / off / issues).
- Progress and cable ref persist across an accidental refresh.
- Presets: 1550 nm / 10 s / 1 kHz (all editable in Settings).

---

## Open items

1. **First live tone.** Set `LIVE_TONE=1`, confirm `/health` reports `"tone":"live"`,
   then tone one fibre with a clamp on the far end. If `build` returns 404/400, switch
   `TONE_ID_FIELD` from `id` to `rtuId` — both are cached, so it's a one-word change.
2. **Modulation frequency.** The captured request used **330 Hz / 5 s**; the app
   defaults to 1000 Hz / 10 s. 330 Hz is the value proven to work on your source — set
   whichever the live-fibre detector reliably picks up.
3. **No tone-active feedback.** The `build` call returns on acceptance; the app cannot
   currently confirm the source is emitting. If FMS exposes a status or stop endpoint,
   capture it and the countdown can reflect reality rather than a local timer.
4. **Host the app** (static site) and then set relay `APP_ORIGIN` to that URL,
   replacing `*`.

---

## v4 — 9 July 2026 — RTU disambiguation (correctness fix)

**Problem.** The cable stem (`F-RGAC-SNBC-A-R432`) is the same at both ends — it is
visible from the Reading (RGAC) RTU *and* the Swindon (SNBC) RTU. Picking a stem alone
did not tell the relay which RTU should emit the tone, so it could resolve to the
OpticalRouteID at the wrong end and tone from the far end.

**Fix.** The unit of selection is now **cable + RTU**, not cable.

- GraphQL selection extended to fetch `rtuName` and `rtu.site.name` (the operation was
  always `searchOpticalRouteByRtu` — we simply weren't using the RTU).
- `POST /api/routes` now groups by `(stem, rtuId)` and returns `rtuName` and `site`.
  The picker shows e.g. `F-RGAC-SNBC-A-R432 — Tone from RTU-RGAC-01 · Reading`.
- `ROUTE_ID_CACHE` re-keyed from `NAME` to `RTUID|NAME`, so the same fibre name at
  both ends no longer collides.
- `rtuId` is now required by `_resolve_route_id` and is sent on every `/api/prime`
  and `/api/tone` call.
- Test header shows which RTU is toning; the end-of-run report records it.
- Recents remember the RTU — the same cable from the other end is a separate run with
  separate progress.
- Manual route entry now warns that no RTU is selected before proceeding.

---

## v5 — 9 July 2026 — Motion branding, RTU status, location, report export

### Branding
- Motion wordmark on the sign-in / cable screens, compact `M` mark in the test header.
- Palette moved from amber to Motion teal (`#016976`, accent `#16b6c9`).
- App icons and PWA manifest regenerated from the logo; theme colour is brand teal.
- Note: the supplied `PMS_2238__trans_-_RGB.png` is **not** transparent (solid black
  background). `Motion_Logo_Trans_Web.png` was used instead and upscaled 2x.

### RTU online / offline
- GraphQL selection now includes `rtu.attachStatus`.
- Cable picker shows a green/red dot and an ONLINE / DETACHED tag per RTU; offline
  entries are dimmed and dashed, and sort below online ones.
- Selecting an offline RTU prompts a confirmation.
- The relay **refuses** to tone from an offline RTU (HTTP 409) unless `force: true`
  is sent — an offline RTU cannot emit, so a silent success would be misleading.

### Test location
- New ⚑ button captures **Joint / chamber / node** plus optional detail.
- Shown persistently under the header and included in every report.

### Report export
- Completion screen now offers **Share · Email · Save as PDF · Copy text**.
- Share uses the native share sheet (Mail, WhatsApp, Files) where supported,
  falling back to email.
- PDF is produced via a formatted, branded print view → "Save as PDF" (works on
  iOS, Android and desktop without any third-party library).
- Report records cable, RTU + site, location, tester, parameters, counts, off-list
  and issues.

### Configuration
- Relay URL hardcoded to `https://relay-njqb.onrender.com`; app key pre-filled.
  Both remain editable in Settings.
- Default modulation changed to **330 Hz** (the value proven in the captured request).

> **Security note.** Anything shipped to a browser is readable by anyone who opens the
> page or the repo — an app key in a static site is not a secret. `123456` was not used;
> a long random key is pre-filled instead. The real control is `APP_ORIGIN` on the relay,
> which must be set to the app's URL so other sites cannot call it.

---

## v6 — 9 July 2026 — DIS/CROSS states, prominent location, Finish, demo removed

### Fibre states
- **Off → DIS.** Marks a fibre where no tone was detected.
- **New: CROSS.** Marks a fibre where the tone appeared on a *different* fibre, with a
  free-text field for what it was crossed with (e.g. `F014`, `R2 pos 3`). Shown in
  violet on the grid (with an ✕), on the ribbon dots, in the hero note, and as its own
  section in every report.
- Keyboard: `D` = DIS, `X` = Cross (was `F` = Off; `F` still works for DIS).

### Test location made unmissable
- The location bar now sits under the header at full width. When unset it is **red,
  pulsing, and reads "SET TEST LOCATION — required for the report."**
- The location sheet opens automatically when a cable is started.
- Finishing without a location prompts before allowing it.

### Finish
- **FINISH & report** button now sits on the main screen beside NEXT — no longer
  buried in Settings.

### Demo mode removed
- The app now always talks to the relay. No simulated tones, no demo cables, no
  "skip" link. If the relay is unreachable, it says so rather than pretending.
- (The relay's own `LIVE_TONE=0` simulation switch still exists server-side and still
  raises the red "SIMULATED — no light in fibre" banner.)

### Reports
- Text and PDF reports now separate **DIS** from **CROSSED**, and list each crossed
  fibre with its partner.

### Config
- `APP_KEY` must match the value set in the relay's Render Environment. It is
  pre-filled but remains editable in Settings.

---

## v7 — 9 July 2026 — RTU busy handling, PDF reports, simplified settings

### RTU single-source constraint (fixes EXFO 409)
- EXFO returned `409 AdhocTestAlreadyScheduled` when a second tone was requested while
  one was still running — the RTU-2 has one test source and enforces the duration.
- App now tracks when the source frees up, shows **"RTU busy — Ns left"**, and fires
  automatically. Rapid taps queue rather than fail.
- Relay retries a 409 up to 3 times with backoff (`TONE_RETRIES`, `TONE_RETRY_DELAY`)
  and returns a plain-English message.

### Defaults
- **5 s @ 1 kHz**, 1550 nm. A one-off migration moves devices off the old 10 s values.

### Settings simplified
- Relay URL and app key are hardcoded and now hidden behind an **Advanced** link.
- Main settings show only tone parameters, **Test relay**, Finish, Reset.

### Reports are now real PDFs
- Generated client-side with jsPDF (loaded on demand from CDN).
- **Share PDF** attaches the file to WhatsApp, Mail, Files etc. via the native share
  sheet; **Save PDF** downloads it. Copy-as-text retained.
- Fixed: jsPDF core fonts are Latin-1 only — arrows/bullets corrupted whole lines.
  All report text is now sanitised before drawing.

### Cable selection
- "Search" → **"Search Node"**, examples retained.
- **Manual route entry removed.** It could not supply an `rtuId`, so it risked toning
  from the wrong end of the cable.
- Recents limited to the **last session only**, with a **Clear** button.

---

## v8 — 9 July 2026 — NEXT actually locks while the RTU is toning

**Bug.** The v7 lockout stopped the *tone* firing while the source was busy, but left
**NEXT enabled**. An engineer could tap straight through the cable marking fibres
"confirmed" while no light was ever emitted — the exact false-confidence failure the
simulated-tone banner was added to prevent.

**Fix.**
- NEXT, Back and Repeat are disabled for the full tone duration. NEXT shows a live
  **"WAIT 3s"** countdown and reverts automatically.
- The fibre grid and ribbon rail are non-tappable while toning; the hint bar reads
  "⚡ RTU is toning — controls locked for Ns".
- Tapping a locked control shakes the button and reports the remaining time.
- Keyboard/clicker input honours the lock.
- **A fibre can no longer be marked confirmed unless a tone actually fired for it.**
  If the tone call failed, NEXT refuses and prompts "press Repeat".
- `busyUntil` is no longer cleared when the local countdown ends — it expires on the
  real duration, matching EXFO's own server-side enforcement.

---

## v9 — 9 July 2026 — selectable test scope (all / odd / even / range)

You often tone only part of a cable (e.g. odds one shift, evens the next). The scope
is now chosen up front and the whole screen respects it.

- On the location sheet, **Fibres under test**: All 432 · Odd (F001, F003…) ·
  Even (F002, F004…) · Range (from–to, global fibre numbers).
- Odd/even are **global** (F001..F432), per your spec.
- The grid greys out and disables out-of-scope fibres; ribbon dots reflect only
  in-scope fibres; NEXT walks only the in-scope set and completes when they are done.
- Header count shows `done / <scope total>` rather than /432; the location bar and
  test header show the active scope.
- Reports record the scope and count "confirmed X of <scope>".
- Changing scope mid-session jumps to the first in-scope fibre if the current one
  falls outside it.
- Verified by simulation: odd=216, even=216, range 50–120=71, none out of scope.

---

## v10 — 13 July 2026 — v9 packaged

No functional change recorded beyond v9. Scope selection shipped as the deployable build.
(Entry added 28 Sep 2026 from the files on disk.)

---

## v11 — 13 July 2026 — scope button text fix

- The Odd / Even scope buttons showed the literal text `…` instead of an ellipsis.
  Replaced with the real character. Only change from v10.
(Entry added 28 Sep 2026 from a file comparison of v10 and v11.)

---

## v12 — 28 September 2026 — Continuity check, RTU to RTU

The next step for a finished cable: prove every fibre end to end with no one on site.

### Method (proven live on F-RGAC-SNBC, 28 Sep 2026)
Tone fibre n at one RTU; order an AdHoc OTDR on fibre n at the other RTU. If the far RTU
refuses the OTDR with **112_LiveFiberDetected** ("Live fiber detected."), the light is on
that fibre, so fibre n is fibre n end to end. A completed OTDR means the tone is elsewhere.
PoC evidence: baseline F001 clean, toned F001 refused, F002 clean, F001 refused again.
Timings: refusal ~10 s, dark OTDR ~35 s (5 s acquisition), first test of a session ~53 s.
File: `tools/continuity_poc/evidence/continuity_poc_20260928_174646.json`.

### App
- New entry on the cable screen: **Continuity check, RTU to RTU**.
- Pick the cable (both ends are found automatically), swap which end tones, pick ribbons
  by bundle (R1 only / Bundle 1 / All 36), set tone and OTDR seconds, Live or Simulation.
- The run happens **on the relay**, so the phone can lock or the laptop close. Any signed-in
  device can open the same run from **Runs on the relay** and watch it live.
- Live view: progress, straight / crossed / not found counts, tests, elapsed, which fibre is
  toning and which is being tested, a ribbon by position map (crossed cells show the far end
  fibre it landed on), findings, activity log.
- Pause, Resume, Stop (tap twice to stop). Reports: **Share PDF**, **Save CSV**, **Copy text**.
  Simulation runs are stamped SIMULATION on screen and in the PDF.
- Works at phone width (360 px) and on desktop.

### Relay
- New files: `relay_continuity.py` (routes + background job), `continuity_engine.py`
  (search logic), `fms_continuity.py` (FMS OTDR start / wait / failure reason).
- Routes: `/api/continuity/start`, `/status`, `/control`, `/jobs`, `/test`, `/pace`, and `/api/otdr`.
- OTDR start = Conductor workflow `postBulkTests_On_Multiple_RTUs_ORs_Dynamic` via
  `/workflow/server/api/workflow/…` with the same input the FMS UI sends (captured from Tasks).
- Tone reuses the existing `/api/tone` logic unchanged, including the 409 back-off.
  One source per RTU is respected: the next tone waits until the last one has ended.
- Safety: `CONTINUITY_EXCLUDE` env var (route names or ribbon ranges, e.g. `R35-36`) — those
  fibres are never toned or tested. Live runs refuse to start when `LIVE_TONE=0`. Only one
  live run per RTU pair at a time.
- `/health` now reports `"version": "v12"`. `requirements.txt` adds `requests`.
- Jobs are held in memory: a relay restart or redeploy ends a running job.

### Search
Expected fibre, learned pattern (and its reversal / neighbouring ribbons), fibre either side,
ribbon reversed, ribbon before/after, bundle before/after, then a ribbon sweep; a second pass
widens to the bundle. A cross is only accepted after a confirming retest.
Simulated over 4,320 fibres per fault type with 8% missed refusals: **no wrong answers**;
unresolved 0% (straight, reversed, pair), 0.1–0.2% (ribbon or bundle swaps), 1% (mixed).
Straight cable ≈ 1.2 tests per fibre.

### Tested
Against a mock FMS through the real relay code: planted F005↔F007 cross on R1 found and
reported; phone and desktop UI driven end to end; PDF and CSV checked. Not yet run live
through the relay.
