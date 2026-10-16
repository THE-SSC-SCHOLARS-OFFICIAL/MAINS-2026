/* Full Mock Hub: lists every mock of the Mains file with status, start / resume / review */
(function () {
  var C = window.HUB_CONFIG, H = window.HubCommon;
  var YEAR = C.years[0], SUBJ = C.subjects[0].key;
  var S = { data: null, filter: "all", seq: 0 };
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
  function setId(m) { return "mock_" + m.mock; }
  function startUrl(m) { return "test.html?y=" + encodeURIComponent(YEAR) + "&s=" + encodeURIComponent(SUBJ) + "&id=" + encodeURIComponent(setId(m)); }

  function renderStats() {
    var box = $("heroStats"); clear(box);
    var all = mocks(), ready = all.filter(H.mockReady), done = 0;
    ready.forEach(function (m) { var st = H.readStatus(YEAR, SUBJ, setId(m)); if (st && st.kind === "done") done++; });
    var sum = ready.length ? H.mockSummary(ready[0]) : null;
    [[String(all.length), "Mocks in file"], [String(ready.length), "Ready to attempt"], [String(done), "Attempted"], [sum ? String(Math.round(sum.seconds / 60)) : "-", "Minutes per mock"]].forEach(function (it) {
      var d = el("div", "hero-stat"); d.appendChild(el("b", null, it[0])); d.appendChild(el("span", null, it[1])); box.appendChild(d);
    });
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
      if (S.filter === "done") { var st = ok && H.readStatus(YEAR, SUBJ, setId(m)); return st && st.kind === "done"; }
      return true;
    });
    if (!list.length) { var e = el("div", "empty"); e.appendChild(el("b", null, "No mocks here yet.")); e.appendChild(document.createTextNode("Change the filter to see the other mocks.")); sheet.appendChild(e); return; }

    var cols = el("div", "cols");
    ["", "Mock", "Questions", "Duration", "Marks", "Status", ""].forEach(function (t) { cols.appendChild(el("span", null, t)); });
    sheet.appendChild(cols);

    var rows = el("div", "rows");
    list.forEach(function (m) {
      var ready = H.mockReady(m), sum = ready ? H.mockSummary(m) : null;
      var st = ready ? H.readStatus(YEAR, SUBJ, setId(m)) : null;
      var row = el("div", "row"), bc = el("div", "bubcell"), bub = el("span", "bub" + (st ? " " + st.kind : ""));
      bc.appendChild(bub); row.appendChild(bc);
      row.appendChild(el("div", "tname", "Mock " + m.mock));

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
        var atts = H.getAttempts(YEAR, SUBJ, setId(m));
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
    var seq = ++S.seq;
    showNote("Loading mocks.", "Please wait.", false, true);
    H.fetchSubject(YEAR, SUBJ, function (bytes) {
      if (seq === S.seq) showNote("Loading mocks.", (bytes / 1048576).toFixed(1) + " MB received", false, true);
    }).then(function (json) {
      if (seq !== S.seq) return;
      S.data = json; $("note").hidden = true; renderStats(); renderSheet();
    }).catch(function (e) {
      var d = H.describeError(e, YEAR, SUBJ); showNote(d.msg, d.sub, true, false);
    });
  }

  function init() {
    buildFilters(); renderStats();
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
