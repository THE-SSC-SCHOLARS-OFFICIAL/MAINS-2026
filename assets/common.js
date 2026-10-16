/* Shared helpers used by both the hub (index.html) and the test page (test.html) */
(function () {
  var C = window.HUB_CONFIG;
  var cache = {};

  function dataUrl(year, subject) {
    return C.dataDir + "/" + year + "_" + subject + ".json" +
      (C.dataVersion ? "?v=" + encodeURIComponent(C.dataVersion) : "");
  }

  /* Fetch a subject JSON (cached in memory and by the browser) with byte-level progress */
  function fetchSubject(year, subject, onProgress) {
    var key = year + "_" + subject;
    if (cache[key]) return Promise.resolve(cache[key]);
    var url = dataUrl(year, subject);
    return fetch(url, { cache: "force-cache" }).then(function (res) {
      if (!res.ok) { var e = new Error("HTTP " + res.status); e.status = res.status; e.url = url; throw e; }
      if (!res.body || !res.body.getReader || !onProgress) return res.json();
      var reader = res.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          chunks.push(r.value); got += r.value.length; onProgress(got);
          return pump();
        });
      }
      return pump().then(function () { return new Blob(chunks).text(); })
                   .then(function (t) { return JSON.parse(t); });
    }).then(function (j) { normaliseNames(j); cache[key] = j; return j; });
  }

  function normaliseNames(j) {
    if (!j || j.__names) return;
    (j.categories || []).forEach(function (c) {
      c.category = decodeText(c.category);
      (c.chapters || []).forEach(function (ch) {
        ch.chapter = decodeText(ch.chapter);
        (ch.sets || []).forEach(function (st) { st.title = decodeText(st.title); });
      });
    });
    j.__names = true;
  }

  function describeError(e, year, subject) {
    if (location.protocol === "file:") {
      return { msg: "This page was opened from the local file system.",
               sub: "Browsers block JSON loading from file:// addresses. Open a terminal in this folder, run " +
                    "\"python -m http.server 8000\" and visit http://localhost:8000, or host the site on GitHub Pages." };
    }
    if (e && e.status === 404) {
      return { msg: year + "_" + subject + ".json was not found.",
               sub: "Place the file in the \"" + C.dataDir + "\" folder (expected at " + (e.url || "") + ")." };
    }
    return { msg: "The data could not be loaded.", sub: String((e && e.message) || e) };
  }

  /* ---- progress (saved test state in localStorage) ---- */
  function storageKey(year, subject, setId) { return "sscscholars_hub_" + year + "_" + subject + "_" + setId; }

  function readStatus(year, subject, setId) {
    try {
      var raw = localStorage.getItem(storageKey(year, subject, setId));
      if (!raw) return null;
      var s = JSON.parse(raw).s;
      if (!s) return null;
      if (s.phase === "submitted" && s.result) return { kind: "done", score: s.result.score, max: s.result.maxMarks };
      if (s.phase === "testing" || s.phase === "paused") return { kind: "progress", left: s.timeLeft, sec: s.secIdx || 0 };
      return null;
    } catch (e) { return null; }
  }

  /* ---- JSON structure helpers ---- */
  function findSet(json, setId) {
    if (json && Array.isArray(json.mocks)) {            /* full-mock file (Mains) */
      var mm = String(setId).match(/^mock_(\d+)$/), no = mm ? parseInt(mm[1], 10) : -1;
      for (var k = 0; k < json.mocks.length; k++) if (json.mocks[k].mock === no) return { mock: json.mocks[k] };
      return null;
    }
    var cats = json.categories || [];
    for (var a = 0; a < cats.length; a++) {
      var chs = cats[a].chapters || [];
      for (var b = 0; b < chs.length; b++) {
        var sets = chs[b].sets || [];
        for (var c = 0; c < sets.length; c++) {
          if (sets[c].set_id === setId) return { category: cats[a], chapter: chs[b], set: sets[c], multiCategory: cats.length > 1 };
        }
      }
    }
    return null;
  }

  function shortSubjectLabel(subject) {
    for (var i = 0; i < C.subjects.length; i++) {
      if (C.subjects[i].key === subject) return C.subjects[i].label.replace(/\s*\(.*\)\s*/, "");
    }
    return subject;
  }

  function fmtScore(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return "";
    return String(Math.round(n * 100) / 100);
  }

  function minutesFromLabel(label) {
    var m = String(label || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) * 60 : 0;
  }

  /* Relative image paths (when images were downloaded locally) are resolved against the data folder */
  var IMG_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;
  /* Some questions arrive with their HTML tags escaped (&lt;span class=&quot;math-tex&quot;&gt;) and would
     show up as visible text. This turns only genuine HTML tags back into tags and leaves math symbols
     such as "x &lt; y" untouched. */
  /* Text in the data is sometimes escaped twice (&amp;#39; &amp;nbsp; &amp;quot; &amp;times; ...), so the
     browser shows "&#39;" or "&nbsp;" literally. Turn every double-escaped entity back into a normal one;
     the browser then decodes it. A plain "&amp;" followed by a space or letter (e.g. "Profit &amp; Loss") is untouched. */
  var DBL_ENT = /&amp;(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;
  function undouble(html) {
    for (var i = 0; i < 3 && html.indexOf("&amp;") !== -1; i++) {
      var n = html.replace(DBL_ENT, "&$1;");
      if (n === html) break;
      html = n;
    }
    return html;
  }
  /* Plain-text fields (chapter names, titles, topics): decode all entities to real characters */
  var _ta = null;
  function decodeText(s) {
    if (s == null) return "";
    s = String(s);
    if (s.indexOf("&") === -1) return s;
    s = undouble(s);
    if (!_ta) _ta = document.createElement("textarea");
    _ta.innerHTML = s;
    return _ta.value;
  }

  var ESC_TAG = /&lt;(\/?)(span|p|br|b|i|u|em|strong|sub|sup|img|div|font|table|thead|tbody|tr|td|th|ul|ol|li|h[1-6])((?:\s[^<>]*?)?)(\/?)&gt;/gi;
  function unescapeTags(html) {
    if (!html) return "";
    html = undouble(html);
    if (html.indexOf("&lt;") === -1) return html;
    return html.replace(ESC_TAG, function (m, slash, tag, attrs, selfc) {
      attrs = attrs.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&");
      return "<" + slash + tag + attrs + selfc + ">";
    });
  }

  function fixSrc(html) {
    html = unescapeTags(html);
    if (!html || html.toLowerCase().indexOf("<img") === -1) return html || "";
    var base = (C.imagesBase || (C.dataDir + "/"));
    return html.replace(IMG_RE, function (m, head, q, u) {
      if (/^(https?:|data:|\/\/|\/)/i.test(u)) return m;
      return head + q + base + u.replace(/^\.\//, "") + q;
    });
  }
  function fixUrl(u) {
    if (!u || /^(https?:|data:|\/\/|\/)/i.test(u)) return u || "";
    return (C.imagesBase || (C.dataDir + "/")) + u.replace(/^\.\//, "");
  }
  function withImg(html, url) {
    html = html || "";
    if (!url || html.indexOf(url) !== -1) return html;
    return html + '<br><img src="' + url + '" alt="">';
  }

  function normQuestion(q, i, setCs, setNs) {
    var ex = q.extra_image_fields || {};
    var optsRaw = q.options || {};
    var opts = {};
    for (var n = 1; n <= 5; n++) {
      var v = optsRaw[String(n)] || optsRaw["option_" + n];
      if (!v) continue;
      if (typeof v === "string") v = { en: v, hi: "" };
      var oi = ex["option_image_" + n];
      opts["option_" + n] = {
        en: fixSrc(withImg(v.en || "", oi)),
        hi: v.hi ? fixSrc(withImg(v.hi, oi)) : "",
        image: ""
      };
    }
    var qq = q.question || {};
    var sol = q.solution || q.solution_text || {};
    var si = ex.solution_image;
    var ans = String(q.answer == null ? "" : q.answer).trim().replace(/^option[_\s]?(\d+)$/i, "$1");
    var qimg = ex.question_image ? fixUrl(ex.question_image) : "";
    return {
      q_no: q.q_no || (i + 1),
      id: String(q.uid || q.id || ""),
      topic: decodeText(q.topic),
      difficulty_level: q.difficulty_level || "",
      question: { en: fixSrc(qq.en || ""), hi: fixSrc(qq.hi || "") },
      question_image: qimg,
      options: opts,
      answer: ans,
      correct_score: (q.correct_score !== undefined && q.correct_score !== "") ? q.correct_score : setCs,
      negative_score: (q.negative_score !== undefined && q.negative_score !== "") ? q.negative_score : setNs,
      solution_text: { en: fixSrc(withImg(sol.en || "", si)), hi: sol.hi ? fixSrc(withImg(sol.hi, si)) : "" },
      solution_image: ""
    };
  }

  /* One set from the JSON -> engine config + questions */
  function buildTest(json, found, year, subject) {
    if (found.mock) return buildMains(json, found.mock, year, subject);
    var set = found.set, chapter = found.chapter, category = found.category;
    var meta = chapter.api_meta || {};
    var csRaw = set.correct_score != null && set.correct_score !== "" ? set.correct_score : (meta.correct_score != null ? meta.correct_score : 2);
    var nsRaw = set.negative_score != null && set.negative_score !== "" ? set.negative_score : (meta.negative_score != null ? meta.negative_score : 0.5);
    var secs = parseInt(set.time_seconds, 10) || minutesFromLabel(set.time_label) || 1800;
    var partTxt = set.part ? "PART " + set.part : (set.title || "");
    var label = shortSubjectLabel(subject);
    if (found.multiCategory) label += " - " + category.category;
    var qs = (set.questions || []).map(function (q, i) { return normQuestion(q, i, csRaw, nsRaw); });
    return {
      cfg: {
        examTitle: (chapter.chapter + " - " + partTxt + " (" + year + ")").toUpperCase(),
        sectionLabel: label,
        storageKey: storageKey(year, subject, set.set_id),
        year: String(year),
        subject: subject,
        setId: set.set_id,
        chapterName: chapter.chapter,
        setTitle: partTxt,
        totalTimeSeconds: secs,
        correctScoreDisplay: fmtScore(csRaw),
        negativeScoreDisplay: fmtScore(nsRaw),
        defaultCorrectScore: parseFloat(csRaw) || 2,
        defaultNegativeScore: isNaN(parseFloat(nsRaw)) ? 0.5 : parseFloat(nsRaw)
      },
      questions: qs
    };
  }


  /* ================= FULL MOCK (Mains) ================= */
  function mainsCfg() { return C.mains || { correct: 3, negative: 1, sections: [] }; }

  /* which config section does a JSON subject belong to? (by name, then by position) */
  function matchSection(subjectName, used) {
    var nm = String(subjectName || "").toLowerCase(), secs = mainsCfg().sections;
    for (var i = 0; i < secs.length; i++) {
      if (used[i]) continue;
      for (var j = 0; j < secs[i].match.length; j++) if (nm.indexOf(secs[i].match[j]) !== -1) return i;
    }
    return -1;
  }
  /* returns [{def, questions}] in exam order, or null when the mock does not have all sections */
  function mockSections(mock) {
    var secs = mainsCfg().sections, used = {}, got = [];
    (mock.subjects || []).forEach(function (sb, idx) {
      var at = matchSection(sb.subject, used);
      if (at < 0 && (mock.subjects || []).length === secs.length && !used[idx]) at = idx;
      if (at >= 0 && !used[at] && (sb.questions || []).length) { used[at] = 1; got[at] = { def: secs[at], questions: sb.questions }; }
    });
    for (var i = 0; i < secs.length; i++) if (!got[i]) return null;
    return got;
  }
  function mockReady(mock) { return !!mockSections(mock); }
  function mockSummary(mock) {
    var g = mockSections(mock); if (!g) return null;
    var q = 0, sec = 0, marks = 0, main = 0, cs = mainsCfg().correct;
    g.forEach(function (x) { q += x.questions.length; sec += x.def.minutes * 60; marks += x.questions.length * cs; if (!x.def.qualifying) main += x.questions.length * cs; });
    return { questions: q, seconds: sec, marks: marks, mainMarks: main };
  }

  function normMainsQ(q, i, cs, ns) {
    var opts = {}, raw = q.options || [];
    raw.forEach(function (o, k) {
      if (k > 4) return;
      opts["option_" + (k + 1)] = { en: fixSrc(o.text || ""), hi: o.text_hi ? fixSrc(o.text_hi) : "", image: "" };
    });
    var ans = "";
    if (q.correct_option && /^[A-E]$/i.test(q.correct_option)) ans = String(q.correct_option.toUpperCase().charCodeAt(0) - 64);
    else if (q.correct_index != null && q.correct_index !== "") ans = String(parseInt(q.correct_index, 10) + 1);
    return {
      q_no: i + 1, id: String(q.qid || ""), topic: "",
      question: { en: fixSrc(q.question || ""), hi: q.question_hi ? fixSrc(q.question_hi) : "" },
      passage: { en: q.passage ? fixSrc(q.passage) : "", hi: q.passage_hi ? fixSrc(q.passage_hi) : "" },
      passage_id: q.passage_id == null ? "" : String(q.passage_id),
      question_image: "", options: opts, answer: ans,
      correct_score: cs, negative_score: ns,
      solution_text: { en: fixSrc(q.solution || ""), hi: q.solution_hi ? fixSrc(q.solution_hi) : "" },
      solution_image: ""
    };
  }

  function buildMains(json, mock, year, subject) {
    var mc = mainsCfg(), cs = mc.correct, ns = mc.negative, got = mockSections(mock) || [];
    var questions = [], sections = [], start = 0, total = 0;
    got.forEach(function (g, k) {
      g.questions.forEach(function (q) { questions.push(normMainsQ(q, questions.length, cs, ns)); });
      var n = g.questions.length;
      sections.push({ key: g.def.key, name: g.def.name, short: g.def.short, part: g.def.part, qualifying: !!g.def.qualifying,
        start: start, end: start + n, count: n, seconds: g.def.minutes * 60, minutes: g.def.minutes });
      start += n; total += g.def.minutes * 60;
    });
    var setId = "mock_" + mock.mock;
    return {
      cfg: {
        examTitle: "SSC CGL " + year + " MAINS - MOCK " + mock.mock,
        sectionLabel: "Full Mock", mockNo: mock.mock,
        storageKey: storageKey(year, subject, setId),
        year: String(year), subject: subject, setId: setId,
        chapterName: "", setTitle: "Mock " + mock.mock,
        sections: sections, totalTimeSeconds: total,
        correctScoreDisplay: fmtScore(cs), negativeScoreDisplay: fmtScore(ns),
        defaultCorrectScore: cs, defaultNegativeScore: ns
      },
      questions: questions
    };
  }

  /* ---- Saved (bookmarked) questions: kept in this browser only ---- */
  var SAVED_KEY = "sscscholars_saved_v1";
  function readSaved() {
    try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeSaved(list) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function savedId(year, subject, setId, idx) { return year + "|" + subject + "|" + setId + "|" + idx; }
  function addSaved(entry) {
    var list = readSaved().filter(function (x) { return x.id !== entry.id; });
    list.push(entry);
    return writeSaved(list);
  }
  function removeSaved(id) {
    return writeSaved(readSaved().filter(function (x) { return x.id !== id; }));
  }
  function countSaved() { return readSaved().length; }

  /* ---- Attempt history: every submitted attempt of a test is kept (no limit), reviewable from the hub ---- */
  function attemptsKey(year, subject, setId) { return "sscscholars_hub_attempts_" + year + "_" + subject + "_" + setId; }
  function readAttemptsRaw(key) {
    try { var a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function getAttempts(year, subject, setId) {
    var key = attemptsKey(year, subject, setId), list = readAttemptsRaw(key);
    /* attempts submitted before this feature existed: pick up the saved result as an attempt */
    try {
      var cur = JSON.parse(localStorage.getItem(storageKey(year, subject, setId)) || "null");
      if (cur && cur.s && cur.s.phase === "submitted" && cur.s.finishedAt) {
        var id = String(cur.s.finishedAt);
        if (!list.some(function (a) { return a.id === id; })) {
          list.push({ id: id, at: cur.s.finishedAt, n: cur.n, s: cur.s });
          try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
        }
      }
    } catch (e) {}
    return list.slice().sort(function (a, b) { return a.at - b.at; });
  }
  function addAttempt(year, subject, setId, n, snapshot) {
    var key = attemptsKey(year, subject, setId), list = readAttemptsRaw(key);
    var at = snapshot.finishedAt || Date.now(), id = String(at);
    list = list.filter(function (a) { return a.id !== id; });
    list.push({ id: id, at: at, n: n, s: snapshot });
    try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function getAttempt(year, subject, setId, attemptId) {
    var list = getAttempts(year, subject, setId);
    for (var i = 0; i < list.length; i++) if (list[i].id === String(attemptId)) return { attempt: list[i], number: i + 1 };
    return null;
  }
  function fmtAttemptDate(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ", " +
      d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  window.HubCommon = {
    dataUrl: dataUrl, fetchSubject: fetchSubject, describeError: describeError,
    storageKey: storageKey, readStatus: readStatus, findSet: findSet,
    buildTest: buildTest, mockSections: mockSections, mockReady: mockReady, mockSummary: mockSummary, getAttempts: getAttempts, addAttempt: addAttempt, getAttempt: getAttempt, fmtAttemptDate: fmtAttemptDate, readSaved: readSaved, addSaved: addSaved, removeSaved: removeSaved, savedId: savedId, countSaved: countSaved, unescapeTags: unescapeTags, decodeText: decodeText, fmtScore: fmtScore, shortSubjectLabel: shortSubjectLabel
  };
})();
