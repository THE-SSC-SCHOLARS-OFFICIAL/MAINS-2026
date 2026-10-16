/* Hunter dashboard UI: status window, stats radar, quests, subject dungeons, charts, achievements, avatars. */
(function () {
  var Hu = window.Hunter, C = window.HUB_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* =============== avatars: stickman faces =============== */
  var FACES = [
    { id: "cool", label: "COOL" }, { id: "smart", label: "SMART" }, { id: "happy", label: "HAPPY" }, { id: "determined", label: "FOCUS" },
    { id: "surprised", label: "SHOCK" }, { id: "sad", label: "SAD" }, { id: "angry", label: "ANGRY" }, { id: "sleepy", label: "SLEEPY" }
  ];
  var AURAS = ["#4aa8ff", "#b36bff", "#3ddc97", "#ff5d73", "#ffb84d", "#ff7ad9", "#e6f0ff"];

  function avatarSVG(gender, face) {
    var line = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
    var soft = 'fill="currentColor" fill-opacity=".14"';
    var s = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" ' + line + '>';
    /* hair behind head (female long hair) */
    var BASE = "#070b16";
    function hair(d) { return '<path d="' + d + '" fill="' + BASE + '" stroke="none"/><path d="' + d + '" ' + soft + '/>'; }
    if (gender === "f") {
      s += hair("M22 55 C14 70 16 86 25 93 C28 82 30 72 32 64 Z") + hair("M78 55 C86 70 84 86 75 93 C72 82 70 72 68 64 Z");
    }
    /* head */
    s += '<circle cx="50" cy="55" r="28" fill="#05080f" fill-opacity=".55"/>';
    /* hair front */
    if (gender === "f") {
      s += hair("M21 56 C16 24 38 12 50 12 C64 12 84 24 79 56 C76 44 70 35 52 33 C34 35 24 44 21 56 Z") + '<path d="M40 34 C44 40 40 46 34 48 M54 33 C58 40 62 44 70 46"/>';
    } else {
      s += hair("M22 50 C19 26 36 14 50 15 C66 14 81 26 78 50 L72 41 L66 47 L58 35 L50 45 L42 35 L34 47 L28 41 Z");
    }
    var lash = gender === "f";
    function dots(y) { return '<circle cx="38" cy="' + y + '" r="2" fill="currentColor"/><circle cx="62" cy="' + y + '" r="2" fill="currentColor"/>'; }
    function lashes() { return lash ? '<path d="M33 52 L30 49 M67 52 L70 49" stroke-width="2"/>' : ""; }
    switch (face) {
      case "happy":
        s += '<path d="M33 56 Q38 48 43 56 M57 56 Q62 48 67 56"/><path d="M37 65 Q50 82 63 65 Z" ' + soft + '/>' + lashes();
        s += '<path d="M29 63 H34 M66 63 H71" stroke-width="2" opacity=".6"/>'; break;
      case "cool":
        s += '<rect x="28" y="48" width="20" height="12" rx="3" fill="currentColor"/><rect x="52" y="48" width="20" height="12" rx="3" fill="currentColor"/><path d="M48 52 H52 M28 51 L24 48 M72 51 L76 48"/><path d="M41 69 Q52 74 61 65"/>'; break;
      case "smart":
        s += '<circle cx="38" cy="55" r="8.5"/><circle cx="62" cy="55" r="8.5"/><path d="M46.5 55 H53.5 M29.5 54 L24 52 M70.5 54 L76 52"/>' + dots(55);
        s += '<path d="M31 42 Q38 37 45 41"/><path d="M42 69 Q50 74 58 69"/>' + lashes(); break;
      case "sad":
        s += dots(56) + '<path d="M31 46 L44 41 M69 46 L56 41"/><path d="M40 72 Q50 62 60 72"/><path d="M34 62 Q30 68 34 70 Q38 68 34 62 Z" fill="currentColor" fill-opacity=".5"/>' + lashes(); break;
      case "angry":
        s += dots(56) + '<path d="M30 41 L45 48 M70 41 L55 48" stroke-width="4"/><path d="M39 71 L44.5 67 L50 71 L55.5 67 L61 71"/><path d="M70 28 L77 35 M77 28 L70 35" stroke-width="2.5"/>' + lashes(); break;
      case "determined":
        s += dots(56) + '<path d="M30 46 H45 M55 46 H70" stroke-width="4"/><path d="M42 70 H58"/><path d="M23 40 Q50 31 77 40" stroke-width="5"/><path d="M75 39 L84 46 M75 39 L86 38" stroke-width="3"/>' + lashes(); break;
      case "surprised":
        s += '<circle cx="38" cy="55" r="4.5"/><circle cx="62" cy="55" r="4.5"/><circle cx="38" cy="55" r="1.4" fill="currentColor"/><circle cx="62" cy="55" r="1.4" fill="currentColor"/><path d="M31 42 Q38 36 45 42 M55 42 Q62 36 69 42"/><ellipse cx="50" cy="71" rx="5" ry="7" ' + soft + '/>' + lashes(); break;
      case "sleepy":
        s += '<path d="M33 56 H43 M57 56 H67"/><path d="M46 69 Q50 73 54 69"/><text x="70" y="36" font-size="13" font-weight="700" fill="currentColor" stroke="none" font-family="Orbitron,sans-serif">z</text><text x="78" y="26" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="Orbitron,sans-serif">z</text>' + lashes(); break;
      default: s += dots(56) + '<path d="M42 69 Q50 74 58 69"/>';
    }
    return s + "</svg>";
  }
  function moodFor(m, p) {
    if (!p.auto || !m.attempts.length) return p.face || "cool";
    var last = m.attempts[m.attempts.length - 1].r, acc = last.accuracy || 0;
    return acc >= 85 ? "cool" : acc >= 70 ? "happy" : acc >= 55 ? "smart" : acc >= 40 ? "determined" : acc >= 25 ? "sad" : "angry";
  }

  /* =============== state =============== */
  var M, P, quoteIdx = 0, countdownT = null;
  function setAura(col) { document.body.style.setProperty("--aura", col || "#4aa8ff"); }

  function render() {
    M = Hu.build();
    P = Hu.getProfile();
    setAura(P ? P.aura : "#4aa8ff");
    renderSys(); renderStatus(); renderStats(); renderQuests(); renderAdvice(); renderSubjects(); renderTrend(); renderHeat(); renderBattles(); renderAch();
  }

  /* =============== messages =============== */
  function renderSys() {
    var Q = Hu.quotes;
    if (!quoteIdx) { var d = new Date(); quoteIdx = (Math.floor(d.getTime() / 86400000) % Q.length) + 1; }
    var name = P ? P.name : "Player";
    var line;
    if (!M.attempts.length) line = "Welcome, " + name + ". No gates cleared yet. Start a mock test to gain your first EXP.";
    else if (quoteIdx === -1) line = Q[0];
    else line = Q[(quoteIdx - 1) % Q.length];
    $("sysText").textContent = line;
  }
  $("nextQuote").onclick = function () { quoteIdx = ((quoteIdx || 0) % Hu.quotes.length) + 1; if (!M.attempts.length) { $("sysText").textContent = Hu.quotes[quoteIdx - 1]; } else renderSys(); };

  /* =============== status window =============== */
  function renderStatus() {
    var el = $("statusWin"), p = P || { name: "Player", gender: "m", face: "cool", aura: "#4aa8ff", auto: false };
    var rank = M.rank, face = moodFor(M, p);
    el.innerHTML =
      '<div class="av-frame">' + avatarSVG(p.gender, face) + '</div>' +
      '<div class="st-main">' +
        '<div class="wt" style="margin-bottom:8px">STATUS</div>' +
        '<div class="st-name">' + esc(p.name) + '</div>' +
        '<div class="st-title">' + esc(rank.title) + '</div>' +
        '<div class="st-rank"><span class="rank-badge" style="color:' + rank.color + '">' + rank.letter + '</span><span class="rank-name" style="color:' + rank.color + '">' + rank.name + ' HUNTER</span></div>' +
        '<div class="lvl-row"><span class="lvl">LV.</span><span class="lv">' + M.level + '</span></div>' +
        '<div class="xpbar"><i style="width:' + M.pct + '%"></i></div>' +
        '<div class="xp-txt"><span>' + M.into + ' / ' + M.need + ' EXP</span><span>' + (M.need - M.into) + ' to LV.' + (M.level + 1) + '</span></div>' +
        '<button type="button" class="edit-link" id="editProfile">EDIT PROFILE</button>' +
      '</div>' +
      '<div class="chips">' +
        '<div class="chip2"><b>' + M.totalXP + '</b><span>Total EXP</span></div>' +
        '<div class="chip2"><b>' + M.streak.current + (M.streak.current ? ' \uD83D\uDD25' : '') + '</b><span>Day streak</span></div>' +
        '<div class="chip2"><b>' + M.attempts.length + '</b><span>Gates cleared</span></div>' +
        '<div class="chip2"><b>' + M.saved + '</b><span>Saved Qs</span></div>' +
      '</div>';
    $("editProfile").onclick = function () { openSetup(false); };
  }

  /* =============== stats radar =============== */
  var STAT_DEFS = [["accuracy", "ACCURACY"], ["speed", "SPEED"], ["consistency", "CONSISTENCY"], ["endurance", "ENDURANCE"], ["knowledge", "KNOWLEDGE"]];
  function renderStats() {
    var cx = 115, cy = 115, R = 80, n = 5, pts = [], rings = "", axes = "", labels = "";
    for (var ring = 1; ring <= 4; ring++) {
      var rp = []; for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; rp.push((cx + R * ring / 4 * Math.cos(a)).toFixed(1) + "," + (cy + R * ring / 4 * Math.sin(a)).toFixed(1)); }
      rings += '<polygon points="' + rp.join(" ") + '" fill="none" class="axis"/>';
    }
    STAT_DEFS.forEach(function (d, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n, v = M.stats[d[0]] / 100;
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(a)).toFixed(1) + '" y2="' + (cy + R * Math.sin(a)).toFixed(1) + '" class="axis"/>';
      pts.push((cx + R * v * Math.cos(a)).toFixed(1) + "," + (cy + R * v * Math.sin(a)).toFixed(1));
      var lx = cx + (R + 17) * Math.cos(a), ly = cy + (R + 17) * Math.sin(a) + 3;
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" class="lbl">' + d[1].slice(0, 3) + '</text>';
    });
    var svg = '<svg class="radar" viewBox="0 0 230 230">' + rings + axes +
      '<polygon points="' + pts.join(" ") + '" fill="rgba(74,168,255,.3)" stroke="#4aa8ff" stroke-width="2"/>' + labels + '</svg>';
    var list = STAT_DEFS.map(function (d) {
      var v = M.stats[d[0]];
      return '<div class="stat-row"><div class="top"><span>' + d[1] + '</span><b>' + v + '</b></div><div class="bar"><i style="width:' + v + '%"></i></div></div>';
    }).join("");
    $("statsWin").innerHTML = '<h3 class="wt">Core Stats</h3><div class="stats-wrap">' + svg + '<div class="stat-list">' + list + '</div></div>' +
      '<div class="power">COMBAT POWER<b>' + M.power.toLocaleString() + '</b></div>';
  }

  /* =============== quests =============== */
  function renderQuests() {
    var rows = M.quests.map(function (q) {
      return '<div class="quest' + (q.done ? " done" : "") + '"><span class="q-ic">' + (q.done ? "\u2713" : "") + '</span><span class="q-name">' + esc(q.name) + '</span><span class="q-prog">' + q.progress + '/' + q.goal + '</span><span class="q-rw">+' + q.reward + ' EXP</span></div>';
    }).join("");
    var all = M.quests.every(function (q) { return q.done; });
    $("questWin").innerHTML = '<h3 class="wt">Daily Quests</h3>' + rows +
      '<div class="q-foot"><span>' + (all ? "[SYSTEM] All daily quests cleared!" : "Complete mocks to earn bonus EXP") + '</span><span>Resets in <b id="resetIn">--:--:--</b></span></div>';
    tick(); clearInterval(countdownT); countdownT = setInterval(tick, 1000);
  }
  function tick() {
    var el = $("resetIn"); if (!el) return;
    var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s = Math.max(0, Math.floor((mid - now) / 1000));
    function p(n) { return (n < 10 ? "0" : "") + n; }
    el.textContent = p(Math.floor(s / 3600)) + ":" + p(Math.floor(s % 3600 / 60)) + ":" + p(s % 60);
    if (s === 0) render();
  }

  function renderAdvice() {
    var icon = { warn: "\u26A0\uFE0F", good: "\u2705", info: "\u2139\uFE0F" };
    $("adviceWin").innerHTML = '<h3 class="wt">System Analysis</h3>' + M.advice.map(function (a) {
      return '<div class="adv ' + a.t + '"><span>' + (icon[a.t] || "") + '</span><span>' + esc(a.text) + '</span></div>';
    }).join("");
  }

  /* =============== subjects =============== */
  function renderSubjects() {
    var cards = M.subjects.map(function (s) {
      if (!s.attempts) {
        return '<div class="subj locked"><div class="subj-top"><span class="subj-name">' + esc(s.label) + '</span><span class="grade g--">-</span></div>' +
          '<div class="subj-lv">GATE NOT ENTERED</div><div class="empty" style="margin-top:8px">Clear a mock here to unlock this dungeon.</div><a class="go2" href="index.html">ENTER GATE &rarr;</a></div>';
      }
      var trend = s.trend > 0 ? '<b style="color:#3ddc97">\u25B2 UP</b>' : s.trend < 0 ? '<b style="color:#ff5d73">\u25BC DOWN</b>' : '<b>\u25AC STABLE</b>';
      return '<div class="subj"><div class="subj-top"><span class="subj-name">' + esc(s.label) + '</span><span class="grade g-' + s.grade + '">' + s.grade + '</span></div>' +
        '<div class="subj-lv">LV.' + s.level + ' &middot; ' + s.xp + ' EXP</div>' +
        '<div class="xpbar"><i style="width:' + s.pct + '%"></i></div>' +
        '<div class="subj-m"><div><span>Mocks</span><b>' + s.attempts + '</b></div><div><span>Avg acc</span><b>' + r1(s.avg) + '%</b></div>' +
        '<div><span>Recent</span><b>' + r1(s.recent) + '%</b></div><div><span>Best</span><b>' + s.best + '%</b></div>' +
        '<div><span>Sec / Q</span><b>' + (s.secPerQ || "-") + '</b></div><div><span>Trend</span>' + trend + '</div></div>' +
        (s.tag ? '<span class="tagc ' + s.tag + '">' + (s.tag === "strong" ? "STRONGEST" : "NEEDS WORK") + '</span>' : "") + '</div>';
    }).join("");
    $("subjWin").innerHTML = '<h3 class="wt">Subject Dungeons</h3><div class="subj-grid">' + cards + '</div>';
  }

  /* =============== trend chart =============== */
  function renderTrend() {
    var el = $("trendWin"), list = M.attempts.slice(-15);
    if (list.length < 2) { el.innerHTML = '<h3 class="wt">Accuracy Trend</h3><div class="empty">Clear at least 2 mocks to see your performance curve.</div>'; return; }
    var W = 460, H = 200, L = 30, B = 24, T = 10, Rm = 10, iw = W - L - Rm, ih = H - T - B;
    var x = function (i) { return L + (list.length === 1 ? 0 : i / (list.length - 1) * iw); };
    var y = function (v) { return T + ih - v / 100 * ih; };
    var grid = [0, 50, 100].map(function (v) { return '<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="axis"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="lbl">' + v + '</text>'; }).join("");
    var pts = list.map(function (a, i) { return x(i).toFixed(1) + "," + y(a.r.accuracy || 0).toFixed(1); });
    var dots = list.map(function (a, i) {
      var acc = a.r.accuracy || 0, col = acc >= 75 ? "#3ddc97" : acc >= 50 ? "#4aa8ff" : "#ff5d73";
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(acc).toFixed(1) + '" r="4" fill="' + col + '"><title>' + Math.round(acc) + '% on ' + new Date(a.at).toLocaleDateString() + '</title></circle>';
    }).join("");
    var area = "M" + x(0) + "," + y(0) + " L" + pts.join(" L") + " L" + x(list.length - 1) + "," + y(0) + " Z";
    el.innerHTML = '<h3 class="wt">Accuracy Trend <span class="dim" style="letter-spacing:1px;font-size:11px">LAST ' + list.length + ' MOCKS</span></h3>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">' + grid + '<path d="' + area + '" fill="rgba(74,168,255,.14)"/><polyline points="' + pts.join(" ") + '" fill="none" stroke="#4aa8ff" stroke-width="2.5"/>' + dots + '</svg>';
  }

  /* =============== heatmap =============== */
  function renderHeat() {
    var weeks = 15, today = new Date(), dow = (today.getDay() + 6) % 7;     /* Monday = 0 */
    var total = weeks * 7, cells = "", todayKey = Hu.dayKey(today.getTime());
    for (var i = 0; i < total; i++) {
      var back = total - 1 - i - (6 - dow);                                   /* column-major, last column is the current week */
      var k = Hu.addDays(todayKey, -back), future = back < 0;
      var c = (M.days[k] || { count: 0 }).count;
      cells += '<i class="' + (future ? "" : c >= 3 ? "l3" : c === 2 ? "l2" : c === 1 ? "l1" : "") + (k === todayKey ? " today" : "") + '" title="' + k + (future ? "" : ": " + c + " mock" + (c === 1 ? "" : "s")) + '" style="' + (future ? "visibility:hidden" : "") + '"></i>';
    }
    $("heatWin").innerHTML = '<h3 class="wt">Activity Log</h3><div class="heat">' + cells + '</div>' +
      '<div class="heat-leg">Less <i></i><i style="background:rgba(74,168,255,.35)"></i><i style="background:rgba(74,168,255,.65)"></i><i style="background:#9fd0ff"></i> More</div>' +
      '<div class="q-foot" style="margin-top:12px"><span>Current streak: <b>' + M.streak.current + '</b> day' + (M.streak.current === 1 ? "" : "s") + '</span><span>Longest: <b>' + M.streak.longest + '</b></span></div>';
  }

  /* =============== recent battles =============== */
  function subjLabel(k) { var s = (C.subjects || []).filter(function (x) { return x.key === k; })[0]; return s ? (s.label || s.key) : k; }
  function renderBattles() {
    var list = M.attempts.slice(-8).reverse();
    if (!list.length) { $("battleWin").innerHTML = '<h3 class="wt">Recent Battles</h3><div class="empty">No battles yet. Your cleared mocks will be listed here.</div>'; return; }
    $("battleWin").innerHTML = '<h3 class="wt">Recent Battles</h3>' + list.map(function (a) {
      var url = "test.html?y=" + encodeURIComponent(a.y) + "&s=" + encodeURIComponent(a.subject) + "&id=" + encodeURIComponent(a.setId) + "&attempt=" + encodeURIComponent(a.id);
      var id = a.setId.length > 26 ? a.setId.slice(0, 25) + "\u2026" : a.setId;
      return '<div class="battle"><div><div class="b-name">' + esc(subjLabel(a.subject)) + ' &middot; ' + esc(id) + '</div><div class="b-meta">' + a.y + ' &middot; ' + new Date(a.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ' &middot; ' + (a.r.correct || 0) + ' correct, ' + (a.r.wrong || 0) + ' wrong</div></div>' +
        '<div class="b-right">' + a.r.score + ' / ' + a.r.maxMarks + '<span class="xp">+' + a.xp + ' EXP</span><a href="' + url + '" target="_blank" rel="noopener">REVIEW &rarr;</a></div></div>';
    }).join("");
  }

  function renderAch() {
    var got = M.achievements.filter(function (a) { return a.got; }).length;
    $("achWin").innerHTML = '<h3 class="wt">Achievements <span class="dim" style="letter-spacing:1px;font-size:11px">' + got + ' / ' + M.achievements.length + '</span></h3><div class="ach-grid">' +
      M.achievements.map(function (a) { return '<div class="ach ' + (a.got ? "got" : "locked") + '"><span class="ic">' + a.icon + '</span><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div>'; }).join("") + '</div>';
  }

  /* =============== profile setup / edit =============== */
  var draft = null;
  function openSetup(first) {
    var cur = P || { name: "", gender: "m", face: "cool", aura: "#4aa8ff", auto: true };
    draft = { name: cur.name, gender: cur.gender, face: cur.face, aura: cur.aura, auto: cur.auto !== false };
    $("setupTitle").textContent = first ? "PLAYER REGISTRATION" : "EDIT PROFILE";
    $("setupSub").textContent = first ? "The System has chosen you. Create your Hunter profile." : "Update how your Hunter looks.";
    $("setupSave").textContent = first ? "Awaken" : "Save";
    $("setupCancel").hidden = first;
    $("setupName").value = draft.name;
    $("setupAuto").checked = draft.auto;
    $("setupModal").hidden = false;
    paintSetup();
    setTimeout(function () { $("setupName").focus(); }, 50);
  }
  function paintSetup() {
    setAura(draft.aura);
    var shown = draft.face;
    $("setupPrev").innerHTML = avatarSVG(draft.gender, shown);
    Array.prototype.forEach.call($("setupGender").children, function (b) { b.classList.toggle("on", b.getAttribute("data-g") === draft.gender); });
    $("setupAuras").innerHTML = AURAS.map(function (c) { return '<button type="button" style="background:' + c + ';color:' + c + '" data-c="' + c + '" class="' + (c === draft.aura ? "on" : "") + '" aria-label="aura"></button>'; }).join("");
    Array.prototype.forEach.call($("setupAuras").children, function (b) { b.onclick = function () { draft.aura = b.getAttribute("data-c"); paintSetup(); }; });
    $("setupFaces").innerHTML = FACES.map(function (f) { return '<button type="button" data-f="' + f.id + '" class="' + (f.id === draft.face ? "on" : "") + '">' + avatarSVG(draft.gender, f.id) + '<span>' + f.label + '</span></button>'; }).join("");
    Array.prototype.forEach.call($("setupFaces").children, function (b) { b.onclick = function () { draft.face = b.getAttribute("data-f"); paintSetup(); }; });
    $("setupSave").disabled = draft.name.trim().length < 2;
  }
  $("setupName").addEventListener("input", function () { draft.name = this.value; $("setupSave").disabled = draft.name.trim().length < 2; });
  $("setupAuto").addEventListener("change", function () { draft.auto = this.checked; paintSetup(); });
  Array.prototype.forEach.call($("setupGender").children, function (b) { b.onclick = function () { draft.gender = b.getAttribute("data-g"); paintSetup(); }; });
  $("setupCancel").onclick = function () { $("setupModal").hidden = true; setAura(P ? P.aura : "#4aa8ff"); };
  $("setupSave").onclick = function () {
    var name = draft.name.trim().slice(0, 16); if (name.length < 2) return;
    var first = !P;
    var prof = { name: name, gender: draft.gender, face: draft.face, aura: draft.aura, auto: draft.auto,
      created: (P && P.created) || Date.now(), seenLevel: P ? P.seenLevel : M.level, seenRank: P ? P.seenRank : M.rank.letter };
    Hu.saveProfile(prof);
    $("setupModal").hidden = true;
    render();
    if (first) { P = Hu.getProfile(); }
  };

  /* =============== level up =============== */
  function checkLevelUp() {
    if (!P) return;
    if (typeof P.seenLevel !== "number") { P.seenLevel = M.level; P.seenRank = M.rank.letter; Hu.saveProfile(P); return; }
    if (M.level > P.seenLevel) {
      var rankUp = P.seenRank && P.seenRank !== M.rank.letter;
      $("lvlNum").textContent = "LV." + P.seenLevel + "  \u2192  LV." + M.level;
      var rk = $("lvlRank"); rk.textContent = rankUp ? "RANK UP: " + M.rank.name + " HUNTER" : M.rank.name + " HUNTER"; rk.style.color = M.rank.color;
      $("lvlMsg").textContent = rankUp ? "You have been promoted. New gates await, " + P.name + "." : "Your power grows, " + P.name + ". Keep clearing gates.";
      $("lvlModal").hidden = false;
      P.seenLevel = M.level; P.seenRank = M.rank.letter; Hu.saveProfile(P);
    } else if (M.level < P.seenLevel) { P.seenLevel = M.level; P.seenRank = M.rank.letter; Hu.saveProfile(P); }
  }
  $("lvlClose").onclick = function () { $("lvlModal").hidden = true; };

  window.HunterAvatar = { svg: avatarSVG, faces: FACES };

  /* =============== start =============== */
  render();
  if (!P) openSetup(true); else checkLevelUp();
})();
