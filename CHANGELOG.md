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

### v12 fix before release — 28 Sep 2026: continuity cable search found nothing
- FMS route search matches the **RTU name**, not the cable name, and each end of a cable
  has a different RTU. Searching `RGAC-SNBC` matched no RTU; searching `SNBC` found only
  the SNBC end, so the "needs an RTU at both ends" filter hid it.
- Now: the search splits what you type into node codes (RGAC, SNBC), searches each, then
  looks up the far end of every cable found and pairs the two ends by cable name.
  `SNBC`, `RGAC-SNBC` and the full `F-RGAC-SNBC-A-R432` all return the cable.
- Clearer messages when nothing matches, or when only one end has an RTU.
- The ordinary tone search is unchanged.

---

## v13 — 28 September 2026 — Reach Fibre Tester

- **Renamed** to **Reach Fibre Tester**: browser tab, sign-in screen, home-screen icon name
  ("Reach Tester"), reports and PDF footers.
- **New screen after sign in:** choose **E2E Continuity Checker** or **Uni-dir Continuity Checker**.
  Sign out is on this screen; each checker has a way back to it.
- **E2E Continuity Checker:** search a node (e.g. SNBC); every cable with an RTU at both ends is
  listed by **cable ID** (e.g. `F-RGAC-SNBC-A`, `F-SGIC-SNBC-A`). Far ends are looked up in
  parallel, so the list comes back faster; a newer search cancels an older one.
- **Uni-dir Continuity Checker:** the existing tone workflow. Search the node you are testing out
  from; cables listed by cable ID.
- Cable IDs are shown without the fibre count suffix (`-R432`); FMS names are unchanged underneath.
- The continuity banner on the cable screen is gone (the choice is now made up front).
- Hosted at **https://motionrail.onrender.com** (new Render static site, same GitHub repo).
  tone-tester.onrender.com keeps serving the same repo until it is retired.
- Relay unchanged (still relay v12).
- `sw.js` cache `reachtester-v13`.

Note on names: FMS holds the Swindon–Stoke Gifford cable as `F-SGIC-SNBC-A` and Stoke Gifford–Cardiff
as `F-0001-SGIC-A`; the app shows the IDs exactly as FMS has them.

### Relay v13 — 28 Sep 2026
- CORS: the relay now also accepts calls from **https://motionrail.onrender.com**
  (`APP_ORIGINS_EXTRA`, default that URL). `APP_ORIGIN` may now hold several origins
  separated by commas. tone-tester.onrender.com keeps working.
- `/health` reports `"version": "v13"` and the allowed origins.
- No other relay change.

---

## v14 — 28 September 2026 — simpler E2E, faster pacing, debug report, version history (app + relay)

Field feedback from the first live E2E runs on F-RGAC-SNBC-A, R1 (12 fibres, all straight):
tone 10 s took about 4 min / 13 tests; tone 5 s took about 3 min / 12 tests, no misses.

### App
- **Settings under Advanced** (closed by default). Defaults come from the field runs: tone 6 s,
  OTDR 5 s, auto pacing on. "Reset to defaults" in Advanced.
- **Simulation removed** from the screen (it existed only to try the app without sending light).
- Ribbon quick picks: **All 36** and **Clear** only.
- **Elapsed** shows `X min Y sec` (and hours when needed). Reports show time taken.
- **Smart search note** under Start explains what the run does when a fibre is not straight.
- **Debug report** (under Findings): *Email to Alkis* opens an email to alkis@motionrail.co.uk with a
  summary and saves the full debug file; *Save debug file* shares or saves it. The file holds every
  test with timings, pace changes, settings, app and relay versions, device and activity log.
- **Version history** link on the sign-in, check-choice and E2E screens; shows the app version,
  the relay version live from the relay, and every version with its date and changes.
- Run view shows the tone, lead and versions in use. PDF and text reports carry app and relay versions.

### Relay v14
- Default pacing tone 6 s, lead 2 s (was 20 s / 3 s). OTDR status is polled every 1 s (was 2 s).
- **Auto pacing:** if a fibre's own test reads clean and then passes on the retry, the tone is
  lengthened by 2 s and the lead by 1 s for the rest of the run (tone max 20 s). Logged in the run.
- Every test is recorded (time, fibre, candidate, verdict, OTDR seconds, cycle seconds, tone, lead,
  workflow id, error detail). New route `/api/continuity/debug` returns it with timing averages.
- `/health` version v14.

### Timing
At tone 6 s the expected cycle is about 14 to 15 s per straight fibre: tone call, 2 s lead, OTDR
start and the RTU's live-fibre refusal (~10 s), status poll. A full 432f cable in one direction is
about 1 h 45 min if straight. The floor is the RTU refusal time, not the tone length.

---

## v15 — 28 September 2026 — measured default settings (app + relay)

Timed on the live cable F-RGAC-SNBC-A through the app (RGAC2 tones, SNBC tests), all fibres straight:

| Run | Tone | OTDR | Lead | Fibres | Time | Tests | Straight cycle |
|---|---|---|---|---|---|---|---|
| Alkis, v14 | 6 s | 3 s | 2 s | R1 | 4 min 9 sec | 13 | 12.9 s (one miss after a 66 s FMS delay) |
| A | 10 s | 1 s | 2 s | R1 | **2 min 34 sec** | 12 | **12.8 s**, no misses |
| B | 10 s | 3 s | 1 s | R1 | 3 min 4 sec | 13 | 12.0 s, first fibre missed |
| C | 10 s | 3 s | 2 s | R2 | 3 min 50 sec | 13 | first fibre missed, auto pace then raised tone to 12 s: 14.0 s |

Dark (wrong fibre) OTDR, measured with a tone on a different fibre:
OTDR 1 s: 33.5, 14.0, 34.6 s (erratic) · OTDR 3 s: 17.4, 17.5 s · OTDR 5 s: 17.5, 18.5 s.

What this shows
- The far RTU's live-fibre refusal takes about 9.3 s whatever the settings. A straight fibre costs
  tone call + lead + that refusal, about 12.8 s.
- **Tone length does not slow the run until it passes about 11 s**, because the next tone can only
  start when the last one ends. 6 s and 10 s gave the same 12.8 s cycle; 12 s gave 14 s.
- **OTDR seconds only matters for wrong guesses** (crossed fibres, misses): 3 s is as quick as it gets
  and consistent; 1 s is erratic and slower on average.
- Every miss so far came after a slow FMS start (cycle 36 to 66 s), usually on the first fibre of a
  run. The tone had run out before the OTDR began. A longer tone for every fibre would not help and
  would slow everything.

Changes
- **Defaults: tone 10 s, OTDR 3 s** (app and relay). OTDR minimum is now 3 s.
- Relay: the **first test of a run** and **the retry of a missed fibre** use a 20 s tone.
- Relay: **auto pacing ignores a miss that followed a slow FMS start** (cycle over 25 s); it only
  lengthens the tone for a miss on a normal-speed test. In run C this would have kept 12.8 s a fibre.
- Relay: the tone for a continuity test now goes straight to the known route id (no name lookup).
- Lead stays 2 s: 1 s saved 0.9 s a fibre but its run missed a fibre.

Expected: about 13 s a fibre, 2 min 40 sec a ribbon, about 1 h 35 min for a straight 432f cable
in one direction.

---

## v42 (desktop) + v39 (phone) + relay v35 — 8 October 2026 — EXFO continuity settings

- Alkis 8 Oct, EXFO's parameters "giving the best results under normal network conditions":
  tone duration 4 s, wavelength 1550 nm, scan (OTDR) duration 1 s, modulation 330 Hz.
- E2E continuity defaults (phone and desktop) now tone 4 s and OTDR 1 s (were 10 s and 3 s); the OTDR
  box now allows 1 s (was 3 s minimum). The tone is sent with 330 Hz modulation (`freqHz` 330, was 0,
  an unmodulated tone). Relay v35 defaults match (`PACE` default_tone_s 4, default_otdr_s 1, freqHz 330).
- Unchanged safety nets: the first test of a run and the retry of a missed fibre still get the 20 s
  cover tone, and auto pacing lengthens the tone by 2 s if fibres are missed.
- Time estimate now max(9, tone + 5) s a fibre until a real run is timed (was 12.8 s measured at 10 s / 3 s).
- Report text says "tone at 1550 nm" with the modulation instead of "CW tone".
- Uni-dir tone settings are unchanged.

## v41 + relay v34 — 7 October 2026 — Cable View and stored traces

- Alkis 7 Oct: the Fibres screen is now **Cable View** (nav, heading, Help). The header and browser tab title are just
  "Reach Fibre Tester" (the small "desktop" label and "· Desktop" are gone).
- A fibre in Cable View lists its stored OTDR traces from both ends (newest first, 25 shown, with seconds;
  live OTDR shots tagged "live"), above the history. Click one: the trace opens in the OTDR window
  (title "OTDR trace", chip Stored, events listed and clickable to zoom). "Lay over" picks a second trace
  to draw in blue over it, to compare before and after work on the fibre.
- Relay v34 `relay_otdr.py`: `POST /api/otdr/traces {stem, fibre}` (results API, Adhoc OTDR per end,
  top 40 each, errors skipped; `live` when the PromiseId is one of this relay's live shots) and
  `POST /api/otdr/trace {resultId}` (reduced trace, length, events; cached, 60 kept). Desktop users only.
- Versions (Alkis 7 Oct): desktop footer reads "app v41 · relay v34"; desktop sign in shows "app v41".
  Phone v38: start and E2E screens read "Reach Fibre Tester app v38 · relay v34 · Version history";
  the phone sign in shows the app version only.
- Relay memory: the relay climbed from about 20% to 70% of its 512 MB in a day (Render metrics 7 Oct).
  Finished Task routes are now kept as compact tuples (about half the memory) and the other caches are
  capped (history files 1500, history Tasks 600, run logs 800, folder lists 300, cable views 6); live
  OTDR sessions that ended over an hour ago are dropped.
- Relay moved to Frankfurt (Alkis 7 Oct): the app, desktop and push.js now use
  https://relay-eu-0t5v.onrender.com (Render `relay-eu`, Frankfurt, Starter, health check /health,
  MALLOC_ARENA_MAX=2). FMS is in AWS Paris; the old relay (relay-njqb, Oregon) crossed the Atlantic on
  every FMS call. Browser to relay /health measured about 100 ms vs 210 ms. Same VAPID key, so phone
  alerts keep working. Old relay to be suspended by Alkis once the new one has run a day.
- Tests: test_otdr 31, ui_otdr 22, ui_v36m 9 (versions on the phone), ui_desktop footer.

## v40 + relay v33 — 7 October 2026 — Task result files

- Run history: a finished FMS Task's detail has **Download files**, the .sor of every fibre in one zip
  (`<cable> <RTU> <OTDR|iOLM> <yyyy-mm-dd HHMM>.zip`, UK time).
- Relay `relay_files.py`: `POST /api/taskfiles/start {taskId}`, `/status {id}`, `/get {id}` (desktop users only).
  The Task does not list its result ids, so each fibre's stored result is found in the results API (same route,
  same test type, test time within 10 min of the Task's time for that fibre). Files come from
  `GET /upload/ClientsData/zip?resultIds=a,b,...`, 20 ids a call, as the FMS Task page does (captured 7 Oct);
  the zips are merged into one, flat, kept 30 min. A running Task is refused.
- Live OTDR quicker (Alkis 7 Oct): 3 s shots by default (was 5), Shot length 1, 2, 3, 5 or 10 s in the Live OTDR
  window (`POST /api/otdr/live/settings {id, seconds}`, used from the next shot, remembered in `rft.lo.secs`).
  The next OTDR is fired as soon as FMS has stored the last one, and that trace is read while the next runs
  (was: read, compare, 1 s pause, then fire). The stored result id comes from the STOMP push when it connects,
  else from the results list checked every second from the end of the shot (was every 2 s from the start).
  The trace is read by `resultid eq` (one result, as probe v2 did live) instead of the last three with traces.
  The page polls every second and only gets traces when there is a new one (`have`). The window shows how
  often a trace arrives.
- Tests: new test_files (13 checks); test_otdr extended for the quicker loop.

## v39 — 7 October 2026 — desktop tidy (app only)

- Cable health check: the Live OTDR buttons now sit at the top of a fibre's detail, under its
  name. They were below the history list, which can be long.
- Help: guide and release notes text is white in dark mode (it was dark grey on dark).
- Relay unchanged (v32). Phone unchanged (v37).

## v38 + relay v32 — 7 October 2026 — Live OTDR

Step 4.6 (Alkis, 7 Oct: EXFO's concern was a Task per fibre, not load; OTDR on automatic settings at 1550 nm).
- **Relay v32 (`relay_otdr.py`):** `POST /api/otdr/live/start|status|stop|reference|list`. Each shot is the direct ad hoc OTDR (no Task): 1550 nm, automatic settings, 5 s (`LIVE_OTDR_S`). The stored result is read back with its trace (`OtdrMeasurements`), reduced to about 1500 points and cut a little past the fibre end. The first trace is the reference; new loss steps of 0.15 dB or more (`LIVE_OTDR_STEP_DB`) are reported with their distance, against the reference and against the previous trace. One session per RTU; refused when a Task, E2E run, tone or another live OTDR is on the RTU; the RTU shows as testing; stops after 10 minutes (`LIVE_OTDR_MINUTES`). Trace numbers read as `TRACE_FORMAT` uint16 little endian x `TRACE_SCALE` 0.001 dB until the PC probe confirms it.
- **Desktop:** Live from RGAC2 / SNBC buttons in the fibre detail; Live OTDR window with the chart (grey reference, blue latest, red marks with dB), findings, zoom on a mark, Whole fibre, Use latest as reference, Stop. The cable health check pulses the fibre and the live strip names the session (click to reopen).
- **PC `otdr_probe\`:** read only probe of a real stored OTDR (trace format, .sor download address, a Task's results).
- Tests: test_otdr 17, ui_otdr 12 (mock FMS now answers the direct ad hoc OTDR with a trace and can add a bend).

## v37 + relay v31 — 7 October 2026 — Fibres screen with real results, in real time

Step 4.3. The desktop Fibres screen (designed with Alkis in v36) now reads real results.
- **Relay v31 (`relay_fibres.py`):** `POST /api/fibres {stem, live?, refresh?}` and `POST /api/fibre {stem, fibre}`. E2E and Uni-dir results from the run logs (only this cable's files are opened, by file name); OTDR and iOLM from finished FMS bulk Tasks (each route's output: length, loss, time), read once in the background and kept; per wavelength iOLM loss and stored results from the FMS results API when a fibre is opened. Looks back 90 days (`FIBRES_DAYS`), up to 300 Tasks (`FIBRES_MAX_TASKS`). Names, not emails.
- **Real time:** the screen asks the relay every 4 s for what is happening on the cable now: E2E runs (results as they come), Uni-dir from phones and the desktop (confirmed, Dis. and crossed fibres as they are marked), and running Tasks. Fibres under test pulse; a strip above the grid says who is testing what. The stored results refresh every minute.
- **Apps:** Uni-dir (phone and desktop) now send the confirmed fibre list with their progress and in the saved session, so the Fibres screen can show them fibre by fibre. The desktop Uni-dir also sends progress like the phone.
- Fibres button appears once the relay is v31. Help has a "Cable health check (Fibres)" section and a Release notes tab with a short list of what changed in each version (Alkis, 7 Oct).
- One Light or Dark button: it shows only the mode you can switch to, on the desktop header and the phone start screen (Alkis, 7 Oct).
- Tests: test_fibres 24 (stand in GitHub log store and FMS results in the mock), ui_fibres 17.

## v36 — 7 October 2026 — Phone Run history opens on Today, desktop header on one line

App only (relay stays v30). Alkis: the phone Run history started on the last 30 days and took a while to load.
- Desktop: the header stays on one line on laptop screens (it wrapped once Alerts was added in v35). The new Fibres screen (step 4.3) is in the page but its button stays hidden until the relay serves it (relay v31).
- Opens on Today (relay asked for 1 day, rows from before midnight dropped), like the desktop since v32. 7, 30 and 90 days still in the list.
- The last list shows at once on the next open while it refreshes (sessionStorage `rft.mhist.<days>`), and Today is fetched in the background about 6 s after the app opens.
- Tests: ui_v36m 7.

## v35 + relay v30 — 7 October 2026 — Notifications on the phone and the browser

Step 4.2. Not Teams: a notification on the device, even with the app closed.

- **What you hear about (only your own):** your E2E run ends (complete, stopped, failed, with the straight / crossed / DIS line); your FMS bulk Task ends (finished, failed, cancelled, with fibres done; also Tasks started in FMS itself, matched by creator); an RTU you asked about is free (no Task, E2E run or tone on it); FMS stops answering during your run, and when it is back.
- **Phone:** Alerts row on the start screen (Turn on, Test). On iPhone the app must be added to the Home Screen first; the row says so. E2E start on a busy RTU now offers "Get a notification when it is free?". The busy check also matches Tasks by RTU id (live FMS often gives no RTU name).
- **Desktop:** Alerts button in the header (on / off, test, the RTUs you are waiting for), and "Tell me when free" under a busy RTU and in the E2E busy warning.
- **Relay v30 (`relay_push.py`):** Web Push done with `cryptography` (RFC 8291 / 8292), checked against the http_ece reference. `GET /api/push/key`, `POST /api/push/subscribe|unsubscribe|test|watch|unwatch|status`. Background watcher every 30 s reads running FMS Tasks with a signed in session. Devices and watches kept in `config/push-devices.json` in the run log repo, so a restart keeps them. Off until `VAPID_PRIVATE_KEY` is set in Render.
- `push.js` shared by both pages; `sw.js` shows the notification and a tap opens or focuses the app (Tasks and free RTUs go to the desktop page).
- Tests: test_push 25 (relay, decrypted with http_ece), ui_v35 20 (phone and desktop, push service stubbed), sw_test 6, FMS down / back check.

## v34 + relay v29 — 6 October 2026 — Live screen, Dark glass, short names, No signal banner

- **Live** is the desktop's first screen: the Reach route with every RTU light (the cable pulses purple while something runs on it), a card for each E2E run (live ribbon grid), Uni-dir tone (the fibre the tester is on, toning or waiting, confirmed / DIS / crossed) and bulk Task, who is online (e.g. "Phone · Tone on SNBC2") and what finished today. Click a card or an RTU to open it in the console. Updates every 5 seconds.
- **Light or Dark glass** on the phone (start screen) and desktop (header), remembered per device. Dark is smoky frosted glass over a deep indigo background with soft coloured light.
- **Short names**: RTUs show as the team says them (RGAC2, SGIC2), the full name on hover; cables drop the "-R432".
- **Phone: No signal banner** when the connection drops ("No signal. Waiting to reconnect… Nothing you have done is lost."), gone as soon as the service answers.
- **Phone sends its Uni-dir progress** every few seconds (and at once when a tone starts or ends) for the Live screen; leaving the cable or finishing clears it.
- Relay v29: `POST /api/uni/live` (phone progress) and `POST /api/live` (people, E2E runs with their grid, Uni-dir sessions, bulk Tasks, toning RTUs). Relay deploy signs everyone out.

---

## v33 (app only, relay stays v28) — 6 October 2026 — updates show straight away, richer Glass

- **No more stale screens**: the app pages now come from the network first (the offline copy is only used with no signal), and a new version takes over and reloads once by itself. On 6 Oct phones kept showing v31 after v32 went live because the old offline copy was served first. The desktop page now checks for updates the same way.
- **Glass look richer** on desktop and phone: more colour in the middle of the screen and more see-through panels, so Tasks and Bulk Test look frosted like E2E and Tone.
- **Desktop sign in page shows the version** (desktop v33).
- App only: no sign out.

---

## v32 + relay v28 — 6 October 2026 — native desktop E2E and Tone, faster Run history

- **E2E Continuity on the desktop** is now built for the desktop instead of the phone screen inside a frame. Ends card (tone from the picked RTU, OTDR from the far end, Swap), ribbon picker, pace under Advanced, time estimate and a busy warning. The run view shows a live results grid (green straight, amber crossed with the fibre it lands on, red DIS or not found, purple outline testing now), counts, findings, activity log, Pause, Stop with a confirm, Resume from here, and a CSV export. A run already going on the cable opens straight away. Same relay calls as the phone (`/api/continuity/start|status|control|jobs`).
- **Tone (Uni-dir) on the desktop**: big current fibre with its colour, countdown, START / NEXT / Back / Repeat, DIS, Crossed and Note, keyboard keys, the whole 432 fibre map (click a fibre to tone it), scope All / Odd / Even / Range, tone settings, location, Finish saves to Run history (`/api/history/add`), copy report. Progress kept per cable and RTU end in this browser.
- **Run history** opens on **Today**, has "App runs only" for the quickest load and a Refresh button, and shows the last list at once while it refreshes. Today's list is fetched in the background after sign in.
- **Relay v28**: Run history no longer reads the detail of FMS Tasks older than the period asked for (the search is newest first, so it stops there), and asks FMS for fewer Tasks for short periods (20 for a day, 40 for a week, 60 beyond).
- **New look for the whole desktop console** (Alkis asked for a cleaner, Tesla style): white header, grey background, white cards without borders, one blue for actions, large light numbers, segmented tabs, Manrope font. Light colours unchanged (green available, purple testing, grey offline).
- **Glass look** (Alkis's pick): frosted see-through panels over soft pastel light, on the desktop and the phone, and it is the default. Desktop: Look switch under the light key (Glass or Clean). Phone: Look switch on the start screen (Glass or the original Dark), remembered per phone. Light colours unchanged.
- Phone fix: the current fibre card no longer gets squashed on a short phone when a banner shows.
- **Uni-dir tones only on START, NEXT or Repeat** (phone and desktop). Opening a cable, picking a ribbon, tapping a fibre or Back just moves there and the button reads START (Alkis, 6 Oct: it was toning the first fibre of a ribbon as soon as the ribbon was picked).
- **Simpler wording** (Alkis, 6 Oct): Tasks read e.g. "iOLM · Fast F1 · 1550 nm" or "OTDR · 1550 nm · 5 s" (no FMS test limit number, no "auto"), progress reads "20 of 30 fibres done", the RTU line shows only its state, and pace, version and run id detail are gone from the E2E, Tone and history screens.
- Desktop Tone buttons lock the moment NEXT is pressed, so a double press cannot skip a fibre.
- Desktop: Tasks and lights refresh every 5 seconds while the page is open (was 15 s), and an RTU sending a Uni-dir tone shows purple "tone" (relay v28 marks it, from the phone or the desktop).
- **Desktop users without a restart** (relay v28): add emails to `config/desktop-users.json` in the run log repo (`Motion-Rail/relay-logs`), as `{"users": ["name@motionrail.co.uk"]}`. The relay rereads it every minute. The `DESKTOP_USERS` setting still works.
- Relay deploy signs everyone out, so deploy when nobody is testing.

---

## v31 (app only, relay stays v27) — 6 October 2026 — desktop Help, simpler Start

- **Help** button in the desktop header: quick guide and overview (what it is, RTU list and light key, RTU tabs, starting a bulk test, Run history, who is online).
- **Start** now does the FMS check itself (every fibre exists on that RTU, Tasks built, nothing started), then shows one summary (fibres, settings, Tasks, time, anything already running, comment) and starts on OK. The separate "Check with FMS" button is gone.
- **Default comment**: the RTU and fibres under test, e.g. "RGAC2 F061-F063", kept up to date until you type your own.
- **Header**: Console and Run history only. Bulk Test lives in the RTU tabs (the header button was a duplicate).
- **Cables start collapsed** every time the page opens.
- App only: deploying it does not restart the relay or sign anyone out.

---

## v30 (app) + relay v27 — 6 October 2026 — desktop lock, RTU lights, Bulk Test builder, Run history

### Relay v27
- **Desktop lock:** `DESKTOP_USERS` (comma separated emails, default Alkis only; `*` = everyone). `/api/tasks`, `/api/tasks/cancel`, `/api/bulk/plan`, `/api/bulk/start` and `/api/rtus` answer 403 "Desktop console not enabled for your account" to anyone else. `POST /api/desktop/access` says whether the signed in user may use it. The mobile app is not affected.
- `POST /api/rtus {names:[...]}`: each RTU's FMS attach state (online, attachStatus, site, model), its RtuId and cable stem, from one route of that RTU, cached 60 s.
- Run history: a cancelled FMS Task (TERMINATED) now reads "Cancelled after X of N" instead of Failed or Pass.

### Desktop
- **Fix:** live FMS gives a Task only its RtuId (the relay showed "RTU 25179"), so running Tasks never matched an RTU and the lights and Tasks tab stayed empty. Tasks are now matched by RtuId from `/api/rtus`.
- RTU lights (Alkis's colours): green available, purple testing (FMS bulk Tasks or an E2E run using that RTU at either end), grey offline or not in FMS, hollow grey ring while checking; key below the list; FMS state in the tooltip and next to the RTU name; a note above the list when FMS or the service is not responding.
- Cables expand and collapse (remembered), with Collapse all / Expand all; a collapsed cable still shows both RTU lights.
- Header buttons work: Console (RTU tabs), Bulk Test (builder), Run history.
- **Bulk Test builder:** ribbons, typed ranges (61-72, 80), All / Odd / Even / Clear; OTDR or iOLM; wavelengths 1310 / 1550 / 1625; OTDR duration, automatic or set pulse and range, analysis thresholds; iOLM test limit and Standard / Fast F1 / RTU Connection; comment; time estimate; busy and offline warnings; Check with FMS then Start.
- FMS was seen running two Tasks on one RTU together, so the Tasks tab shows each as Running or Waiting rather than a strict queue.
- **Run history:** E2E, Uni-dir and FMS bulk runs (incl. cancelled), filters by result, type, RTU and person, 7 / 30 / 90 days, detail panel, CSV.
- Shown only to accounts on `DESKTOP_USERS`; others see "Desktop console not enabled" and a link to the mobile app.

---

## v29 (app) + relay v26 — 6 October 2026 — desktop console: RTU modules, Tasks with cancel, bulk start (deployed 6 Oct 2026, app 685f9c7, relay 3e3d062)

### Relay v26 (`relay_bulk.py`, new)
- `POST /api/tasks`: every FMS bulk Task RUNNING (from anyone), grouped by RTU (`rtuId`, `rtuName`), in start order with queue position, state (testing / queued / starting), done / testing / waiting and each fibre's state; recent finished Tasks; the relay's cancel records.
- `POST /api/tasks/cancel`: Conductor terminate `DELETE /workflow/{id}?reason=`. Own Tasks straight away; someone else's needs `confirmOwner` (= their creator name) unless `CANCEL_POLICY=own`, which allows own only. Each cancel is kept in memory and, with `LOG_REPO`, written as `runs/<day>/..._CANCEL_<id>.json`, because FMS's Tasks page hides TERMINATED Tasks.
- `POST /api/bulk/plan` (nothing started) and `POST /api/bulk/start`: the same Task input the FMS screen sends. OTDR: one Task per wavelength (1310 / 1550 / 1625), duration, auto or pulse (FMS list, 5 ns to 20 µs) and range (km), thresholds. iOLM: test limit, Standard iOLM / Fast F1 (`FastOvwNode`) / RTU Connection (`FastOvwNode;RequiredDynamicRange_dB=14`), wavelength list. Returns the time estimate, busy Tasks on the RTU and queue position.
- `GET /api/bulk/options`.
- Proven live on 6 Oct 2026 from a local copy of the relay: Tasks list; 3 fibre OTDR on RGAC2 F061 to F063 started and cancelled after 1 fibre (F062 cancelled, F063 never started); 1 fibre iOLM Fast F1 started and completed.

### Desktop page (`desktop.html`, new)
- Sign in shared with the mobile app. Header: screens, who is online, Mobile view, Sign out.
- Cables and RTUs down the side with idle / running / queued badges (every 15 s).
- Per RTU modules as tabs: **Tasks** (progress, queue, Cancel with a confirm naming whose Task it is, cancelled recently), **Bulk Test** (builder next), **E2E Continuity** and **Tone (Uni-dir)** (the mobile screens opened inside the tab, preset to the RTU and cable).
- `?relay=http://127.0.0.1:8770` points the page (and the embedded mobile screens) at a local relay for checks.

### Mobile app (`index.html`)
- `?embed=1&mode=e2e|uni&cable=&rtu=` opens straight into E2E (tone from that RTU) or Uni-dir (that cable from that RTU), with sign out and back buttons hidden. `?relay=` override for the browser tab. Otherwise unchanged.

---

## v28 (app) + relay v25 — 3 October 2026 — who is online, run history, finish alert, housekeeping

### Who is online
- A button in the header of the start screen, the Uni-dir screen, the E2E screen and the history
  screen shows how many people are signed in and how many tests are running ("2 online · 1 running").
- Tap it for the list: each person, what they are doing (screen, cable, RTU) and when last seen;
  E2E runs on the relay (owner, RTUs, progress); FMS bulk Tasks RUNNING on FMS from anyone,
  including tests started in the FMS screen (type, RTU, owner, progress).
- E2E start warns when one of its RTUs is already busy (an E2E run, an FMS bulk Task, or someone
  toning from it in Uni-dir) and asks before starting.
- The app sends a heartbeat every 30 s (90 s when hidden); people drop off after 2 minutes.
  Sign out removes you at once. Single ad hoc tests started straight from the FMS screen create
  no Task, so they cannot be seen.
- Relay: `POST /api/presence` (heartbeat + list), `POST /api/presence/leave`.

### Run history
- New "Run history" option on the start screen. Rows from the relay's run logs (every E2E run,
  and Uni-dir sessions from this version on) and from FMS bulk iOLM / OTDR Tasks.
- Filter by test type, RTU, owner and result (Pass, Issues found, Part done, Failed, Stopped,
  Running); 7, 30 or 90 days; tap a row for the detail (counts, crosses, DIS, site check, OTDR
  method, versions); CSV export of what is shown.
- Uni-dir: FINISH saves the session (cable, RTU, location, scope, confirmed, DIS, crossed) to the
  log store. Pressing FINISH again updates the same entry.
- Owners shown by name: FMS creator names and sign in emails are matched to one spelling.
- Old one-fibre "continuity" OTDR Tasks (before relay v24) are left out of the FMS rows.
- Relay: `POST /api/history`, `POST /api/history/add` (new module `relay_team.py`).

### Finish alert
- When an E2E run ends the app now plays a short chime (rising when complete, falling when stopped
  or failed) as well as the phone or browser notification and vibration, and flashes the tab title
  if the page is in the background. "Sound when a run ends" in E2E Advanced turns the chime off.
- The Teams card at run end is unchanged.

### Housekeeping
- Relay no longer allows the retired `https://tone-tester.onrender.com` origin, even if APP_ORIGIN
  still lists it.
- The relay version reported on run screens and in run logs was stuck at v23 (a second constant in
  `relay_continuity.py`); both now read v25.
- Still to confirm on live after deploy: runs go `via adhoc` (shown in each history row's detail),
  and the Teams card and run log arrive.

Tested on the local mock FMS and GitHub store: presence with two users and a running FMS Task,
busy RTU warning, history with E2E, Uni-dir and FMS iOLM / OTDR rows and every filter, Uni-dir log
add and update, no browser errors.

---

## v27 (app) + relay v24 — 1 October 2026 — ad hoc OTDR (no FMS Task per fibre), Neos logo

EXFO reported that every OTDR the tester ran created a Task in FMS (the Conductor
bulk workflow), which can affect system performance. The relay now uses the ad hoc
call the FMS UI uses for Test On Demand > Start Test (captured 1 Oct 2026).

### Relay v24
- Start: `POST /api/topology/control/remotetestunits/{rtu}/command/opticalroutes/{route}/otdr`
  with the UI's payload (1550 nm, our duration, auto settings). Returns a promise id. No Task.
- Outcome: the relay listens on the FMS push channel (STOMP over SockJS websocket,
  `/api/topology/ws/connection`, topic `/topic/monitoredassets/{route}/testsetups/adhoc/message/{promise}`)
  and also polls `/api/measure/v1/results` for the stored result. Whichever answers first wins.
- Live fibre refusal ("Live fiber detected.") only arrives as a push; it still counts as a PASS.
- Link length from `brief.LinkResults.Length` (metres); FMS TestTime (UTC) used for the late start check.
- If the push channel cannot connect, that one test falls back to the old workflow call so a
  refusal is never missed. Each test log entry records `via` (adhoc or workflow).
- `OTDR_MODE=workflow` in Render switches everything back to the old path. `/health` shows `otdrMode`.
- New dependency: `websockets`.

### App v27
- Neos Networks logo beside the Motion logo on the sign in screen.

### Verified (mock FMS)
- R1 crossed with R7: 12/12 found, 26 ad hoc OTDRs, 0 workflows, timing the same as v26.
- Push channel down: falls back to workflow, result correct.

---

## v26 (app) + relay v23 — 29 September 2026 — whole ribbon dark: crossed ribbon or bundle first, and say so

Alkis, after R1 read completely dark on 29 Sep evening (R3 and R35 fine): if a whole ribbon is dark it could be a
crossed ribbon, so check the ribbons either side, then a crossed bundle, so check the same ribbon in the next bundle.
The activity log must state these steps so users know what the issue is and what the search is doing.

Engine (relay v23)
- The first 4 fibres of a ribbon all dark on their own positions: the search stops and checks the whole ribbon with
  one fibre: the ribbon reversed, the ribbon either side (and reversed), then the same ribbon in the next and the
  previous bundle (and reversed). Each check is written to the log ("F001 on F013 R2 f1: R1 crossed with R2?").
- Found: the pattern (for example "bundles 1 and 2 crossed") is applied to the rest of the ribbon, each fibre
  confirmed with one test; a fibre that does not follow it is searched on its own. Partners are swap checked.
- Not found: the rest of the ribbon is tested on its own positions. If still nothing gets through, the check is
  repeated with two more fibres, then the ribbon is reported as disconnected, not crossed, with the next steps:
  check the patching at both ODFs and the ribbon splices; if other ribbons are also all dark, check the tone RTU
  and FMS first. Two ribbons in a row completely dark gives a warning to check the tone RTU and FMS.
- Only the first two fibres of a dark ribbon get the 30 s distance OTDR.

App v26
- The run screen shows the current search step from the log (ribbon checks, warnings, FMS state) under the
  now testing line, highlighted red for warnings and a disconnected ribbon.

Simulator (tests; all answers correct): R1 dark 39 (v17 search 1308); R1 and R2 dark 51; R1/R2 crossed 21;
R1/R7 bundle crossed 23; R1 reversed 20; straight, pair, DIS and cross-ribbon cases unchanged.
Mock FMS: R1/R7 crossed: found on the 4th probe test, all 12 placed in 23 tests with the log above.

## v25 (app) + relay v22 — 29 September 2026 — FMS outages, accurate DIS distance

Why: at 18:23 on 29 Sep FMS returned "503 Service Temporarily Unavailable" on tone calls and left OTDR
workflows running; the R1 run read every fibre dark. And the 3 s OTDR readings on long dark fibres were short
(R1: 61.4 to 64.6 km on a 70.6 km route), so a far-end DIS would have been placed mid-route.

Relay v22
- FMS outage: a tone call refused with 5xx, an OTDR that hangs past 90 s or gives no output, a 5xx on OTDR start,
  or any connection error, is FMS being down, not a fibre result. The run waits (15 s, then every 60 s) and retries
  the same test. Nothing is marked while FMS is down. Gives up after 2 h (run fails, resumable).
  Status carries fmsDown {since, reason, retries}; /health carries fms {ok, since, detail} from the last real call.
- DIS distance: each DIS fibre gets one 30 s OTDR (no tone needed) for the distance to its open end. Location uses
  that reading ("30 s OTDR"); without it the 3 s readings are used and flagged "quick 3 s reading; beyond about 55 km
  it can read short".

- Break location is distance only (Alkis): "stops 15.12 km from SNBC", straight from the FMS OTDR, measured from
  the test RTU's site. The joint schedule (route_schedules.json) is removed, so nothing needs updating when routes
  change.

App v25
- Run screen: "FMS not responding since HH:MM. Retrying every minute; nothing is marked until FMS answers, and the
  run carries on by itself."
- Sign in screen: "Service online, but FMS is not responding since HH:MM" when the relay last saw FMS fail.
- DIS map cell shows how the distance was measured.

Tests (mock FMS with a switchable 503 outage): R1 run, outage switched on at 3/12 for 75 s: run waited, health showed
FMS not OK, no fibre marked; FMS back, run carried on and finished 12/12 with the F005/F007 swap and F010 DIS
located from the 30 s OTDR. Simulator: 0 wrong across all fault types.

## v24 (app) + relay v21 — 29 September 2026 — break location, restart-proof runs, run-end notices

1. Where a DIS fibre stops (relay break_locator.py + route_schedules.json)
- Every dark OTDR's link length is now kept (testLog lenM). For a DIS fibre the far RTU's OTDR on its own
  position reads the distance to the open end. The median reading is matched to the joint schedule
  (Distances.xlsx rev 1.2, NRS-304, both directions, per ribbon group, Actual then Design):
  within 150 m of 0 = near-end ODF/patch; within 150 m of the route total = far-end ODF/patch;
  within 150 m of a location = "at A-21 (+7 m)"; otherwise "between A-21 and Baulking REB (614 m past A-21)".
- Shown in the findings, the map cell, Copy text, PDF (new DIS section) and CSV (3 new columns), and in the
  Teams message. Other cables need their schedules added to route_schedules.json.

2. Runs survive a relay restart
- The relay saves each run to the log store every 60 s and on shutdown. On start up it restores runs that
  were in progress as "interrupted", with every finished fibre.
- The app carries on by itself: after the restart it asks for sign in once ("Nothing is lost"), then resumes
  the same cable and ribbons, carrying every finished fibre over. The old run points to the new one.
- A resume now checks the sign in before creating anything (no half-made runs holding the RTUs).

3. Notices when a run ends
- Teams: set TEAMS_WEBHOOK on the relay (a Teams Workflows "post to a channel when a webhook request is
  received" URL). Card: cable, ribbons, result counts, crosses, DIS with location, tests, minutes, who ran it,
  and an Open Reach Fibre Tester button. Off when unset.
- App: phone or browser notification (permission asked when a run starts) and a vibrate when it ends.

Tests (mock FMS + fake GitHub + fake Teams): R1 run stopped by killing the relay at 3/12 (checkpoint and
shutdown save both worked), restored as interrupted, app asked for sign in, resumed at 3/12 and finished
12/12: F005/F007 swap, F010 DIS "stops about 15.12 km from SNBC, between A-21 and Baulking REB (614 m past
A-21)", Teams card sent. Locator checked against the schedule: 68899 m on R35 = far end (RGAC2 ODF or patch),
12 m = SNBC ODF, 15120 m = A-21 (+7 m).

## v23 — 29 September 2026 — uni-dir does not tone on open (app only)

Alkis: the uni-dir checker fired a tone as soon as a cable was opened.
- Opening a cable only loads it ("Ready. Press START to tone F001"). The NEXT button reads START until the first tone;
  pressing it tones the current fibre, then it works as NEXT as before. Tapping a fibre on the grid still tones it.
Checked on the mock: no tone call after opening, one tone call after START. Relay unchanged (v20).

## v22 — 29 September 2026 — interface tidy (app only)

Alkis's review: the Motion logo rendered badly on phone and web, a "Setup" box top right did nothing, too much
technical wording, token text on sign in, and the relay settings were not needed.
- Logo: new logo-light.png (trimmed, lighter teal for the dark theme, larger). The clipped "M" mark in headers is
  replaced by the full logo, hidden on phones where the header is tight.
- Sign in: "Sign in with your EXFO FMS account." Token wording removed. Username field is an email field.
  "Relay settings" replaced by a connection check: "Service online", or "Can't reach the service. Check signal;
  retrying…" (checks every 15 s until it answers).
- Service address and key are fixed in the app; no user setting (the uni-dir settings sheet lost its Advanced
  relay URL / app key fields; "Test relay" is now "Check connection").
- E2E: the Setup pill is gone (the status pill shows only while running or after a run); header subtitle shows the
  cable; shorter find, ribbon and estimate text; the Smart search paragraph and the Advanced tuning note removed;
  "Runs on the relay" is now "Recent runs".
- E2E run: short ends line (Tone RGAC2 → OTDR SNBC · R35); now testing line without the long route names; Not found
  tile only shows when there is one; pace/version line hidden (still in the debug report); "Fibre map" with a
  shorter key; Activity log folded away; "Email to Alkis" is now "Email report".
- Wording that mentioned the relay now says "service" or "connection".
Relay unchanged (v20). A server side FMS reachability check needs a relay release; left until site testing ends.

## v21 — 29 September 2026 — planted-fault record is optional (app only)

Alkis: testers in the field will not know whether a result matches the site; only a trial with planted faults does.
- The after-run panel is folded away as "Trial run? Record the planted faults". Normal runs need nothing.
- A note of what was planted is required before Result matched / Partly / Did not match. Saved with the run log.
Relay stays v20.

## v20 — 29 September 2026 — late start judged from FMS task times, run logs and feedback (app and relay)

Why: on the R35 trial (F412/F416 swapped, F409 DIS; found correctly in 22 tests, 11 min 10 sec) FMS was slow and
every dark OTDR took about 40 s. v18 judged "late" from when the result came back, so every dark fibre was
rechecked with a 20 s tone, about 4 min wasted. Alkis also asked for every run to feed back automatically.

Relay v20
- Late start: after a dark result the relay reads the sub workflow's task times from FMS, corrects for the FMS
  clock using the parent workflow start, and takes the longest task as the acquisition. A dark result is only
  rechecked if that acquisition started less than 1 s before the tone ended. Falls back to the old rule
  (result later than tone start + tone + 25 s) when task times are missing. testLog carries acqAfterToneS and,
  for the first 60 tests, the task timeline, so the rule can be checked on real runs.
- Run logs: when a run ends (done, stopped or failed) the full debug report is written to a private GitHub repo
  as runs/<date>/<date>_<hhmm>_<stem>_<ribbons>_<id>.json. Needs LOG_REPO and LOG_TOKEN on the relay; off otherwise.
- POST /api/continuity/feedback {jobId, verdict: correct|partly|wrong, notes, user}: stored on the run and the log
  file is rewritten with it. Status shows logSaved and feedback.

App v20
- "Did this match the site?" panel after a run: Correct / Partly / Wrong (Partly and Wrong need a note saying what
  is actually on site). Saved with the run log.
- Smart search help text describes the v18 search.

Mock FMS + fake GitHub: R1 with F005/F007 swapped and F010 DIS found in 19 tests; log file written at run end;
feedback rewrote it with verdict, notes, user and app version.

## v19 — 29 September 2026 — fibre IDs on the run screen (app only)

Alkis: while toning, the screen showed the fibre's position in the ribbon, not its ID.
- Map cells show the fibre ID (397 to 408 for R35) instead of 1 to 12. Crossed cells still show the far end fibre it landed on.
- The now testing line shows the toned and tested fibre IDs large, with ribbon/position, whether it is the own position or a cross check, and the full route names at each RTU.
Relay stays v18.

## v18 — 29 September 2026 — search follows physical fault logic (app and relay)

Why: first blind cross trial, R4 of F-RGAC-SNBC-A (F041/F042 swapped, F048 disconnected).
v17 found F041 on F042 but then spent 14 tests hunting F042 (its check of F041 read live once,
then a retest read dark), and 8 tests plus a second pass hunting F048 across other ribbons.
Alkis's rules: if A lands on B, check B on A at once; a fibre missing from an otherwise good
ribbon cannot be in another ribbon, so it is DIS after a few checks; only search other ribbons
when the ribbon itself is out of place.

Engine (relay)
- Ribbon by ribbon. Straight pass first: every fibre on its own position (one retry with a 20 s tone).
- Gap search: a fibre dark on its own position is tried only on the far ends in its ribbon that nothing
  has claimed, with a 20 s tone.
- Swap check: when A lands on B, B is tested on A straight away (20 s tone, up to 2 tries).
- DIS: not on any free far end and at least one fibre in the ribbon straight: 2 rechecks of its own
  position with a 20 s tone, then DIS ("no light at the far end").
- Ribbon out of place (no fibre straight): the v12 ladder (pattern, reversed, neighbour ribbons,
  bundles), without retesting the expected fibre. Second pass only for these.
- Leftovers: DIS or unplaced fibres are tried against free far ends in the other tested ribbons
  (learned pattern first), so a single fibre patched into another ribbon is still caught.
- Late FMS start: a dark result that arrives later than tone start + tone + 15 s is not trusted; it is
  retested once with a fresh 20 s tone. Counted as lateRechecks.
- New result state "dis", counted in status.counts.dis; resume carries DIS over.

App
- DIS tile and DIS cells on the map; findings, CSV, PDF and debug show DIS.

Simulator, 6 seeds each (tests per run, v18 against v17), all answers correct in v18:
R4 as trialled 19 against 124; single DIS 15 against 116; two DIS 20 against 220; pair swap 16 against 22;
fibre swapped into another ribbon 32 against 93; reversed ribbon 55 against 61; ribbons swapped 75
against 111; bundles swapped 377 against 593; mixed faults 595 against 684 (v17 got 1.2 wrong).
Mock FMS run: F005/F007 swap found in 3 tests each, F010 DIS in 4 tests, 21 tests for the ribbon.

## v17 — 28 September 2026 — long runs survive token expiry, resume (app and relay)

Why: the first full cable run (F-RGAC-SNBC-A, all 36 ribbons) stopped at F126 with
`401 Unauthorized` on a workflow status poll. The relay renewed the FMS token only between
tests, and one OTDR poll outlived it. F061 also sat in a 300 s wait before timing out.

Relay v17
- The token is renewed inside long polls: FMS calls ask the relay for a current token
  (at most 20 s old) and a 401 triggers one forced renewal and a retry.
- Sessions renew 150 s before expiry instead of 30 s.
- Any fault inside one test (401, 5xx, network) is logged as an error and the engine
  retries. It no longer ends the run. Status shows `testErrors`.
- OTDR wait limit 90 s (was 300 s). A stuck workflow now costs one test, not five minutes.
- Resume: `/api/continuity/start` takes `prior` (finished fibres) and `resumeOf`.
  Carried fibres keep their result and far end.

App v17
- "Resume from here" button on a stopped, failed or interrupted run. Starts a new run on
  the same cable, ribbons and settings, carrying finished fibres over.
- The last run snapshot is kept on the device, so Resume still works after a relay restart.

Checked on the mock FMS with a 20 s token, a 30 s OTDR and a 502 during a poll:
two 401s recovered silently, the 502 retried, run completed 24/24 with the planted cross
F005/F007 found; stop at 14 then resume finished the other 10 in 11 tests.

## v16 — 28 September 2026 — log times in local time (app only)

- The relay stamps activity log lines with its own clock, which is UTC. During BST the log read an
  hour behind (a run started at 21:59:52 showed 20:59:52). The app now converts each log time to
  the phone or PC's local time, in the Activity panel and in the debug email summary.
- Relay unchanged (v15). Deployed during a full-cable run; a static app update does not affect
  runs on the relay.
