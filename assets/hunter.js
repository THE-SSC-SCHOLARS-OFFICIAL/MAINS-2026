/* HUNTER SYSTEM: turns your mock history into XP, levels, ranks, stats, quests and achievements.
   Nothing is stored separately: everything is calculated from your attempts (so Backup/Restore carries it too).
   Only the profile (name, avatar) lives in its own key. */
(function () {
  var PROFILE_KEY = "sscscholars_profile_v1";
  var ATT_PREFIX = "sscscholars_hub_attempts_";
  var G = { base: 150, step: 50 };      /* global level curve  */
  var SUBJ = { base: 120, step: 40 };   /* per-subject curve   */

  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function cfg() { return window.HUB_CONFIG || { subjects: [], years: [] }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function addDays(key, n) { var p = key.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dayKey(d.getTime()); }

  /* ---------- XP / level / rank ---------- */
  function xpOf(r, total) {
    if (!r) return 0;
    var att = r.attempted || 0, c = r.correct || 0, w = r.wrong || 0;
    var acc = att ? c / att * 100 : 0;
    var xp = 30 + c * 10 + att - w * 2;
    if (att >= Math.max(5, (total || r.total || 0) * 0.5)) { if (acc >= 90) xp += 60; else if (acc >= 75) xp += 40; else if (acc >= 60) xp += 20; }
    return Math.max(10, Math.round(xp));
  }
  function levelInfo(xp, curve) {
    var level = 1, need = curve.base, rem = Math.max(0, xp);
    while (rem >= need) { rem -= need; level++; need = curve.base + (level - 1) * curve.step; }
    return { level: level, into: rem, need: need, pct: Math.round(rem / need * 100) };
  }
  var RANKS = [
    { min: 60, letter: "M", name: "MONARCH", title: "Monarch", color: "#ff4d6d" },
    { min: 40, letter: "S", name: "S-RANK", title: "Sovereign Hunter", color: "#ffb84d" },
    { min: 27, letter: "A", name: "A-RANK", title: "Shadow Vanguard", color: "#b36bff" },
    { min: 17, letter: "B", name: "B-RANK", title: "Elite Hunter", color: "#4da6ff" },
    { min: 10, letter: "C", name: "C-RANK", title: "Gate Breaker", color: "#3ddc97" },
    { min: 5, letter: "D", name: "D-RANK", title: "Dungeon Delver", color: "#9fb4c8" },
    { min: 1, letter: "E", name: "E-RANK", title: "Novice Hunter", color: "#8a94a6" }
  ];
  function rankOf(level) { for (var i = 0; i < RANKS.length; i++) if (level >= RANKS[i].min) return RANKS[i]; return RANKS[RANKS.length - 1]; }
  function gradeOf(acc) {
    if (acc >= 90) return "S"; if (acc >= 80) return "A"; if (acc >= 70) return "B"; if (acc >= 55) return "C"; if (acc >= 40) return "D"; return "E";
  }

  /* ---------- profile ---------- */
  function getProfile() { var p = parse(localStorage.getItem(PROFILE_KEY)); return p && p.name ? p : null; }
  function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }

  /* ---------- collect attempts ---------- */
  function splitKey(rest) {
    var y = rest.split("_")[0], remaining = rest.slice(y.length + 1), subject = null;
    (cfg().subjects || []).forEach(function (s) { if (!subject && remaining.indexOf(s.key + "_") === 0) subject = s.key; });
    if (!subject) subject = remaining.split("_")[0];
    return { y: y, subject: subject, setId: remaining.slice(subject.length + 1) };
  }
  function collect() {
    var list = [], seen = {};
    function push(key, y, subject, setId, id, at, r, n) {
      var uid = key + "|" + id; if (seen[uid]) return; seen[uid] = 1;
      list.push({ id: id, y: y, subject: subject, setId: setId, at: at, r: r, n: n || r.total || 0 });
    }
    var keys = [];
    try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
    keys.forEach(function (k) {
      if (k.indexOf(ATT_PREFIX) !== 0) return;
      var sp = splitKey(k.slice(ATT_PREFIX.length)), arr = parse(localStorage.getItem(k));
      if (!Array.isArray(arr)) return;
      arr.forEach(function (a) { var r = a && a.s && a.s.result; if (r) push(k, sp.y, sp.subject, sp.setId, String(a.id), a.at, r, a.n); });
    });
    keys.forEach(function (k) {   /* results submitted before attempt history existed */
      var m = k.match(/^sscscholars_hub_(\d{4})_(.+)$/); if (!m || k.indexOf(ATT_PREFIX) === 0) return;
      var o = parse(localStorage.getItem(k)), s = o && o.s;
      if (!s || s.phase !== "submitted" || !s.result || !s.finishedAt) return;
      var sp = splitKey(m[1] + "_" + m[2]);
      var arrKey = ATT_PREFIX + m[1] + "_" + m[2];
      push(arrKey, sp.y, sp.subject, sp.setId, String(s.finishedAt), s.finishedAt, s.result, o.n);
    });
    list.sort(function (a, b) { return a.at - b.at; });
    list.forEach(function (a) { a.xp = xpOf(a.r, a.n); a.day = dayKey(a.at); });
    return list;
  }

  /* ---------- quests ---------- */
  var QUEST_DEFS = [
    { id: "q1", name: "Clear 1 mock test", reward: 50, goal: 1, prog: function (d) { return d.count; } },
    { id: "q2", name: "Clear 2 mock tests", reward: 80, goal: 2, prog: function (d) { return d.count; } },
    { id: "q3", name: "Score 75%+ accuracy in a mock", reward: 100, goal: 1, prog: function (d) { return d.good ? 1 : 0; } }
  ];

  /* ---------- build the whole model ---------- */
  function build() {
    var att = collect(), cf = cfg();
    var days = {};
    att.forEach(function (a) {
      var d = days[a.day] || (days[a.day] = { count: 0, good: false, xp: 0 });
      d.count++; d.xp += a.xp;
      var acc = a.r.attempted ? a.r.correct / a.r.attempted * 100 : 0;
      if (a.r.attempted >= 5 && acc >= 75) d.good = true;
    });
    var dayKeys = Object.keys(days).sort();
    /* bonuses: quests + streak */
    var questXP = 0, streakXP = 0, run = 0, prev = null, longest = 0;
    dayKeys.forEach(function (k) {
      run = (prev && addDays(prev, 1) === k) ? run + 1 : 1;
      longest = Math.max(longest, run); prev = k;
      var d = days[k];
      QUEST_DEFS.forEach(function (q) { if (q.prog(d) >= q.goal) questXP += q.reward; });
      streakXP += Math.min(run, 7) * 10;
    });
    var today = dayKey(Date.now()), yest = addDays(today, -1);
    var current = 0;
    if (days[today] || days[yest]) { var k = days[today] ? today : yest; while (days[k]) { current++; k = addDays(k, -1); } }
    var attemptXP = att.reduce(function (s, a) { return s + a.xp; }, 0);
    var totalXP = attemptXP + questXP + streakXP;
    var lv = levelInfo(totalXP, G), rank = rankOf(lv.level);

    /* subjects */
    var subjects = (cf.subjects || []).map(function (s) {
      var mine = att.filter(function (a) { return a.subject === s.key; });
      var xp = mine.reduce(function (t, a) { return t + a.xp; }, 0);
      var info = levelInfo(xp, SUBJ);
      var accs = mine.map(function (a) { return a.r.accuracy != null ? a.r.accuracy : 0; });
      var avg = accs.length ? accs.reduce(function (x, y) { return x + y; }, 0) / accs.length : 0;
      var last5 = accs.slice(-5), recent = last5.length ? last5.reduce(function (x, y) { return x + y; }, 0) / last5.length : 0;
      var prev3 = accs.slice(-6, -3), last3 = accs.slice(-3), trend = 0;
      if (prev3.length && last3.length) {
        var pa = prev3.reduce(function (x, y) { return x + y; }, 0) / prev3.length, la = last3.reduce(function (x, y) { return x + y; }, 0) / last3.length;
        trend = la - pa > 3 ? 1 : (la - pa < -3 ? -1 : 0);
      }
      var best = 0; mine.forEach(function (a) { if (a.r.maxMarks) best = Math.max(best, a.r.score / a.r.maxMarks * 100); });
      var timeSum = 0, qSum = 0; mine.forEach(function (a) { timeSum += a.r.timeTaken || 0; qSum += a.r.attempted || 0; });
      return { key: s.key, label: s.label || s.key, attempts: mine.length, xp: xp, level: info.level, into: info.into, need: info.need, pct: info.pct,
        avg: Math.round(avg * 10) / 10, recent: Math.round(recent * 10) / 10, grade: mine.length ? gradeOf(recent) : "-", trend: trend,
        best: Math.round(best), secPerQ: qSum ? Math.round(timeSum / qSum) : 0, correct: mine.reduce(function (t, a) { return t + (a.r.correct || 0); }, 0) };
    });
    var entered = subjects.filter(function (s) { return s.attempts > 0; });
    if (entered.length > 1) {
      var sorted = entered.slice().sort(function (a, b) { return b.recent - a.recent; });
      sorted[0].tag = "strong"; if (sorted[sorted.length - 1].recent < sorted[0].recent) sorted[sorted.length - 1].tag = "weak";
    }

    /* core stats */
    var n = att.length, totalCorrect = att.reduce(function (t, a) { return t + (a.r.correct || 0); }, 0);
    var accAvg = n ? att.reduce(function (t, a) { return t + (a.r.accuracy || 0); }, 0) / n : 0;
    var secs = n ? att.reduce(function (t, a) { return t + (a.r.attempted ? (a.r.timeTaken || 0) / a.r.attempted : 0); }, 0) / n : 0;
    var active14 = 0; for (var i = 0; i < 14; i++) if (days[addDays(today, -i)]) active14++;
    var endur = n ? att.reduce(function (t, a) { return t + (a.r.total ? (a.r.attempted || 0) / a.r.total : 0); }, 0) / n * 100 : 0;
    var stats = {
      accuracy: Math.round(clamp(accAvg, 0, 100)),
      speed: n ? Math.round(clamp(110 - secs, 5, 100)) : 0,
      consistency: n ? Math.round(clamp(active14 / 14 * 70 + Math.min(current, 7) / 7 * 30, 0, 100)) : 0,
      endurance: Math.round(clamp(endur, 0, 100)),
      knowledge: Math.round(clamp(totalCorrect / 4, 0, 100))
    };
    var power = Math.round((stats.accuracy + stats.speed + stats.consistency + stats.endurance + stats.knowledge) / 5 * 100);

    /* quests (today) */
    var td = days[today] || { count: 0, good: false };
    var quests = QUEST_DEFS.map(function (q) { var p = Math.min(q.prog(td), q.goal); return { id: q.id, name: q.name, reward: q.reward, goal: q.goal, progress: p, done: p >= q.goal }; });

    var saved = parse(localStorage.getItem("sscscholars_saved_v1")); saved = Array.isArray(saved) ? saved.length : 0;
    var model = { attempts: att, days: days, today: today, totalXP: totalXP, attemptXP: attemptXP, bonusXP: questXP + streakXP,
      level: lv.level, into: lv.into, need: lv.need, pct: lv.pct, rank: rank, subjects: subjects, stats: stats, power: power,
      streak: { current: current, longest: longest, doneToday: !!days[today] }, quests: quests, saved: saved,
      totalCorrect: totalCorrect, totalWrong: att.reduce(function (t, a) { return t + (a.r.wrong || 0); }, 0) };
    model.achievements = achievements(model);
    model.advice = advice(model);
    return model;
  }

  /* ---------- achievements ---------- */
  function achievements(m) {
    var n = m.attempts.length;
    var perfect = m.attempts.some(function (a) { return a.r.attempted >= 10 && a.r.wrong === 0 && a.r.correct === a.r.attempted; });
    var comeback = false, byTest = {};
    m.attempts.forEach(function (a) {
      var k = a.y + a.subject + a.setId, p = byTest[k];
      if (p && a.r.accuracy - p.r.accuracy >= 20) comeback = true;
      byTest[k] = a;
    });
    var subjMax = Math.max.apply(null, m.subjects.map(function (s) { return s.level; }).concat([1]));
    var allSubj = m.subjects.length && m.subjects.every(function (s) { return s.attempts > 0; });
    var fast = n >= 3 && m.stats.speed >= 80;
    return [
      { name: "First Blood", desc: "Clear your first mock test", icon: "\u2694\uFE0F", got: n >= 1 },
      { name: "Gate Crasher", desc: "Clear 10 mock tests", icon: "\uD83D\uDEAA", got: n >= 10 },
      { name: "Dungeon Master", desc: "Clear 50 mock tests", icon: "\uD83C\uDFF0", got: n >= 50 },
      { name: "On Fire", desc: "Reach a 3-day streak", icon: "\uD83D\uDD25", got: m.streak.longest >= 3 },
      { name: "Unstoppable", desc: "Reach a 7-day streak", icon: "\u26A1", got: m.streak.longest >= 7 },
      { name: "Iron Will", desc: "Reach a 30-day streak", icon: "\uD83D\uDEE1\uFE0F", got: m.streak.longest >= 30 },
      { name: "Perfectionist", desc: "100% accuracy in a mock (10+ attempted)", icon: "\uD83C\uDFAF", got: perfect },
      { name: "Comeback Kid", desc: "Improve accuracy by 20+ points on a retake", icon: "\uD83D\uDCC8", got: comeback },
      { name: "Speed Runner", desc: "Reach 80+ SPEED stat", icon: "\uD83D\uDCA8", got: fast },
      { name: "Bookworm", desc: "Save 10 questions", icon: "\uD83D\uDCDA", got: m.saved >= 10 },
      { name: "All-Rounder", desc: "Clear a mock in every subject", icon: "\uD83C\uDF10", got: !!allSubj },
      { name: "Specialist", desc: "Reach level 5 in any subject", icon: "\uD83E\uDDE0", got: subjMax >= 5 },
      { name: "Rising Hunter", desc: "Reach Hunter level 10", icon: "\uD83C\uDF1F", got: m.level >= 10 },
      { name: "Elite", desc: "Reach B-Rank (level 17)", icon: "\uD83D\uDC8E", got: m.level >= 17 }
    ];
  }

  /* ---------- system analysis ---------- */
  function advice(m) {
    var out = [];
    if (!m.attempts.length) return [{ t: "info", text: "No battle data yet. Clear your first gate (any mock test) to awaken your stats." }];
    var entered = m.subjects.filter(function (s) { return s.attempts > 0; });
    var weak = entered.slice().sort(function (a, b) { return a.recent - b.recent; })[0];
    var strong = entered.slice().sort(function (a, b) { return b.recent - a.recent; })[0];
    if (weak && weak.recent < 65) out.push({ t: "warn", text: "Weak point detected: " + weak.label + " (recent accuracy " + Math.round(weak.recent) + "%). Clear 2 more " + weak.label + " mocks and review every wrong answer." });
    if (strong && entered.length > 1 && strong !== weak) out.push({ t: "good", text: "Strongest dungeon: " + strong.label + " (grade " + strong.grade + "). Keep it sharp with one mock a week." });
    var att = m.totalCorrect + m.totalWrong;
    if (att && m.totalWrong / att > 0.3) out.push({ t: "warn", text: "Wrong answers are " + Math.round(m.totalWrong / att * 100) + "% of what you attempt. Negative marking is draining you: skip the questions you are guessing." });
    if (m.stats.speed && m.stats.speed < 45) out.push({ t: "warn", text: "Speed is low. Practise with a stopwatch: aim for under 45 seconds per question." });
    if (m.stats.endurance < 70) out.push({ t: "warn", text: "You leave many questions unattempted (endurance " + m.stats.endurance + "). Attempt every question you can solve in 30 seconds first." });
    var missing = m.subjects.filter(function (s) { return !s.attempts; });
    if (missing.length && entered.length) out.push({ t: "info", text: "Unexplored dungeons: " + missing.map(function (s) { return s.label; }).join(", ") + ". Gates there give fresh XP." });
    if (m.streak.current > 0 && !m.streak.doneToday) out.push({ t: "warn", text: "Your " + m.streak.current + "-day streak ends tonight. Clear one mock to keep it alive." });
    if (!out.length) out.push({ t: "good", text: "All systems stable. Keep clearing gates and your level will keep rising." });
    return out.slice(0, 5);
  }

  var QUOTES = [
    "Every mock you clear is a gate you will never have to fear again.",
    "Rank is not given. It is earned one question at a time.",
    "Your competition is the version of you from yesterday.",
    "A wrong answer today is a free lesson. A repeated one is a choice.",
    "The exam hall is just another dungeon. You have already trained for it.",
    "Small daily XP beats rare heroic effort. Show up today.",
    "Weak stats are not a verdict. They are a quest waiting to be accepted.",
    "Speed comes from repetition. Accuracy comes from honest review.",
    "Do not count the questions left. Clear the one in front of you.",
    "Nobody remembers the tired days. They remember the result.",
    "Discipline is the real level-up skill. Everything else is just numbers.",
    "Review your mistakes like a hunter studies a boss: calmly, completely.",
    "You do not need motivation. You need the next question.",
    "Silent practice, loud results.",
    "The seat you want has a name on it. Keep earning the name.",
    "Fall seven times, retake eight. Attempt history keeps the proof.",
    "Stay hungry for marks. Stay patient with progress.",
    "One more mock. One more level. One step closer to the post.",
    "Fear fades when you have seen the question type fifty times.",
    "Strong hunters train when nobody is watching.",
    "Today's grind is tomorrow's easy question.",
    "Consistency turns an ordinary player into a monarch.",
    "Your streak is a promise you made to yourself. Keep it.",
    "Be so prepared that luck has nothing to do.",
    "Hard questions are only unlocked levels. Keep pushing.",
    "Progress is quiet. Check the status window, not the noise.",
    "Arise, hunter. The paper will not solve itself.",
    "Every expert once got the same question wrong."
  ];

  window.Hunter = {
    xpOf: xpOf, build: build, levelInfo: levelInfo, rankOf: rankOf, gradeOf: gradeOf, RANKS: RANKS,
    getProfile: getProfile, saveProfile: saveProfile, quotes: QUOTES, PROFILE_KEY: PROFILE_KEY, dayKey: dayKey, addDays: addDays
  };
})();
