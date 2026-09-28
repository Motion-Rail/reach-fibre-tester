# Fibre Tone Tester — setup

Three parts: the **field app** (a web app the team installs to their phone),
the **relay** (a small service that holds your EXFO token and fires tones), and
your **EXFO calls** (login + tone — both now wired).

```
 phone (index.html)  ──►  relay (Render)  ──►  EXFO FMS cloud
   taps a fibre            holds token           Keycloak + tone
```

## What works right now (no deploy needed)
Open `index.html` on your phone and tap **Skip — try demo**. The whole flow runs
with tones simulated: route entry, 432 grid, ribbon rail, 1550/10s/1kHz presets,
Repeat, Off, Record issue, Next, and the end-of-run summary + copy report. Use
this to judge the field ergonomics before anything is deployed.

## Deploy the relay (Render)
1. Put the `relay/` folder in a Git repo (GitHub).
2. Render → New → **Web Service** → point at the repo → it reads `render.yaml`.
   (Or set Build `pip install -r requirements.txt`, Start
   `uvicorn main:app --host 0.0.0.0 --port $PORT`.)
3. Set env vars (see `relay/.env.example`). At minimum set a long random `APP_KEY`.
   Leave `LIVE_TONE=0` for now so it stays in simulation until resolution is wired.
4. After deploy, visit `https://<your-service>.onrender.com/health` — you should
   see `{"ok": true, ...}`.
5. Free-tier services sleep; the `starter` plan in `render.yaml` stays awake so the
   first tone of a shift isn't slow. (Confirm current Render plan terms — they change.)

## Point the app at the relay
In the app → **⚙ Settings** → paste the relay URL and the `APP_KEY`. Sign in with
your FMS credentials. The badge flips from **Demo** to **Live**. Login is real
immediately (Keycloak is fully wired); tones stay simulated until `LIVE_TONE=1`.

## Host the app (so the team can install it)
Any static host works (Render Static Site, Netlify, or a folder on your web space).
Serve the whole folder (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`).
On the phone: open the URL → Share → **Add to Home Screen**. It then behaves like
an app and works offline (the tone calls still need signal, of course).
Lock `APP_ORIGIN` on the relay to the app's URL once you know it.

## Name → OpticalRouteID — now wired
The tone request fires against an **OpticalRouteID**, not the fibre name. The relay
resolves this itself via the FMS GraphQL `searchOpticalRouteByRtu` operation
(`{TOPO_HOST}/topology/graphql/graphql`, matchType CONTAINS), paginated in pages of
50. On **Start toning** the app calls `/api/prime` with the route stem, which pulls
every fibre for that cable in one pass and caches name→id. Each tone then looks up
the id from cache (or lazily primes from the stem if needed). No further capture
needed.

## Going live
1. Deploy the relay; sign in from the app (login is already live).
2. On the relay, set `LIVE_TONE=1` and redeploy/restart.
3. Pick one fibre and tone it. If it works, you're done. If the `build` call returns
   404/400, the path wants a different id — set `TONE_ID_FIELD=rtuId` and retry
   (the resolver caches both `id` and `rtuId`).

## Two things to confirm on first live tone
- **Method** — `testsetup/build` is assumed `POST`; confirm in DevTools if it errors.
- **Modulation** — your capture showed **330 Hz / 5 s**; the app defaults to
  **1000 Hz / 10 s**. Set whichever your live-fibre detector expects in the app's
  Settings (330 is already proven to work on your source).

## Security notes
- EXFO credentials live only on the relay (env vars) or are entered per-user at
  login and exchanged for a token the relay keeps server-side. The EXFO token never
  reaches the phone.
- Keep `APP_KEY` set so only your app can call the relay.
- Sessions are held in memory; a relay restart just means signing in again.

## Continuity check (v12)
1. Deploy the `relay/` folder as before. It now includes `relay_continuity.py`,
   `continuity_engine.py` and `fms_continuity.py`; `requirements.txt` adds `requests`.
2. `/health` should show `"version": "v12"` and `"tone": "live"`.
3. Optional: `CONTINUITY_EXCLUDE=R35-36,F-XXXX-A-R432-F100` to fence off fibres carrying
   traffic. Excluded fibres are never toned or tested.
4. In the app: cable screen → **Continuity check, RTU to RTU**. Do a first live run on
   **R1 only** and watch it before running a whole cable.
5. A run lives on the relay. Redeploying or restarting the relay ends it; the app shows
   the results it last received.
