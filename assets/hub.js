/* Full Mock Hub: lists every mock of the Mains file with status, start / resume / review */
(function () {
  var C = window.HUB_CONFIG, H = window.HubCommon;
  var YEAR = C.years[0], SUBJ = C.subjects[0].key;
  var G = window.AdminGate;
  var MODE_KEY = "sscscholars_hub_mode";
  function startMode() { var m = "live"; try { m = localStorage.getItem(MODE_KEY) || "live"; } catch (e) {} if (m === "vocab") return "vocab"; return (m === "test" && G.isAdmin()) ? "test" : "live"; }
  var VK = H.vocabCfg().key;   /* subject key used for vocabulary sets (own stats on the dashboard) */
  var S = { data: null, filter: "all", seq: 0, mode: startMode(), cache: {} };
  var FILTERS = [["all", "All"], ["ready", "Ready"], ["done", "Attempted"]];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec || 0)); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }

  function showNote(strong, rest, isErr, bar) {
    var n = $("note"); n.className = "note" + (isErr ? " err" : ""); clear(n);
    var sp = el("span"); sp.appendChild(el("b", null, strong)); if (rest) sp.appendChild(document.createTextNode(" " + rest));
    n.appendChild(sp);
    if (bar) { var b = el("div", "bar2"); b.appendChild(el("i")); n.appendChild(b); }
    n.hidden = false;
  }

  function mocks() { return (S.data && S.data.mocks) || []; }
  function setId(m) { return (m.live || m.vocab) ? m.id : "mock_" + m.mock; }
  function subjOf(m) { return m.vocab ? VK : SUBJ; }
  function startUrl(m) { return "test.html?y=" + encodeURIComponent(YEAR) + "&s=" + encodeURIComponent(subjOf(m)) + "&id=" + encodeURIComponent(setId(m)); }

  function renderStats() {
    var box = $("heroStats"); clear(box);
    var all = mocks(), ready = all.filter(H.mockReady), done = 0;
    ready.forEach(function (m) { var st = H.readStatus(YEAR, subjOf(m), setId(m)); if (st && st.kind === "done") done++; });
    var sum = ready.length ? H.mockSummary(ready[0]) : null;
    [[String(all.length), S.mode === "live" ? "Live tests" : S.mode === "vocab" ? "Vocab sets" : "Mocks in file"], [String(ready.length), "Ready to attempt"], [String(done), "Attempted"], [sum ? String(Math.round(sum.seconds / 60)) : "-", S.mode === "vocab" ? "Minutes per set" : "Minutes per mock"]].forEach(function (it) {
      var d = el("div", "hero-stat"); d.appendChild(el("b", null, it[0])); d.appendChild(el("span", null, it[1])); box.appendChild(d);
    });
  }

  function buildMode() {
    var seg = $("modeSeg"); clear(seg);
    [["test", "TEST"], ["live", "LIVE"], ["vocab", "VOCAB"]].forEach(function (f) {
      var b = el("button", null); b.type = "button";
      if (f[0] === "live") b.appendChild(el("span", "live-dot"));
      b.appendChild(document.createTextNode(f[1]));
      if (f[0] === "test" && !G.isAdmin()) { var lk = el("span", "lk", "\uD83D\uDD12"); lk.setAttribute("aria-label", "locked"); b.appendChild(lk); }
      b.setAttribute("aria-pressed", String(S.mode === f[0]));
      b.addEventListener("click", function () { setMode(f[0]); });
      seg.appendChild(b);
    });
    $("lockBtn").hidden = !G.isAdmin();
  }

  function setMode(m) {
    if (m === S.mode) return;
    if (m === "test" && !G.isAdmin()) {
      G.prompt().then(function (ok) { if (ok) applyMode("test"); else buildMode(); });
      return;
    }
    applyMode(m);
  }
  function applyMode(m) {
    S.mode = m; S.filter = "all";
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
    buildMode(); buildFilters(); load();
  }

  function buildFilters() {
    var seg = $("filterSeg"); clear(seg);
    FILTERS.forEach(function (f) {
      var b = el("button", null, f[1]); b.type = "button";
      b.setAttribute("aria-pressed", String(S.filter === f[0]));
      b.addEventListener("click", function () { S.filter = f[0]; buildFilters(); renderSheet(); });
      seg.appendChild(b);
    });
  }

  function renderSheet() {
    var sheet = $("sheet"); clear(sheet);
    if (!S.data) return;
    var list = mocks().filter(function (m) {
      var ok = H.mockReady(m);
      if (S.filter === "ready") return ok;
      if (S.filter === "done") { var st = ok && H.readStatus(YEAR, subjOf(m), setId(m)); return st && st.kind === "done"; }
      return true;
    });
    if (!list.length) { var e = el("div", "empty"); e.appendChild(el("b", null, S.mode === "live" ? "No live tests yet." : S.mode === "vocab" ? "No vocabulary sets yet." : "No mocks here yet.")); e.appendChild(document.createTextNode(S.mode === "live" ? "New live tests will appear here as soon as they are added." : S.mode === "vocab" ? "Sets are built automatically from the English questions of every mock. A new set appears after every 25 new vocabulary questions." : "Change the filter to see the other mocks.")); sheet.appendChild(e); return; }

    var cols = el("div", "cols");
    ["", "Mock", "Questions", "Duration", "Marks", "Status", ""].forEach(function (t) { cols.appendChild(el("span", null, t)); });
    sheet.appendChild(cols);

    var rows = el("div", "rows");
    list.forEach(function (m) {
      var ready = H.mockReady(m), sum = ready ? H.mockSummary(m) : null;
      var st = ready ? H.readStatus(YEAR, subjOf(m), setId(m)) : null;
      var row = el("div", "row"), bc = el("div", "bubcell"), bub = el("span", "bub" + (st ? " " + st.kind : ""));
      bc.appendChild(bub); row.appendChild(bc);
      var tn = el("div", "tname", (m.live || m.vocab) ? m.title : "Mock " + m.mock);
      if (m.vocab && m.cats) { var cs = Object.keys(m.cats).sort(function (a, b) { return m.cats[b] - m.cats[a]; }).slice(0, 4).map(function (k) { return k + " " + m.cats[k]; }).join(" \u00B7 "); if (cs) tn.appendChild(el("span", "tsub", cs)); }
      if (m.live && m.extracted) { var dd = new Date(m.extracted); if (!isNaN(dd)) tn.appendChild(el("span", "tsub", "Added " + dd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))); }
      row.appendChild(tn);

      var nums = el("div", "nums");
      var q = el("span", null, sum ? String(sum.questions) : "-"); q.setAttribute("data-u", "questions");
      var t = el("span", null, sum ? Math.round(sum.seconds / 60) + " min" : "-"); t.setAttribute("data-u", "");
      var mk = el("span", null, sum ? sum.mainMarks + " + " + (sum.marks - sum.mainMarks) : "-"); mk.setAttribute("data-u", "marks");
      nums.appendChild(q); nums.appendChild(t); nums.appendChild(mk); row.appendChild(nums);

      var stat, btn, startNew = false;
      if (!ready) { stat = el("div", "tstatus", "Questions not added yet"); btn = null; }
      else if (st && st.kind === "done") { stat = el("div", "tstatus done", "Scored " + st.score + " / " + st.max); btn = "Start new test"; startNew = true; }
      else if (st && st.kind === "progress") {
        var cfg = (C.mains.sections[st.sec] || {}).short || "";
        stat = el("div", "tstatus progress", "In progress: " + cfg + ", " + mmss(st.left) + " left"); btn = "Resume test";
      } else { stat = el("div", "tstatus", "Not attempted"); btn = "Start test"; }
      row.appendChild(stat);

      var acts = el("div", "acts");
      if (btn) {
        var a = el("a", "go", btn); a.href = startUrl(m) + (startNew ? "&new=1" : ""); a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a);
        var atts = H.getAttempts(YEAR, subjOf(m), setId(m));
        if (atts.length) {
          var sel = el("select", "att-sel"); sel.setAttribute("aria-label", "Review a past attempt");
          var ph = el("option", null, "Attempts (" + atts.length + ")"); ph.value = ""; sel.appendChild(ph);
          atts.forEach(function (at, i) { var o = el("option", null, "Attempt " + (i + 1) + " - " + H.fmtAttemptDate(at.at)); o.value = at.id; sel.appendChild(o); });
          sel.addEventListener("change", function () {
            var id = this.value; this.value = ""; if (!id) return;
            var u = startUrl(m) + "&attempt=" + encodeURIComponent(id);
            var w = window.open(u, "_blank", "noopener"); if (!w) window.location.href = u;
          });
          acts.appendChild(sel);
        }
      }
      row.appendChild(acts); rows.appendChild(row);
    });
    sheet.appendChild(rows);
  }

  function load() {
    var seq = ++S.seq, mode = S.mode;
    S.data = null; clear($("sheet")); renderStats();
    function done(json) {
      if (seq !== S.seq) return;
      S.cache[mode] = json; S.data = json; $("note").hidden = true; renderStats(); renderSheet();
    }
    if (S.cache[mode]) { done(S.cache[mode]); return; }
    showNote("Loading mocks.", "Please wait.", false, true);
    var p = mode === "vocab"
      ? H.loadVocabIndex()
      : mode === "live"
      ? H.loadLive(function (bytes) { if (seq === S.seq) showNote("Loading live tests.", (bytes / 1048576).toFixed(1) + " MB received", false, true); })
      : H.fetchSubject(YEAR, SUBJ, function (bytes) { if (seq === S.seq) showNote("Loading mocks.", (bytes / 1048576).toFixed(1) + " MB received", false, true); });
    p.then(done).catch(function (e) {
      if (seq !== S.seq) return;
      var d = H.describeError(e, YEAR, SUBJ); showNote(d.msg, d.sub, true, false);
    });
  }

  function init() {
    buildMode(); buildFilters(); renderStats();
    $("lockBtn").addEventListener("click", function () { G.lock(); if (S.mode === "test") applyMode("live"); else buildMode(); });
    function savedCount() { var n = H.countSaved(), b = $("savedCount"); if (b) b.textContent = n ? " (" + n + ")" : ""; }
    savedCount();
    function refresh() { savedCount(); if (S.data) { renderStats(); renderSheet(); } }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    window.addEventListener("storage", refresh);
    load();
  }
  init();
})();
