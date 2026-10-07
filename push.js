/* v35: phone and browser notifications (Web Push) for the phone app and the desktop console.
   The relay sends them: my E2E run ends, my FMS Task ends, an RTU I asked about is free, FMS down and back.
   window.RFTPush: state(), enable(), disable(), test(), watch(rtuId, rtuName), unwatch(rtuId), resync(), isOn() */
(function () {
  "use strict";
  var KEY = "123456", LS = "rft.push", LIVE = "https://relay-eu-0t5v.onrender.com";
  function base() {
    var r = window.RFT_RELAY;
    if (!r) { try { r = sessionStorage.getItem("rft.relay"); } catch (e) {} }
    return String(r || LIVE).replace(/\/$/, "");
  }
  function ses() { try { return JSON.parse(localStorage.getItem("toneTester.session")) || {}; } catch (e) { return {}; } }
  function lsGet() { try { return localStorage.getItem(LS) === "1"; } catch (e) { return false; } }
  function lsSet(v) { try { localStorage.setItem(LS, v ? "1" : "0"); } catch (e) {} }
  async function call(path, body, get) {
    var h = { "X-App-Key": KEY }, s = ses();
    if (s.id) h["X-Session"] = s.id;
    if (!get) h["Content-Type"] = "application/json";
    var r = await fetch(base() + path, get ? { headers: h } : { method: "POST", headers: h, body: JSON.stringify(body || {}) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(j.detail || ("Relay answered " + r.status)); err.status = r.status; throw err; }
    return j;
  }
  function ios() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function standalone() { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } }
  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function device() {
    var u = navigator.userAgent;
    if (/iPhone/.test(u)) return "iPhone";
    if (/iPad/.test(u) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
    if (/Android/.test(u)) return /Mobile/.test(u) ? "Android phone" : "Android tablet";
    var b = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "Browser";
    return (/Windows/.test(u) ? "Windows " : /Mac OS/.test(u) ? "Mac " : "") + b;
  }
  function b64u(s) {
    var p = "=".repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function ready() {
    return Promise.race([navigator.serviceWorker.ready,
      new Promise(function (_, no) { setTimeout(function () { no(new Error("The app's offline helper did not start. Reload and try again.")); }, 8000); })]);
  }
  /* a subscription made with an older relay key will not work: drop it and make a new one */
  async function sub(r, k) {
    var s = await r.pushManager.getSubscription(), want = b64u(k.key);
    if (s && s.options && s.options.applicationServerKey) {
      var have = new Uint8Array(s.options.applicationServerKey), same = have.length === want.length;
      for (var i = 0; same && i < want.length; i++) same = have[i] === want[i];
      if (!same) { try { await s.unsubscribe(); } catch (e) {} s = null; }
    }
    return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
  }
  var keyCache = null;
  async function key() { if (!keyCache) keyCache = await call("/api/push/key", null, true); return keyCache; }
  async function current() { try { var r = await ready(); return await r.pushManager.getSubscription(); } catch (e) { return null; } }

  /* {code, text}: on, off, ios-home, unsupported, blocked, relay-off, signed-out */
  async function state() {
    if (!supported()) {
      if (ios() && !standalone()) return { code: "ios-home", text: "On iPhone, add the app to the Home Screen first (Share, Add to Home Screen) and open it from there." };
      return { code: "unsupported", text: "This browser cannot show notifications." };
    }
    if (Notification.permission === "denied") return { code: "blocked", text: "Blocked for this site. Allow notifications in the browser settings." };
    try { var k = await key(); if (!k.enabled) return { code: "relay-off", text: "Not set up on the relay yet." }; }
    catch (e) { return { code: "relay-off", text: "Relay not reachable." }; }
    var s = await current();
    if (s && lsGet() && Notification.permission === "granted") return { code: "on", text: "On for this " + device() + "." };
    return { code: "off", text: "Off. Turn on to hear when your runs and Tasks end." };
  }
  async function enable() {
    if (!supported()) throw new Error((await state()).text);
    if (!ses().id) throw new Error("Sign in first.");
    var p = await Notification.requestPermission();
    if (p !== "granted") throw new Error("Notifications were not allowed.");
    var k = await key();
    if (!k.enabled) throw new Error("Not set up on the relay yet.");
    var r = await ready(), s = await sub(r, k);
    await call("/api/push/subscribe", { sub: s.toJSON(), device: device() });
    lsSet(true);
    return state();
  }
  async function disable() {
    lsSet(false);
    var s = await current();
    if (s) { try { await call("/api/push/unsubscribe", { endpoint: s.endpoint }); } catch (e) {} try { await s.unsubscribe(); } catch (e) {} }
    return state();
  }
  /* after each sign in and on load: tell the relay this device belongs to whoever is signed in now */
  async function resync() {
    if (!lsGet() || !supported() || Notification.permission !== "granted" || !ses().id) return false;
    try {
      var k = await key(); if (!k.enabled) return false;
      var r = await ready(), s = await sub(r, k);
      await call("/api/push/subscribe", { sub: s.toJSON(), device: device() });
      return true;
    } catch (e) { return false; }
  }
  window.RFTPush = {
    state: state, enable: enable, disable: disable, resync: resync,
    isOn: function () { return lsGet() && supported() && Notification.permission === "granted"; },
    test: function () { return call("/api/push/test", {}); },
    status: function () { return call("/api/push/status", {}); },
    watch: function (rtuId, rtuName) { return call("/api/push/watch", { rtuId: String(rtuId), rtuName: rtuName || "" }); },
    unwatch: function (rtuId) { return call("/api/push/unwatch", { rtuId: String(rtuId) }); }
  };
  setTimeout(resync, 2500);
})();
