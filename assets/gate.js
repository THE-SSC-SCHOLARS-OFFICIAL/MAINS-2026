/* Admin gate for the TEST module. Soft lock only (browser side). */
(function () {
  var KEY = "sscscholars_admin_v1";
  var HASH = "b28f14d3423068273d24ef2d8772d2d7e39728d5cefe79387926dc372922bd77";

  /* compact SHA-256 (works on http/file too, where crypto.subtle is missing) */
  function sha256(str) {
    var m = unescape(encodeURIComponent(str)), l = m.length, w = [], i, j;
    var K = [], H = [], p = 0, c = {};
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (var cand = 2; p < 64; cand++) {
      if (!c[cand]) { for (i = cand * cand; i < 313; i += cand) c[i] = 1; if (p < 8) H[p] = frac(Math.pow(cand, .5)); K[p++] = frac(Math.pow(cand, 1 / 3)); }
    }
    m += "\x80"; while (m.length % 64 - 56) m += "\x00";
    for (i = 0; i < m.length; i++) { j = m.charCodeAt(i); w[i >> 2] |= j << ((3 - i) % 4) * 8; }
    w[w.length] = (l * 8 / 4294967296) | 0; w[w.length] = (l * 8) | 0;
    for (j = 0; j < w.length;) {
      var W = w.slice(j, j += 16), o = H.slice(0);
      for (i = 0; i < 64; i++) {
        var w15 = W[i - 15], w2 = W[i - 2], a = o[0], e = o[4];
        var t1 = o[7] + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & o[5]) ^ (~e & o[6])) + K[i] +
          (W[i] = i < 16 ? W[i] : (W[i - 16] + (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) + W[i - 7] + (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10))) | 0);
        var t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & o[1]) ^ (a & o[2]) ^ (o[1] & o[2]));
        o = [(t1 + t2) | 0].concat(o); o[4] = (o[4] + t1) | 0; o.pop();
      }
      for (i = 0; i < 8; i++) H[i] = (H[i] + o[i]) | 0;
    }
    var out = ""; for (i = 0; i < 64; i++) out += ((H[i >> 3] >> ((7 - i) % 8) * 4) & 15).toString(16);
    return out;
  }
  function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function hashOf(pw) { return sha256("sscscholars-admin-v1|" + norm(pw)); }

  function isAdmin() { try { return localStorage.getItem(KEY) === HASH; } catch (e) { return false; } }
  function tryUnlock(pw) {
    if (hashOf(pw) !== HASH) return false;
    try { localStorage.setItem(KEY, HASH); } catch (e) {}
    return true;
  }
  function lock() { try { localStorage.removeItem(KEY); } catch (e) {} }

  /* ---- modal ---- */
  var CSS = ".ag-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px}" +
    ".ag-box{width:100%;max-width:420px;background:#0a0a0a;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:30px 26px 24px;font-family:'Inter',system-ui,sans-serif;color:#f2f2f2}" +
    ".ag-ic{font-size:26px;margin-bottom:12px}" +
    ".ag-t{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;font-size:19px;letter-spacing:.5px;color:#fff;line-height:1.3}" +
    ".ag-s{font-size:13.5px;color:#9a9a9a;margin:10px 0 18px;line-height:1.55}" +
    ".ag-in{width:100%;background:#111;border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;font-family:'JetBrains Mono',monospace;font-size:14px;padding:13px 14px;outline:none}" +
    ".ag-in:focus{border-color:#fff}" +
    ".ag-err{min-height:18px;margin-top:8px;font-size:12.5px;color:#ff8a8a;font-family:'JetBrains Mono',monospace}" +
    ".ag-row{display:flex;gap:10px;margin-top:10px}" +
    ".ag-b{flex:1;font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11.5px;letter-spacing:1.4px;text-transform:uppercase;padding:13px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,.4);background:transparent;color:#f2f2f2}" +
    ".ag-b.p{background:#fff;color:#000;border-color:#fff}.ag-b:hover{opacity:.88}" +
    "@keyframes ag-sh{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}.ag-shake{animation:ag-sh .3s}";

  function prompt() {
    return new Promise(function (resolve) {
      if (isAdmin()) { resolve(true); return; }
      var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      var ov = document.createElement("div"); ov.className = "ag-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = '<div class="ag-box"><div class="ag-ic">\uD83D\uDD12</div>' +
        '<div class="ag-t">ONLY ADMIN CAN ACCESS THIS AT THIS MOMENT</div>' +
        '<div class="ag-s">The Test module is locked. Enter the admin passcode to continue. Live tests are open for everyone.</div>' +
        '<input class="ag-in" type="password" placeholder="Admin passcode" autocomplete="off" spellcheck="false">' +
        '<div class="ag-err" role="alert"></div>' +
        '<div class="ag-row"><button type="button" class="ag-b" data-x="c">Cancel</button><button type="button" class="ag-b p" data-x="o">Unlock</button></div></div>';
      document.body.appendChild(ov);
      var inp = ov.querySelector("input"), err = ov.querySelector(".ag-err"), box = ov.querySelector(".ag-box");
      function done(ok) { document.removeEventListener("keydown", onKey, true); ov.remove(); st.remove(); resolve(ok); }
      function submit() {
        if (tryUnlock(inp.value)) { done(true); return; }
        err.textContent = "Wrong passcode."; inp.value = ""; inp.focus();
        box.classList.remove("ag-shake"); void box.offsetWidth; box.classList.add("ag-shake");
      }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); done(false); } }
      document.addEventListener("keydown", onKey, true);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      ov.querySelector('[data-x="o"]').addEventListener("click", submit);
      ov.querySelector('[data-x="c"]').addEventListener("click", function () { done(false); });
      setTimeout(function () { inp.focus(); }, 30);
    });
  }

  window.AdminGate = { isAdmin: isAdmin, prompt: prompt, lock: lock };
})();
