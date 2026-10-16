/* Backup & Restore: progress + saved questions -> one code / link, restore it in any other browser.
   Everything happens in the browser; nothing is uploaded anywhere. */
(function () {
  var SAVED_KEY = "sscscholars_saved_v1";
  var EXTRA_KEYS = ["sscscholars_theme", "sscscholars_zoom_level", "sscscholars_profile_v1"];
  var PREFIX = "SSC1";

  function allowed(k) {
    if (k === SAVED_KEY || EXTRA_KEYS.indexOf(k) !== -1) return true;
    return /^sscscholars_hub_[^_]+_.+/.test(k) && k !== "sscscholars_hub_selection";
  }
  function isAttemptsKey(k) { return k.indexOf("sscscholars_hub_attempts_") === 0; }
  function isTestKey(k) { return k !== SAVED_KEY && EXTRA_KEYS.indexOf(k) === -1 && !isAttemptsKey(k); }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  /* ---------- collect / describe ---------- */
  function collect() {
    var d = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (allowed(k)) d[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return d;
  }
  function describe(d) {
    var tests = 0, done = 0, progress = 0, saved = 0, attempts = 0;
    Object.keys(d).forEach(function (k) {
      if (isAttemptsKey(k)) { var arr = parse(d[k]); attempts += Array.isArray(arr) ? arr.length : 0; }
      else if (k === SAVED_KEY) { var a = parse(d[k]); saved = Array.isArray(a) ? a.length : 0; }
      else if (isTestKey(k)) {
        var o = parse(d[k]); if (!o || !o.s) return;
        tests++;
        if (o.s.phase === "submitted") done++; else if (o.s.phase === "testing" || o.s.phase === "paused") progress++;
      }
    });
    return { tests: tests, done: done, progress: progress, saved: saved, attempts: attempts };
  }
  function summaryText(x) {
    return x.tests + " mock attempt" + (x.tests === 1 ? "" : "s") + " (" + x.done + " submitted, " + x.progress + " in progress), " + x.attempts + " past attempt" + (x.attempts === 1 ? "" : "s") + " for review and " + x.saved + " saved question" + (x.saved === 1 ? "" : "s");
  }

  /* ---------- encode / decode ---------- */
  function b64FromBytes(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function bytesFromB64(t) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    var bin = atob(t), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function streamBytes(bytes, Ctor, format) {
    var s = new Ctor(format);
    var w = s.writable.getWriter(); w.write(bytes).catch(function () {}); w.close().catch(function () {});
    return new Response(s.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function encode(d) {
    var json = JSON.stringify({ v: 1, t: Date.now(), d: d });
    var raw = new TextEncoder().encode(json);
    if (typeof CompressionStream === "function") {
      return streamBytes(raw, CompressionStream, "gzip").then(function (z) { return PREFIX + "G." + b64FromBytes(z); });
    }
    return Promise.resolve(PREFIX + "P." + b64FromBytes(raw));
  }
  function decode(text) {
    text = String(text || "").trim();
    var m = text.match(/restore=([^\s&]+)/);        /* a full link was pasted */
    if (m) text = m[1];
    text = text.replace(/\s+/g, "");
    var gz = text.indexOf(PREFIX + "G.") === 0, pl = text.indexOf(PREFIX + "P.") === 0;
    if (!gz && !pl) return Promise.reject(new Error("This is not a valid backup code."));
    var body = text.slice(PREFIX.length + 2), bytes;
    try { bytes = bytesFromB64(body); } catch (e) { return Promise.reject(new Error("The code looks incomplete or damaged. Copy it again completely.")); }
    var p = gz
      ? (typeof DecompressionStream === "function" ? streamBytes(bytes, DecompressionStream, "gzip") : Promise.reject(new Error("This browser cannot open compressed codes. Use a newer browser.")))
      : Promise.resolve(bytes);
    return p.then(function (u8) {
      var obj = parse(new TextDecoder().decode(u8));
      if (!obj || obj.v !== 1 || !obj.d || typeof obj.d !== "object") throw new Error("The code is damaged.");
      var clean = {};
      Object.keys(obj.d).forEach(function (k) { if (allowed(k) && typeof obj.d[k] === "string" && obj.d[k].length < 3000000) clean[k] = obj.d[k]; });
      return clean;
    }).catch(function (e) { throw new Error(e && e.message && /code|browser/i.test(e.message) ? e.message : "The code looks incomplete or damaged. Copy it again completely."); });
  }

  /* ---------- apply ---------- */
  function rank(o) {
    var s = o && o.s; if (!s) return -1;
    var base = s.phase === "submitted" ? 2 : (s.phase === "testing" || s.phase === "paused") ? 1 : 0;
    return base * 1e7 + (1e6 - (s.timeLeft || 0));
  }
  function mergeIn(d) {
    Object.keys(d).forEach(function (k) {
      var local = null; try { local = localStorage.getItem(k); } catch (e) {}
      if (isAttemptsKey(k)) {
        var la = parse(local) || [], lb = parse(d[k]) || [], m2 = {};
        la.concat(lb).forEach(function (e) { if (e && e.id) m2[e.id] = m2[e.id] || e; });
        localStorage.setItem(k, JSON.stringify(Object.keys(m2).map(function (id) { return m2[id]; })));
      } else if (k === SAVED_KEY) {
        var a = parse(local) || [], b = parse(d[k]) || [], map = {};
        a.concat(b).forEach(function (e) { if (e && e.id && (!map[e.id] || (e.at || 0) >= (map[e.id].at || 0))) map[e.id] = e; });
        localStorage.setItem(k, JSON.stringify(Object.keys(map).map(function (id) { return map[id]; })));
      } else if (EXTRA_KEYS.indexOf(k) !== -1) {
        if (local == null) localStorage.setItem(k, d[k]);
      } else {
        if (local == null || rank(parse(d[k])) > rank(parse(local))) localStorage.setItem(k, d[k]);
      }
    });
  }
  function replaceAll(d) {
    var rm = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (allowed(k)) rm.push(k); }
    rm.forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(d).forEach(function (k) { localStorage.setItem(k, d[k]); });
  }

  /* ---------- UI ---------- */
  var css = "#bkModal{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:16px;}" +
    "#bkModal.show{display:flex;}" +
    ".bk-box{background:#0a0a0a;border:1px solid rgba(255,255,255,.2);border-radius:12px;width:100%;max-width:640px;max-height:92vh;overflow:auto;padding:22px;color:#f2f2f2;font-family:Inter,system-ui,sans-serif;}" +
    ".bk-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}" +
    ".bk-head h3{font-family:'Space Grotesk',Inter,sans-serif;font-size:20px;}" +
    ".bk-x{background:transparent;border:1px solid rgba(255,255,255,.2);color:#9a9a9a;width:32px;height:32px;border-radius:6px;cursor:pointer;}" +
    ".bk-tabs{display:flex;gap:6px;margin-bottom:14px;}" +
    ".bk-tab{flex:1;background:transparent;border:1px solid rgba(255,255,255,.15);color:#9a9a9a;border-radius:6px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;}" +
    ".bk-tab.on{background:#fff;color:#000;font-weight:700;border-color:#fff;}" +
    ".bk-sum{font-size:13.5px;color:#cfcfcf;margin-bottom:10px;line-height:1.5;}" +
    ".bk-ta{width:100%;min-height:120px;background:#111;border:1px solid rgba(255,255,255,.2);color:#f2f2f2;border-radius:8px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:11.5px;word-break:break-all;resize:vertical;}" +
    ".bk-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}" +
    ".bk-btn{background:transparent;border:1px solid rgba(255,255,255,.3);color:#f2f2f2;border-radius:6px;padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;}" +
    ".bk-btn:hover{border-color:#fff;}.bk-btn.pri{background:#fff;color:#000;font-weight:700;}.bk-btn:disabled{opacity:.4;cursor:not-allowed;}" +
    ".bk-msg{margin-top:12px;font-size:13px;min-height:18px;color:#9a9a9a;line-height:1.5;}.bk-msg.ok{color:#4ade80;}.bk-msg.err{color:#f87171;}" +
    ".bk-note{margin-top:14px;font-size:12px;color:#6a6a6a;line-height:1.55;}.bk-pane[hidden]{display:none;}";

  var els = {}, curCode = "", parsed = null;

  function build() {
    if (document.getElementById("bkModal")) return;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var m = document.createElement("div"); m.id = "bkModal";
    m.innerHTML =
      '<div class="bk-box" role="dialog" aria-modal="true" aria-label="Backup and restore">' +
      '<div class="bk-head"><h3>Backup &amp; Restore</h3><button type="button" class="bk-x" id="bkClose" aria-label="Close">&#10005;</button></div>' +
      '<div class="bk-tabs"><button type="button" class="bk-tab on" id="bkTabMake">Create backup</button><button type="button" class="bk-tab" id="bkTabRestore">Restore</button></div>' +
      '<div class="bk-pane" id="bkPaneMake">' +
        '<div class="bk-sum" id="bkMakeSum"></div>' +
        '<textarea class="bk-ta" id="bkCode" readonly placeholder="Preparing code..."></textarea>' +
        '<div class="bk-row"><button type="button" class="bk-btn pri" id="bkCopyCode">Copy code</button><button type="button" class="bk-btn" id="bkCopyLink">Copy link</button><button type="button" class="bk-btn" id="bkDownload">Download .txt</button></div>' +
        '<div class="bk-msg" id="bkMakeMsg"></div>' +
        '<div class="bk-note">Keep this code private: whoever has it can load your progress. Make a new code whenever you want to move the latest progress. Open this page in the other browser, tap Backup &rarr; Restore, and paste the code (or just open the link).</div>' +
      '</div>' +
      '<div class="bk-pane" id="bkPaneRestore" hidden>' +
        '<textarea class="bk-ta" id="bkPaste" placeholder="Paste your backup code or link here"></textarea>' +
        '<div class="bk-row"><label class="bk-btn" style="cursor:pointer">Load from .txt file<input type="file" id="bkFile" accept=".txt,text/plain" hidden></label></div>' +
        '<div class="bk-sum" id="bkRestoreSum" style="margin-top:12px"></div>' +
        '<div class="bk-row"><button type="button" class="bk-btn pri" id="bkMerge" disabled>Restore &amp; merge</button><button type="button" class="bk-btn" id="bkReplace" disabled>Replace everything</button></div>' +
        '<div class="bk-msg" id="bkRestoreMsg"></div>' +
        '<div class="bk-note"><b>Restore &amp; merge</b> keeps what is already in this browser and adds the backup (for each mock the more advanced attempt is kept; saved questions from both are combined). <b>Replace everything</b> deletes this browser\'s progress and saved questions first.</div>' +
      '</div></div>';
    document.body.appendChild(m);
    ["bkClose","bkTabMake","bkTabRestore","bkPaneMake","bkPaneRestore","bkMakeSum","bkCode","bkCopyCode","bkCopyLink","bkDownload","bkMakeMsg","bkPaste","bkFile","bkRestoreSum","bkMerge","bkReplace","bkRestoreMsg"].forEach(function (id) { els[id] = document.getElementById(id); });

    els.bkClose.onclick = close;
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    els.bkTabMake.onclick = function () { tab("make"); };
    els.bkTabRestore.onclick = function () { tab("restore"); };
    els.bkCopyCode.onclick = function () { copy(curCode, "Code copied.", els.bkMakeMsg); };
    els.bkCopyLink.onclick = function () { copy(linkFor(curCode), "Link copied.", els.bkMakeMsg); };
    els.bkDownload.onclick = function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([curCode], { type: "text/plain" }));
      a.download = "sscscholars-backup-" + new Date().toISOString().slice(0, 10) + ".txt";
      document.body.appendChild(a); a.click(); a.remove();
    };
    els.bkPaste.addEventListener("input", function () { check(this.value); });
    els.bkFile.addEventListener("change", function () {
      var f = this.files && this.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { els.bkPaste.value = String(r.result || "").trim(); check(els.bkPaste.value); }; r.readAsText(f);
    });
    els.bkMerge.onclick = function () { apply(false); };
    els.bkReplace.onclick = function () {
      if (confirm("This will delete the progress and saved questions currently in this browser and replace them with the backup. Continue?")) apply(true);
    };
  }

  function linkFor(code) { return new URL("index.html", location.href).href.split("#")[0] + "#restore=" + code; }
  function copy(text, okMsg, msgEl) {
    function done(ok) { msgEl.className = "bk-msg " + (ok ? "ok" : "err"); msgEl.textContent = ok ? okMsg : "Could not copy automatically. Select the code and copy it manually."; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    else fallback();
    function fallback() {
      var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove(); done(ok);
    }
  }
  function tab(which) {
    var make = which === "make";
    els.bkTabMake.classList.toggle("on", make); els.bkTabRestore.classList.toggle("on", !make);
    els.bkPaneMake.hidden = !make; els.bkPaneRestore.hidden = make;
    if (make) prepare();
  }
  function prepare() {
    var d = collect(), x = describe(d);
    els.bkMakeMsg.className = "bk-msg"; els.bkMakeMsg.textContent = "";
    if (!x.tests && !x.saved && !x.attempts) {
      els.bkMakeSum.textContent = "Nothing to back up yet. Attempt a mock or save a question first.";
      els.bkCode.value = ""; curCode = "";
      els.bkCopyCode.disabled = els.bkCopyLink.disabled = els.bkDownload.disabled = true; return;
    }
    els.bkMakeSum.textContent = "This backup contains " + summaryText(x) + ".";
    els.bkCode.value = "";
    encode(d).then(function (code) {
      curCode = code; els.bkCode.value = code;
      els.bkCopyCode.disabled = els.bkDownload.disabled = false;
      var tooLong = linkFor(code).length > 60000;
      els.bkCopyLink.disabled = tooLong;
      if (tooLong) { els.bkMakeMsg.textContent = "The code is too long for a link. Use Copy code or Download .txt."; }
    });
  }
  function check(text) {
    parsed = null;
    els.bkMerge.disabled = els.bkReplace.disabled = true;
    els.bkRestoreMsg.className = "bk-msg"; els.bkRestoreMsg.textContent = "";
    if (!String(text).trim()) { els.bkRestoreSum.textContent = ""; return; }
    decode(text).then(function (d) {
      var x = describe(d);
      if (!x.tests && !x.saved && !x.attempts) { els.bkRestoreSum.textContent = "This backup is empty."; return; }
      parsed = d;
      els.bkRestoreSum.textContent = "Found: " + summaryText(x) + ".";
      els.bkMerge.disabled = els.bkReplace.disabled = false;
    }).catch(function (e) {
      els.bkRestoreSum.textContent = "";
      els.bkRestoreMsg.className = "bk-msg err"; els.bkRestoreMsg.textContent = e.message;
    });
  }
  function apply(replace) {
    if (!parsed) return;
    try { if (replace) replaceAll(parsed); else mergeIn(parsed); }
    catch (e) { els.bkRestoreMsg.className = "bk-msg err"; els.bkRestoreMsg.textContent = "Could not write to browser storage (it may be full or blocked)."; return; }
    els.bkRestoreMsg.className = "bk-msg ok"; els.bkRestoreMsg.textContent = "Restored. Reloading...";
    els.bkMerge.disabled = els.bkReplace.disabled = true;
    setTimeout(function () { location.reload(); }, 700);
  }

  function open(which, prefill) {
    build();
    document.getElementById("bkModal").classList.add("show");
    tab(which || "make");
    if (prefill) { els.bkPaste.value = prefill; check(prefill); }
  }
  function close() { var m = document.getElementById("bkModal"); if (m) m.classList.remove("show"); }

  function init() {
    var btn = document.getElementById("backupBtn");
    if (btn) btn.addEventListener("click", function () { open("make"); });
    var m = location.hash.match(/^#restore=(.+)$/);
    if (m) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      open("restore", m[1]);
    }
  }
  window.SSCBackup = { open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
