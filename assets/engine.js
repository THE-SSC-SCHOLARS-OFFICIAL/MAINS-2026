/* ============================================================
   THE SSC SCHOLARS OFFICIAL -- Mock Test Engine
   SSC CBT style exam flow:
   instructions (2 pages) -> test (Save & Next / Mark for Review /
   shaped palette / pause / submit) -> analysis -> solutions.
   Contract with the loader:  window.MOCK_CFG, window.MOCK_QUESTIONS
   Saved state keeps the same shape the hub reads (phase, timeLeft, result.score/maxMarks).
   ============================================================ */
var CFG = window.MOCK_CFG;
var QUESTIONS = window.MOCK_QUESTIONS;
var N = QUESTIONS.length;
var STORAGE_KEY = CFG.storageKey;
var SECS = CFG.sections;
var NS = SECS.length;
function secOf(i){ for(var k=0;k<NS;k++){ if(i>=SECS[k].start && i<SECS[k].end) return k; } return NS-1; }
function curSec(){ return SECS[state.secIdx]; }
var OPT_LETTERS = ["A","B","C","D","E"];
var OPT_KEYS = ["option_1","option_2","option_3","option_4","option_5"];
var hasHindi = QUESTIONS.some(function(q){ return q.question && q.question.hi; });

var state = null;
var timerHandle = null;
var REVIEW_ID = new URLSearchParams(location.search).get("attempt");   /* ?attempt=<id> opens a past attempt read-only */
var REVIEW = !!REVIEW_ID;
var draft = null;            /* option picked on the current question but not saved yet */

function $(id){ return document.getElementById(id); }
function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function freshState(){
  var qs = [];
  for(var i=0;i<N;i++){ qs.push({status:"notvisited", selected:null, solutionSeen:false, t:0}); }
  return {
    phase: "welcome", current: 0, q: qs, instantFeedback: false,
    timeLeft: SECS[0].seconds, startedAt: null, finishedAt: null, result: null,
    secIdx: 0, secDone: [], secTaken: [], between: false, solSec: 0,
    solIndex: 0, solFilter: "all", palHidden: false, solPalHidden: false, lang: "en", solLang: "en"
  };
}
function loadState(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return freshState();
    var parsed = JSON.parse(raw);
    if(!parsed || parsed.n !== N || !parsed.s || !parsed.s.q || parsed.s.q.length !== N) return freshState();
    var s = parsed.s;
    s.q.forEach(function(x){ if(typeof x.t !== "number") x.t = 0; });
    if(!s.solFilter) s.solFilter = "all";
    if(s.lang === "bilingual") s.lang = "bi";
    if(typeof s.secIdx !== "number" || s.secIdx < 0 || s.secIdx >= NS) return freshState();
    if(!Array.isArray(s.secDone)) s.secDone = [];
    if(!Array.isArray(s.secTaken)) s.secTaken = [];
    if(typeof s.solSec !== "number") s.solSec = 0;
    var cs = SECS[s.secIdx];
    if(s.current < cs.start || s.current >= cs.end) s.current = cs.start;
    return s;
  }catch(e){ return freshState(); }
}
function saveState(){
  if(REVIEW) return;                    /* reviewing an old attempt never changes any saved data */
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({n:N, s:state})); }catch(e){}
}

function escapeHtml(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

/* ---- bilingual-aware text helpers ---- */
function pick(en, hi, lang){
  en = en || ""; hi = hi || "";
  if(lang === "hi" && hi) return '<div class="hi">' + hi + '</div>';
  if(lang === "bi" && hi && en){
    if(hi.replace(/\s+/g,"") === en.replace(/\s+/g,"")) return en;
    return en + '<hr class="bi-sep"><div class="hi">' + hi + '</div>';
  }
  return en || hi;
}
function qHtml(q, lang){ return pick(q.question.en, q.question.hi, lang); }
function optHtml(q, key, lang){ var o = q.options[key]; return o ? pick(o.en, o.hi, lang) : ""; }
function solHtml(q, lang){ return q.solution_text ? pick(q.solution_text.en, q.solution_text.hi, lang) : ""; }

function pad2(n){ n = Math.floor(n); return n < 10 ? "0"+n : ""+n; }
function fmtClock(sec){ sec = Math.max(0, Math.floor(sec)); return pad2(Math.floor(sec/60)) + ":" + pad2(sec%60); }
function fmtLong(sec){ sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60; return (h ? h+"h " : "") + m + "m " + s + "s"; }
function fmtShort(sec){ sec = Math.max(0, Math.round(sec)); return sec < 60 ? sec + "s" : Math.floor(sec/60) + "m " + (sec%60) + "s"; }
function num(v, d){ var n = parseFloat(v); return isNaN(n) ? d : n; }
function qScore(q){ return num(q.correct_score, CFG.defaultCorrectScore); }
function qNeg(q){ return num(q.negative_score, CFG.defaultNegativeScore); }
function r2(v){ return Math.round(v*100)/100; }

var toastT = null;
function toast(msg){
  var t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("show"); }, 2600);
}

/* ================= THEME / ZOOM / FULLSCREEN ================= */
function setThemeIcon(){
  var dark = document.documentElement.getAttribute("data-theme") === "dark";
  $all(".ic-theme").forEach(function(e){ e.innerHTML = dark ? "&#9788;" : "&#9790;"; });
  var m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = dark ? "#171a22" : "#ffffff";
}
function toggleDark(){
  var dark = document.documentElement.getAttribute("data-theme") === "dark";
  if(dark) document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme","dark");
  try{ localStorage.setItem("sscscholars_theme", dark ? "light" : "dark"); }catch(e){}
  setThemeIcon();
}
var ZOOM_KEY = "sscscholars_zoom_level";
var zoomLevel = 1;
try{ var zz = parseFloat(localStorage.getItem(ZOOM_KEY)); if(zz >= 0.6 && zz <= 3) zoomLevel = zz; }catch(e){}
function zoomChange(dir){ zoomLevel = Math.min(3, Math.max(0.6, Math.round((zoomLevel + dir*0.1)*100)/100)); applyZoom(); }
function zoomReset(){ zoomLevel = 1; applyZoom(); }
function applyZoom(){
  document.documentElement.style.setProperty("--z", zoomLevel);
  $all(".zoomLabel").forEach(function(l){ l.textContent = Math.round(zoomLevel*100) + "%"; });
  try{ localStorage.setItem(ZOOM_KEY, String(zoomLevel)); }catch(e){}
  applyImgZoom();
}
function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){ document.documentElement.requestFullscreen().catch(function(){}); }
    else { document.exitFullscreen().catch(function(){}); }
  }catch(e){}
}
document.addEventListener("fullscreenchange", function(){
  var on = !!document.fullscreenElement;
  var a = $("fsEnter"), b = $("fsExit");
  if(a) a.style.display = on ? "none" : "block";
  if(b) b.style.display = on ? "block" : "none";
});

/* ---- images inside question / option / solution HTML follow the same zoom ---- */
function sizeImg(img){
  if(!img.naturalWidth) return;
  var host = img.closest(".qbody") || img.closest(".explbox") || document.body;
  var cap = Math.max(160, host.clientWidth - 90);
  var base = Math.min(img.naturalWidth, cap);
  img.style.width = Math.round(base * zoomLevel) + "px";
  img.style.height = "auto";
}
function applyImgZoom(){
  var imgs = document.querySelectorAll(".zwrap img");
  for(var i=0;i<imgs.length;i++){ sizeImg(imgs[i]); }
}
/* ---- Maths (LaTeX) rendering: KaTeX if loaded, else readable plain-text fallback ---- */
var MATH_DELIMS = [
  {left:"$$", right:"$$", display:true},
  {left:"\\[", right:"\\]", display:true},
  {left:"\\(", right:"\\)", display:false}
];
function texToHtml(t){
  var s = t;
  s = s.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002");
  s = s.replace(/\\left|\\right|\\displaystyle|\\!|\\,|\\;|\\:/g, "");
  s = s.replace(/\\text\{([^{}]*)\}|\\mathrm\{([^{}]*)\}|\\textbf\{([^{}]*)\}/g, function(m,a,b,c){ return a||b||c||""; });
  for(var i=0;i<4;i++){
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
    s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "<sup>$1</sup>&radic;($2)");
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, "&radic;($1)");
  }
  s = s.replace(/\\sqrt\s*([0-9a-zA-Z])/g, "&radic;$1");
  s = s.replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>").replace(/\^([0-9a-zA-Z])/g, "<sup>$1</sup>");
  s = s.replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>").replace(/_([0-9a-zA-Z])/g, "<sub>$1</sub>");
  var map = {times:"×", div:"÷", pm:"±", mp:"∓", cdot:"·", le:"≤", leq:"≤", ge:"≥", geq:"≥", ne:"≠", neq:"≠",
    approx:"≈", circ:"°", pi:"π", theta:"θ", alpha:"α", beta:"β", gamma:"γ", delta:"δ", Delta:"Δ", sigma:"σ",
    lambda:"λ", mu:"μ", infty:"∞", therefore:"∴", because:"∵", rightarrow:"→", Rightarrow:"⇒", to:"→",
    angle:"∠", triangle:"△", perp:"⊥", parallel:"∥", degree:"°", ldots:"…", cdots:"…", dots:"…", quad:" ", qquad:"  "};
  s = s.replace(/\\([a-zA-Z]+)/g, function(m,n){ return map.hasOwnProperty(n) ? map[n] : n; });
  s = s.replace(/\\%/g, "%").replace(/\\&/g, "&").replace(/\\\\/g, "<br>").replace(/\\ /g, " ");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  return s;
}
function mathFallback(root){
  var h = root.innerHTML;
  if(h.indexOf("\\(") === -1 && h.indexOf("\\[") === -1 && h.indexOf("$$") === -1) return;
  h = h.replace(/\\\(([\s\S]*?)\\\)/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  h = h.replace(/\\\[([\s\S]*?)\\\]/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  h = h.replace(/\$\$([\s\S]*?)\$\$/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  root.innerHTML = h;
}
function renderMath(root){
  if(!root) return;
  if(typeof renderMathInElement === "function"){
    try{ renderMathInElement(root, {delimiters: MATH_DELIMS, throwOnError:false, strict:false}); }catch(e){ mathFallback(root); }
  } else {
    mathFallback(root);
  }
}

function decorateImages(root){
  if(!root) return;
  renderMath(root);
  var imgs = root.querySelectorAll("img");
  for(var i=0;i<imgs.length;i++){
    var img = imgs[i];
    if(img.parentNode && img.parentNode.classList && img.parentNode.classList.contains("zwrap")) continue;
    img.removeAttribute("style");
    img.removeAttribute("width");
    img.removeAttribute("height");
    var wrap = document.createElement("span");
    wrap.className = "zwrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    var b = document.createElement("button");
    b.type = "button"; b.className = "zbtn"; b.title = "Open full-size / zoom"; b.innerHTML = "&#128269;";
    wrap.appendChild(b);
    if(img.complete && img.naturalWidth){ sizeImg(img); }
    else { img.addEventListener("load", function(e){ sizeImg(e.target); }); }
  }
}
window.addEventListener("resize", function(){ applyImgZoom(); });

/* ---- Lightbox: wheel zoom, drag to pan, fit / 1:1 ---- */
var lb = {scale:1, x:0, y:0, drag:false, sx:0, sy:0, fitScale:1};
function lbEl(){ return {box:$("imgLightbox"), stage:$("lbStage"), img:$("lbImg")}; }
function lbApply(){
  var e = lbEl();
  e.img.style.transform = "translate(" + lb.x + "px," + lb.y + "px) scale(" + lb.scale + ")";
  $("lbPct").textContent = Math.round(lb.scale*100) + "%";
}
function lbOpen(src){
  var e = lbEl();
  e.box.classList.add("show");
  e.img.onload = function(){ lbFit(); };
  e.img.src = src;
  if(e.img.complete && e.img.naturalWidth){ lbFit(); }
}
function lbFit(){
  var e = lbEl();
  var sw = e.stage.clientWidth, sh = e.stage.clientHeight;
  var iw = e.img.naturalWidth || 1, ih = e.img.naturalHeight || 1;
  var sc = Math.min(sw/iw, sh/ih);
  lb.fitScale = sc;
  /* small images: blow them up so they are actually readable */
  if(sc > 1) sc = Math.min(sc, 4);
  lb.scale = sc;
  lb.x = (sw - iw*sc)/2; lb.y = (sh - ih*sc)/2;
  lbApply();
}
function lbActual(){
  var e = lbEl();
  var sw = e.stage.clientWidth, sh = e.stage.clientHeight;
  lb.scale = 1;
  lb.x = (sw - e.img.naturalWidth)/2; lb.y = (sh - e.img.naturalHeight)/2;
  lbApply();
}
function lbZoomAt(factor, cx, cy){
  var ns = Math.min(12, Math.max(0.1, lb.scale * factor));
  var k = ns / lb.scale;
  lb.x = cx - (cx - lb.x) * k;
  lb.y = cy - (cy - lb.y) * k;
  lb.scale = ns;
  lbApply();
}
function lbZoom(dir){
  var e = lbEl();
  lbZoomAt(dir > 0 ? 1.25 : 0.8, e.stage.clientWidth/2, e.stage.clientHeight/2);
}
function lbClose(){ $("imgLightbox").classList.remove("show"); }
function lbIsOpen(){ return $("imgLightbox").classList.contains("show"); }

(function initLightbox(){
  var stage = $("lbStage");
  stage.addEventListener("wheel", function(ev){
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    lbZoomAt(ev.deltaY < 0 ? 1.15 : 1/1.15, ev.clientX - r.left, ev.clientY - r.top);
  }, {passive:false});
  stage.addEventListener("pointerdown", function(ev){
    lb.drag = true; lb.sx = ev.clientX - lb.x; lb.sy = ev.clientY - lb.y;
    stage.classList.add("drag");
    try{ stage.setPointerCapture(ev.pointerId); }catch(e){}
  });
  stage.addEventListener("pointermove", function(ev){
    if(!lb.drag) return;
    lb.x = ev.clientX - lb.sx; lb.y = ev.clientY - lb.sy; lbApply();
  });
  function endDrag(){ lb.drag = false; stage.classList.remove("drag"); }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("dblclick", function(){
    if(Math.abs(lb.scale - lb.fitScale) < 0.02 || lb.fitScale > 1){ var e = lbEl(); lbZoomAt(2, e.stage.clientWidth/2, e.stage.clientHeight/2); }
    else { lbFit(); }
  });
  /* two-finger pinch on touch screens */
  var pts = {}, pinchD = 0;
  stage.addEventListener("pointerdown", function(ev){ pts[ev.pointerId] = ev; });
  stage.addEventListener("pointermove", function(ev){
    if(!pts[ev.pointerId]) return;
    pts[ev.pointerId] = ev;
    var ids = Object.keys(pts);
    if(ids.length === 2){
      var a = pts[ids[0]], b = pts[ids[1]];
      var d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      if(pinchD){
        var r = stage.getBoundingClientRect();
        lbZoomAt(d/pinchD, (a.clientX+b.clientX)/2 - r.left, (a.clientY+b.clientY)/2 - r.top);
      }
      pinchD = d;
    }
  });
  function pend(ev){ delete pts[ev.pointerId]; pinchD = 0; }
  stage.addEventListener("pointerup", pend);
  stage.addEventListener("pointercancel", pend);

  /* open lightbox: magnifier button always; clicking the picture itself everywhere
     except inside answer options (there a click must still select the option) */
  document.addEventListener("click", function(ev){
    var t = ev.target;
    if(!t || !t.closest) return;
    var wrap = t.closest(".zwrap");
    if(!wrap) return;
    var img = wrap.querySelector("img");
    if(!img) return;
    var isBtn = t.classList.contains("zbtn");
    var inOption = !!t.closest(".opt-radio");
    if(isBtn || !inOption){
      ev.preventDefault(); ev.stopPropagation();
      lbOpen(img.currentSrc || img.src);
    }
  }, true);
})();


/* ================= SCREEN SWITCHING ================= */
function showScreen(id){
  ["welcomePage","testPage","resultPage","solutionPage"].forEach(function(s){
    $(s).classList.toggle("hidden-page", s !== id);
  });
  document.body.classList.remove("pal-open");
  $("toast").classList.remove("show");
  window.scrollTo(0,0);
}

/* ================= STATIC TEXT ================= */
function initStaticText(){
  var brand = (window.HUB_CONFIG && window.HUB_CONFIG.brand) || "THE SSC SCHOLARS OFFICIAL";
  document.title = CFG.examTitle + " | " + brand;
  var mins = 0; SECS.forEach(function(x){ mins += x.minutes; });
  var posNeg = "-" + CFG.negativeScoreDisplay;
  $("wsHeaderTitle").textContent = CFG.examTitle;
  $("resHdrTitle").textContent = CFG.examTitle;
  $("ovTime").textContent = mins;
  $("ovQ").textContent = N;
  $("ovCor").textContent = "+" + CFG.correctScoreDisplay;
  $("ovNeg").textContent = posNeg;
  var rows = "";
  SECS.forEach(function(x){
    var m = 0; for(var i=x.start;i<x.end;i++) m += qScore(QUESTIONS[i]);
    rows += "<tr><td>Part " + x.part + "</td><td>" + escapeHtml(x.name) + (x.qualifying ? " <small>(qualifying)</small>" : "") + "</td><td>" + x.count + "</td><td>" + x.minutes + " min</td><td>" + r2(m) + "</td><td>" + posNeg + "</td></tr>";
  });
  $("ovRows").innerHTML = rows;
  $("insCor").textContent = CFG.correctScoreDisplay;
  $("insNeg").textContent = CFG.negativeScoreDisplay;
  $("hdrTitle").textContent = CFG.examTitle;
  $("solHdrTitle").textContent = CFG.examTitle;
  $("resTitle").textContent = CFG.examTitle;
  var mainMax = 0; SECS.forEach(function(x){ if(!x.qualifying) mainMax += x.count * CFG.defaultCorrectScore; });
  $("resSub").textContent = "Main Paper \u00B7 " + r2(mainMax) + " marks (Computer is qualifying, shown separately)";
  $("mainMax").textContent = r2(mainMax);
  $("qMarks").innerHTML = '<span class="p">+' + CFG.correctScoreDisplay + '</span> / <span class="n">-' + CFG.negativeScoreDisplay + '</span>';
  if(hasHindi){
    $("langBox").style.display = "block"; $("langWrap").style.display = "flex"; $("solLangWrap").style.display = "flex";
  } else {
    $("optBox").querySelector(".opt-practice").style.flex = "1";
  }
  setThemeIcon();
}

/* ================= SECTION BAR ================= */
function renderSecTabs(){
  var h = "", sx = SECS[state.secIdx];
  h += '<span class="sec-btn active sec-now"><span class="pt">P' + sx.part + '</span>' + escapeHtml(sx.short) + '</span>';
  h += '<span class="sec-step">Section ' + (state.secIdx + 1) + ' of ' + NS + '</span>';
  $("secTabs").innerHTML = h;
  var cs = curSec(), last = state.secIdx === NS - 1;
  $("secInfo").textContent = cs.count + " questions \u00B7 " + cs.minutes + " min" + (cs.qualifying ? " \u00B7 qualifying" : "");
  $("hdrSub").textContent = "Part " + cs.part + " \u00B7 " + cs.name;
  $("paletteTitle").textContent = "Section : " + cs.short;
  $("paletteSecHead").textContent = cs.name;
  var lbl = last ? "Submit Test" : "Submit Section";
  $("submitTopBtn").textContent = lbl; $("submitBigBtn").textContent = lbl;
}

/* ================= INSTRUCTIONS ================= */
function wsPage(n){
  $("wsPage1").classList.toggle("active", n === 1);
  $("wsPage2").classList.toggle("active", n === 2);
}
function initWelcome(){
  $("instrConfirm").addEventListener("change", function(){ $("startTestBtn").disabled = !this.checked; });
  $("startTestBtn").addEventListener("click", function(){
    if(!$("instrConfirm").checked) return;
    state.instantFeedback = $("instantFeedbackToggle").checked;
    if(hasHindi) state.lang = $("welcomeLang").value;
    state.phase = "testing";
    state.startedAt = state.startedAt || Date.now();
    saveState();
    enterTestPage();
    try{ var el = document.documentElement; if(el.requestFullscreen){ el.requestFullscreen().catch(function(){}); } }catch(e){}
  });
}
function enterTestPage(){
  showScreen("testPage");
  $("langSelect").value = state.lang;
  applyPalState();
  renderSecTabs();
  if(state.between){ showInterlude(state.secIdx - 1); return; }
  loadQuestion(state.current, true);
  startTimer();
}

/* ================= STATUS / PALETTE ================= */
function statusCounts(){
  return statusCountsFor(state.secIdx);
}
function statusCountsFor(k){
  var c = {notvisited:0, notanswered:0, answered:0, marked:0, markedans:0}, x = SECS[k];
  for(var i=x.start;i<x.end;i++){ c[state.q[i].status]++; }
  return c;
}
function paletteButton(i, cls, extra, base){
  var bm = savedIds[sid(i)] ? '<span class="bm" title="Saved"></span>' : "";
  return '<button type="button" class="qnum ' + cls + (extra||"") + '" onclick="' + (cls.indexOf("sol") === 0 ? "solGoTo(" : "goTo(") + i + ')"><span class="shape"></span><span class="n">' + (i - base + 1) + '</span>' + bm + '</button>';
}

/* ================= SAVED QUESTIONS (bookmarks, shown in Mock Hub > Saved) ================= */
var savedIds = {};
/* works even if an older common.js (without the saved-questions store) is still deployed */
function hcOk(){ return !!(window.HubCommon && typeof HubCommon.readSaved === "function" && typeof HubCommon.addSaved === "function"); }
function sid(i){ return [CFG.year, CFG.subject, CFG.setId, i].join("|"); }
function refreshSavedIds(){
  savedIds = {};
  if(!hcOk()) return;
  try{ HubCommon.readSaved().forEach(function(e){ savedIds[e.id] = 1; }); }catch(e){}
}
function previewText(q){
  var t = (q.question.en || q.question.hi || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 170 ? t.slice(0, 167) + "..." : t;
}
function toggleSaveFor(i, mark){
  if(!hcOk()){ toast("Save needs the latest assets/common.js on the site"); return; }
  var id = sid(i);
  if(savedIds[id]){
    HubCommon.removeSaved(id);
    toast("Removed from Saved");
  } else {
    var q = QUESTIONS[i];
    var res = !mark ? "skipped" : (mark === q.answer ? "correct" : "wrong");
    var ok = HubCommon.addSaved({
      id: id, y: CFG.year, s: CFG.subject, set: CFG.setId, i: i,
      chapter: SECS[secOf(i)].name, title: CFG.setTitle, topic: q.topic || "",
      preview: previewText(q), mark: mark || "", res: res, at: Date.now()
    });
    toast(ok ? "Saved. Find it in Mock Hub > Saved" : "Could not save: browser storage is full");
  }
  refreshSavedIds();
  paintSaveBtns();
}
function toggleSave(){ if(state.phase !== "testing") return; toggleSaveFor(state.current, draft); renderPalette(); }
function toggleSolSave(){ toggleSaveFor(state.solIndex, state.q[state.solIndex].selected); renderSolPalette(); }
function paintSaveBtns(){
  [["saveBtn", state.current], ["solSaveBtn", state.solIndex]].forEach(function(p){
    var b = $(p[0]); if(!b) return;
    var on = !!savedIds[sid(p[1])];
    b.classList.toggle("on", on);
    b.querySelector("span").textContent = on ? "Saved" : "Save";
  });
}
function renderPalette(){
  var html = "";
  var cs = curSec();
  for(var i=cs.start;i<cs.end;i++){ html += paletteButton(i, state.q[i].status, i === state.current ? " current" : "", cs.start); }
  $("paletteGrid").innerHTML = html;
  var c = statusCounts();
  var pills = $all("#paletteWrap .pal-legend .pal");
  var vals = [c.answered, c.notanswered, c.notvisited, c.marked, c.markedans];
  pills.forEach(function(p, k){ p.textContent = vals[k]; });
  var cur = $("paletteGrid").querySelector(".current");
  if(cur && cur.scrollIntoView){ try{ cur.scrollIntoView({block:"nearest"}); }catch(e){} }
}
function togglePalette(){ state.palHidden = !state.palHidden; applyPalState(); saveState(); }
function applyPalState(){
  var onSol = !$("solutionPage").classList.contains("hidden-page");
  document.body.classList.toggle("pal-hidden", onSol ? !!state.solPalHidden : !!state.palHidden);
  $("collapseArrow").innerHTML = state.palHidden ? "&#9664;" : "&#9654;";
  $("solCollapseArrow").innerHTML = state.solPalHidden ? "&#9664;" : "&#9654;";
}
function openMobilePalette(){ document.body.classList.add("pal-open"); }
function closeMobilePalette(){ document.body.classList.remove("pal-open"); }


/* ================= PASSAGE (RC / cloze) ================= */
function paintPassage(bodyId, passId, q, lang){
  var body = $(bodyId), box = $(passId);
  var h = q.passage ? pick(q.passage.en, q.passage.hi, lang) : "";
  if(h){
    box.innerHTML = '<div class="qpass-tag">Passage</div><div class="qpass-txt">' + h + '</div>';
    box.style.display = "block"; body.classList.add("has-passage");
    box.scrollTop = 0; decorateImages(box);
  } else {
    box.innerHTML = ""; box.style.display = "none"; body.classList.remove("has-passage");
  }
}

/* ================= QUESTION RENDER ================= */
function loadQuestion(i, firstLoad){
  var st = state.q[i];
  state.current = i;
  if(st.status === "notvisited") st.status = "notanswered";
  draft = st.selected;
  renderQuestion();
  if(!firstLoad) window.scrollTo(0,0);
}

function renderQuestion(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i];
  $("qNoHeading").textContent = i - curSec().start + 1;
  var topicEl = $("qTopicTag");
  if(q.topic){ topicEl.textContent = q.topic; topicEl.style.display = "inline-block"; } else { topicEl.style.display = "none"; }

  paintPassage("qBody", "qPassage", q, state.lang);
  $("qText").innerHTML = qHtml(q, state.lang);
  var imgEl = $("qImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="' + q.question_image + '" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var html = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1);
    var img = opt.image ? '<div class="qimg"><img src="' + opt.image + '" alt="option image"></div>' : "";
    html += '<div class="opt-row" data-opt="' + val + '">' +
      '<div class="opt-radio" title="Tap the circle to select" onclick="pickOption(\'' + val + '\', event)"><input type="radio" name="opt" value="' + val + '" tabindex="-1"></div>' +
      '<div class="opt-body">' + optHtml(q, key, state.lang) + img + '</div></div>';
  });
  $("qOptions").innerHTML = html;
  decorateImages($("qText")); decorateImages($("qImg")); decorateImages($("qOptions"));

  $("showSolBtn").style.display = state.instantFeedback ? "inline-block" : "none";
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";
  $("prevBtn").disabled = (i === curSec().start);
  paintSaveBtns();
  paintSelection();
  renderPalette();
  saveState();
}

function paintSelection(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i];
  var fb = $("fbStrip");
  fb.className = "fb-strip"; fb.textContent = "";
  $all("#qOptions .opt-row").forEach(function(lab){
    var key = lab.getAttribute("data-opt");
    var sel = key === draft;
    lab.classList.toggle("selected", sel);
    lab.querySelector("input").checked = sel;
    lab.classList.remove("fb-correct","fb-wrong");
    var old = lab.querySelector(".opt-badge"); if(old) old.remove();
    if(state.instantFeedback && draft){
      var ok = key === q.answer;
      if(ok){ lab.classList.add("fb-correct"); lab.insertAdjacentHTML("beforeend", '<span class="opt-badge ok">Correct</span>'); }
      else if(sel){ lab.classList.add("fb-wrong"); lab.insertAdjacentHTML("beforeend", '<span class="opt-badge no">Your pick</span>'); }
    }
  });
  if(state.instantFeedback && draft){
    var correct = draft === q.answer;
    fb.classList.add("show", correct ? "ok" : "no");
    fb.textContent = correct ? "Correct answer!" : "Incorrect. The correct option is highlighted in green.";
  }
  $("unsavedHint").style.display = (draft !== st.selected) ? "block" : "none";
  renderLiveSolutionBox();
}

function renderLiveSolutionBox(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i], box = $("liveSolutionBox");
  if(state.instantFeedback && st.solutionSeen){
    box.style.display = "block";
    box.innerHTML = "<h4>Solution</h4><p><b>Correct Answer:</b> Option " + OPT_LETTERS[(parseInt(q.answer,10)||1)-1] + "</p>" +
      (solHtml(q, state.lang) || "<i>No solution text provided.</i>");
    decorateImages(box);
  } else { box.style.display = "none"; box.innerHTML = ""; }
}
function toggleLiveSolution(){
  var st = state.q[state.current];
  st.solutionSeen = !st.solutionSeen; saveState();
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";
  renderLiveSolutionBox();
}

/* ================= INTERACTIONS ================= */
function pickOption(val, ev){
  if(ev) ev.preventDefault();
  if(state.phase !== "testing") return;
  draft = (draft === val) ? null : val;     /* clicking the chosen option again deselects it */
  paintSelection();
}
function applyStatusFor(i){
  var st = state.q[i];
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  st.status = st.selected !== null ? (wasMarked ? "markedans" : "answered") : (wasMarked ? "marked" : "notanswered");
}
function commitDraft(){
  var st = state.q[state.current];
  st.selected = draft;
  applyStatusFor(state.current);
}
function saveAndNext(){
  if(state.phase !== "testing") return;
  commitDraft();
  if(state.current < curSec().end-1) loadQuestion(state.current + 1); else { renderQuestion(); toast("Saved. Last question of this section. Use " + (state.secIdx === NS-1 ? "Submit Test" : "Submit Section") + " when done."); }
}
function markForReview(){
  if(state.phase !== "testing") return;
  var st = state.q[state.current];
  st.selected = draft;
  st.status = st.selected !== null ? "markedans" : "marked";
  if(state.current < curSec().end-1) loadQuestion(state.current + 1); else { renderQuestion(); toast("Marked for review."); }
}
function clearResponse(){
  if(state.phase !== "testing") return;
  var st = state.q[state.current];
  draft = null; st.selected = null; st.solutionSeen = false;
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  st.status = wasMarked ? "marked" : "notanswered";
  renderQuestion();
}
function leaveWarn(){
  var st = state.q[state.current];
  if(draft !== st.selected && draft !== null) toast("Your last selection was not saved. Use Save & Next to save an answer.");
}
function goPrev(){ if(state.current > curSec().start){ leaveWarn(); loadQuestion(state.current - 1); } }
function goTo(i){
  var cs = curSec();
  if(i < cs.start || i >= cs.end || state.phase !== "testing" || state.between) return;
  if(i !== state.current) leaveWarn();
  loadQuestion(i);
  closeMobilePalette();
}
function setLang(v){ state.lang = v; saveState(); renderQuestion(); }

/* ================= PAUSE / TIMER ================= */
function openPause(){ if(state.phase === "testing" && !state.between) $("pauseModal").classList.add("show"); }
function closePause(){ $("pauseModal").classList.remove("show"); }
function doPause(){
  closePause();
  state.phase = "paused";
  clearInterval(timerHandle);
  saveState();
  $("pauseOverlay").classList.add("show");
}
function resumeTest(){
  state.phase = "testing";
  $("pauseOverlay").classList.remove("show");
  saveState();
  startTimer();
}
function startTimer(){
  if(timerHandle) clearInterval(timerHandle);
  renderTime();
  timerHandle = setInterval(function(){
    if(state.phase !== "testing" || state.between) return;
    state.timeLeft -= 1;
    state.q[state.current].t += 1;
    if(state.timeLeft <= 0){ state.timeLeft = 0; renderTime(); timeUp(); return; }
    renderTime();
    if(state.timeLeft % 5 === 0) saveState();
  }, 1000);
}
function renderTime(){
  $("timeLeft").textContent = fmtClock(state.timeLeft);
  var box = $("timeLeft").parentNode;
  if(box) box.classList.toggle("low", state.timeLeft <= 120);
}

/* ================= SUBMIT (section by section) ================= */
function openSubmit(){
  if(state.phase !== "testing" || state.between) return;
  var c = statusCounts(), last = state.secIdx === NS - 1, cs = curSec();
  $("mAnswered").textContent = c.answered + c.markedans;
  $("mNotAnswered").textContent = c.notanswered + c.marked;
  $("mMarked").textContent = c.marked + c.markedans;
  $("mNotVisited").textContent = c.notvisited;
  $("submitTitle").textContent = last ? "Submit Test?" : "Submit Section?";
  $("submitNote").innerHTML = last
    ? "Only answers saved with <b>Save &amp; Next</b> or <b>Mark for Review</b> are counted. This is the <b>last section</b>: after you submit, the test ends and you cannot change any answer."
    : "Only answers saved with <b>Save &amp; Next</b> or <b>Mark for Review</b> are counted. Once you submit <b>" + escapeHtml(cs.name) + "</b> you <b>cannot come back</b> to it, and the next section starts.";
  $("submitModal").classList.add("show");
}
function closeSubmitModal(){ $("submitModal").classList.remove("show"); }
function confirmSubmit(){ closeSubmitModal(); if(state.phase === "testing" && !state.between) endSection(false); }
function timeUp(){
  clearInterval(timerHandle);
  closeSubmitModal(); closePause();
  var last = state.secIdx === NS - 1;
  toast(last ? "Time is up. Submitting your test." : "Time is up for " + curSec().short + ". Section submitted.");
  endSection(true);
}
function endSection(auto){
  clearInterval(timerHandle);
  var k = state.secIdx, sec = SECS[k];
  state.secDone[k] = true;
  state.secTaken[k] = Math.max(0, sec.seconds - state.timeLeft);
  if(k >= NS - 1){ finishTest(); return; }
  var nx = SECS[k+1];
  state.secIdx = k + 1; state.timeLeft = nx.seconds; state.current = nx.start; state.between = true; draft = null;
  saveState();
  renderSecTabs();
  showInterlude(k);
}
function showInterlude(prev){
  var c = statusCountsFor(prev), nx = curSec();
  $("interTitle").textContent = SECS[prev].name + " submitted";
  $("iAnswered").textContent = c.answered + c.markedans;
  $("iNotAnswered").textContent = c.notanswered + c.marked;
  $("iMarked").textContent = c.marked + c.markedans;
  $("iNotVisited").textContent = c.notvisited;
  $("interNext").innerHTML = "Next: <b>" + escapeHtml(nx.name) + "</b> &middot; " + nx.count + " questions &middot; " + nx.minutes + " min. The timer starts only when you press the button.";
  $("interBtn").textContent = "Start " + nx.short;
  $("interModal").classList.add("show");
}
function startNextSection(){
  $("interModal").classList.remove("show");
  state.between = false;
  renderSecTabs();
  loadQuestion(state.current, true);
  saveState();
  startTimer();
}
function finishTest(){
  closeSubmitModal();
  clearInterval(timerHandle);
  state.phase = "submitted";
  state.between = false;
  state.finishedAt = Date.now();
  state.result = computeResult();
  saveState();
  try{
    if(window.HubCommon && typeof HubCommon.addAttempt === "function"){
      HubCommon.addAttempt(CFG.year, CFG.subject, CFG.setId, N, JSON.parse(JSON.stringify(state)));
    }
  }catch(e){}
  try{ if(document.fullscreenElement && document.exitFullscreen){ document.exitFullscreen().catch(function(){}); } }catch(e){}
  renderResult();
  showScreen("resultPage");
  showXpGain();
}

function computeResult(){ return computeResultFor(state); }
function secResult(S, k){
  var x = SECS[k], c=0, w=0, u=0, marks=0, neg=0, max=0, t=0;
  for(var i=x.start;i<x.end;i++){
    var q = QUESTIONS[i], sel = S.q[i].selected, cs = qScore(q), ns = qNeg(q);
    max += cs; t += S.q[i].t || 0;
    if(sel === null || sel === undefined){ u++; }
    else if(sel === q.answer){ c++; marks += cs; }
    else { w++; neg += ns; marks -= ns; }
  }
  var att = c + w, taken = (S.secTaken && typeof S.secTaken[k] === "number") ? S.secTaken[k] : t;
  return { key:x.key, name:x.name, short:x.short, part:x.part, qualifying:!!x.qualifying, total:x.count,
    attempted:att, correct:c, wrong:w, unattempt:u, score:r2(marks), maxMarks:r2(max), negMarksTotal:r2(neg),
    accuracy: att > 0 ? Math.round(c/att*1000)/10 : 0, timeTaken: taken, allotted: x.seconds };
}
/* Top-level numbers (score, maxMarks, correct ...) = MAIN paper (Computer excluded). The hub and dashboard read these. */
function computeResultFor(S){
  var secs = SECS.map(function(x, k){ return secResult(S, k); });
  var T = {correct:0, wrong:0, unattempt:0, attempted:0, score:0, maxMarks:0, negMarksTotal:0, total:0, timeTaken:0};
  var parts = {};
  secs.forEach(function(r){
    if(r.qualifying) return;
    T.correct += r.correct; T.wrong += r.wrong; T.unattempt += r.unattempt; T.attempted += r.attempted;
    T.score += r.score; T.maxMarks += r.maxMarks; T.negMarksTotal += r.negMarksTotal; T.total += r.total; T.timeTaken += r.timeTaken;
    var p = parts[r.part] || (parts[r.part] = {part:r.part, score:0, maxMarks:0}); p.score += r.score; p.maxMarks += r.maxMarks;
  });
  var comp = secs.filter(function(r){ return r.qualifying; })[0] || null;
  return {
    correct:T.correct, wrong:T.wrong, unattempt:T.unattempt, attempted:T.attempted,
    score:r2(T.score), maxMarks:r2(T.maxMarks), negMarksTotal:r2(T.negMarksTotal),
    accuracy: T.attempted > 0 ? Math.round(T.correct/T.attempted*1000)/10 : 0,
    timeTaken:T.timeTaken, avgTime: T.total ? Math.round(T.timeTaken / T.total) : 0, total:T.total,
    sections:secs, computer:comp,
    parts:Object.keys(parts).map(function(k){ return {part:parts[k].part, score:r2(parts[k].score), maxMarks:r2(parts[k].maxMarks)}; })
  };
}

/* "[SYSTEM] +EXP" line on the result page (Hunter dashboard) */
function showXpGain(){
  if(REVIEW || !state || !state.result) return;
  var sc = document.createElement("script");
  sc.src = "assets/hunter.js";
  sc.onload = function(){
    try{
      var xp = Hunter.xpOf(state.result, state.result.total), m = Hunter.build();
      var host = document.querySelector("#resultPage .sh-left"); if(!host) return;
      var old = $("xpGain"); if(old) old.remove();
      var d = document.createElement("div");
      d.id = "xpGain";
      d.style.cssText = "margin-top:10px;display:inline-block;background:rgba(10,20,50,.55);border:1px solid rgba(130,190,255,.75);border-radius:8px;padding:8px 12px;font-weight:800;font-size:13px;letter-spacing:.4px;";
      d.innerHTML = "[SYSTEM] +" + xp + " EXP &nbsp;&middot;&nbsp; Hunter LV." + m.level + " (" + m.rank.letter + "-Rank) &nbsp;&middot;&nbsp; <a href=\"dashboard.html\" style=\"color:#a9d4ff\">Open Dashboard</a>";
      host.insertBefore(d, host.querySelector(".sh-actions"));
    }catch(e){}
  };
  document.head.appendChild(sc);
}

/* ================= RESULT / ANALYSIS ================= */
function qOutcome(i){
  var sel = state.q[i].selected, q = QUESTIONS[i];
  if(sel === null || sel === undefined) return "skipped";
  return sel === q.answer ? "correct" : "wrong";
}
function renderResult(){
  var r = state.result || computeResult();
  $("finalScore").textContent = r.score;
  $("finalMax").textContent = "/ " + r.maxMarks;
  $("stCorrect").textContent = r.correct;
  $("stWrong").textContent = r.wrong;
  $("stUnattempt").textContent = r.unattempt;
  $("stAccuracy").textContent = r.accuracy + "%";
  $("stTimeTaken").textContent = fmtLong(r.timeTaken);
  $("stAvgTime").textContent = fmtShort(r.avgTime);
  $("stNegMarks").textContent = r.negMarksTotal;
  $("stAttempted").textContent = r.attempted + " / " + r.total;

  function row(x, cls, label){
    return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td><td>" + x.total + "</td><td>" + x.attempted + "</td><td>" + x.correct + "</td><td>" + x.wrong +
      "</td><td><b>" + x.score + "</b> / " + x.maxMarks + "</td><td>" + x.accuracy + "%</td><td>" + fmtShort(x.timeTaken) + "</td></tr>";
  }
  var head = "<thead><tr><th>Section</th><th>Questions</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Score</th><th>Accuracy</th><th>Time</th></tr></thead><tbody>";
  var th = head, lastPart = 0, partSum = {};
  r.sections.filter(function(x){ return !x.qualifying; }).forEach(function(x, idx, arr){
    th += row(x, "", escapeHtml(x.name) + ' <small style="color:var(--muted)">(Part ' + x.part + ")</small>");
    var next = arr[idx+1];
    if(!next || next.part !== x.part){
      var ps = (r.parts || []).filter(function(p){ return p.part === x.part; })[0];
      if(ps){
        var grp = arr.filter(function(y){ return y.part === x.part; }), a = 0, c = 0, w = 0, q = 0, t = 0;
        grp.forEach(function(y){ a += y.attempted; c += y.correct; w += y.wrong; q += y.total; t += y.timeTaken; });
        th += row({total:q, attempted:a, correct:c, wrong:w, score:ps.score, maxMarks:ps.maxMarks, accuracy: a ? Math.round(c/a*1000)/10 : 0, timeTaken:t}, "sub", "Part " + x.part + " total");
      }
    }
  });
  th += row({total:r.total, attempted:r.attempted, correct:r.correct, wrong:r.wrong, score:r.score, maxMarks:r.maxMarks, accuracy:r.accuracy, timeTaken:r.timeTaken}, "tot", "Main Paper Total");
  $("secTable").innerHTML = th + "</tbody>";

  var cp = document.querySelector(".comp-panel");
  if(r.computer){
    $("compTable").innerHTML = head + row(r.computer, "", escapeHtml(r.computer.name) + ' <small style="color:var(--muted)">(Part ' + r.computer.part + ", qualifying)</small>") + "</tbody>";
    cp.style.display = "";
  } else { cp.style.display = "none"; }

  /* time per question, grouped by section */
  var bars = "";
  SECS.forEach(function(x){
    var mx = 1; for(var m=x.start;m<x.end;m++) mx = Math.max(mx, state.q[m].t);
    bars += '<div class="tb-head">' + escapeHtml(x.name) + '</div><div class="timebars">';
    for(var b=x.start;b<x.end;b++){
      var oc = qOutcome(b), cl = oc === "correct" ? "tb-c" : oc === "wrong" ? "tb-w" : "tb-s";
      bars += '<div class="' + cl + '" style="height:' + Math.max(3, Math.round(state.q[b].t / mx * 100)) + '%" title="Q' + (b - x.start + 1) + ": " + fmtShort(state.q[b].t) + '"></div>';
    }
    bars += "</div>";
  });
  $("timeBars").innerHTML = bars;
}

function restartTest(){ $("reattemptModal").classList.add("show"); }
function doRestart(){
  archiveCurrent();
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  window.location.reload();
}

/* ================= SOLUTIONS ================= */
function solFiltered(){
  var f = state.solFilter, out = [], x = SECS[state.solSec];
  for(var i=x.start;i<x.end;i++){ if(f === "all" || qOutcome(i) === f) out.push(i); }
  return out;
}
function solAllFiltered(){
  var f = state.solFilter, out = [];
  for(var i=0;i<N;i++){ if(f === "all" || qOutcome(i) === f) out.push(i); }
  return out;
}
function renderSolTabs(){
  var h = '<select id="solSecSelect" class="sel sec-select" onchange="setSolSec(parseInt(this.value,10))" aria-label="Choose section">';
  for(var k=0;k<NS;k++){
    h += '<option value="' + k + '"' + (k === state.solSec ? " selected" : "") + '>Part ' + SECS[k].part + ' \u00B7 ' + escapeHtml(SECS[k].name) + ' (' + SECS[k].count + ')</option>';
  }
  h += '</select>';
  $("solSecTabs").innerHTML = h;
  $("solPaletteTitle").textContent = "Section : " + SECS[state.solSec].short;
  $("solPaletteSecHead").textContent = SECS[state.solSec].name;
}
function setSolSec(k){
  state.solSec = k;
  var list = solFiltered();
  state.solIndex = list.length ? list[0] : SECS[k].start;
  renderSolQuestion(); window.scrollTo(0,0);
}
function renderSolPalette(){
  var html = "", f = state.solFilter, x = SECS[state.solSec];
  for(var i=x.start;i<x.end;i++){
    var o = qOutcome(i);
    var cls = o === "correct" ? "solcorrect" : o === "wrong" ? "solwrong" : "solskipped";
    var extra = (i === state.solIndex ? " current" : "") + ((f !== "all" && o !== f) ? " dim" : "");
    html += paletteButton(i, cls, extra, x.start);
  }
  $("solPaletteGrid").innerHTML = html;
  var c = {correct:0, wrong:0, skipped:0};
  for(var k=x.start;k<x.end;k++) c[qOutcome(k)]++;
  var pills = $all("#solPaletteWrap .pal-legend .pal");
  [c.correct, c.wrong, c.skipped].forEach(function(v, idx){ if(pills[idx]) pills[idx].textContent = v; });
  var cur = $("solPaletteGrid").querySelector(".current");
  if(cur && cur.scrollIntoView){ try{ cur.scrollIntoView({block:"nearest"}); }catch(e){} }
}
function renderSolQuestion(){
  var i = state.solIndex, q = QUESTIONS[i], sel = state.q[i].selected, o = qOutcome(i);
  state.solSec = secOf(i);
  renderSolTabs();
  $("solQNoHeading").textContent = i - SECS[state.solSec].start + 1;
  $("solBadgeHolder").innerHTML = '<span class="sol-badge ' + o + '">' + (o === "correct" ? "Correct" : o === "wrong" ? "Wrong" : "Skipped") + "</span>";
  $("solLangSelect").value = state.solLang;
  $("solMarks").innerHTML = '<span class="p">+' + r2(qScore(q)) + '</span> / <span class="n">-' + r2(qNeg(q)) + '</span>';
  var tp = $("solTopicTag");
  if(q.topic){ tp.textContent = q.topic; tp.style.display = "inline-block"; } else { tp.style.display = "none"; }

  paintPassage("solBody", "solPassage", q, state.solLang);
  $("solQText").innerHTML = qHtml(q, state.solLang);
  var imgEl = $("solQImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="' + q.question_image + '" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var html = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1), cls = "", tag = "";
    if(val === q.answer){ cls = " right"; tag = '<span class="tagmini">CORRECT</span>'; }
    else if(val === sel){ cls = " picked-wrong"; tag = '<span class="tagmini">YOUR ANSWER</span>'; }
    html += '<div class="soloption' + cls + '"><span class="opt-letter">' + OPT_LETTERS[idx] + ')</span><span class="opt-body">' + optHtml(q, key, state.solLang) + '</span>' + tag + '</div>';
  });
  $("solOptions").innerHTML = html;

  var ans = parseInt(q.answer,10);
  $("solMeta").innerHTML =
    '<span class="sol-chip">Correct answer: <b>' + (ans ? OPT_LETTERS[ans-1] : "-") + '</b></span>' +
    '<span class="sol-chip">Your answer: <b>' + (sel ? OPT_LETTERS[parseInt(sel,10)-1] : "Not attempted") + '</b></span>' +
    '<span class="sol-chip">Time spent: <b>' + fmtShort(state.q[i].t) + '</b></span>';
  $("solExpl").innerHTML = "<h4>Explanation</h4>" + (solHtml(q, state.solLang) || "<i>No solution text provided.</i>");
  decorateImages($("solQText")); decorateImages($("solQImg")); decorateImages($("solOptions")); decorateImages($("solExpl"));

  var all = solAllFiltered(), pos = all.indexOf(i), inSec = solFiltered().length;
  $("solPrevBtn").disabled = !(pos > 0 || (pos === -1 && all.length));
  $("solNextBtn").disabled = !(pos !== -1 ? pos < all.length - 1 : all.length);
  $("solInfo").textContent = inSec ? ("Showing " + inSec + " of " + SECS[state.solSec].count + " in this section") : "No questions match this filter in this section";
  paintSaveBtns();
  renderSolPalette();
  saveState();
}
function solGoTo(i){ state.solIndex = i; renderSolQuestion(); closeMobilePalette(); window.scrollTo(0,0); }
function solGoNext(){
  var list = solAllFiltered(); if(!list.length) return;
  var nxt = list.filter(function(x){ return x > state.solIndex; })[0];
  if(nxt !== undefined) solGoTo(nxt);
}
function solGoPrev(){
  var list = solAllFiltered(); if(!list.length) return;
  var prv = list.filter(function(x){ return x < state.solIndex; }).pop();
  if(prv !== undefined) solGoTo(prv);
}
function setSolFilter(v){
  state.solFilter = v;
  var list = solFiltered();
  if(list.length && list.indexOf(state.solIndex) === -1) state.solIndex = list[0];
  renderSolQuestion();
}
function setSolLang(v){ state.solLang = v; saveState(); renderSolQuestion(); }
function toggleSolPalette(){ state.solPalHidden = !state.solPalHidden; applyPalState(); saveState(); }
function showSolutions(){
  state.solSec = 0; state.solIndex = 0; state.solFilter = "all";
  $("solFilter").value = "all";
  showScreen("solutionPage");
  document.body.classList.toggle("pal-hidden", !!state.solPalHidden);
  applyPalState();
  renderSolQuestion();
}
function backToResult(){
  document.body.classList.remove("pal-hidden");
  renderResult();
  showScreen("resultPage");
}

/* ================= KEYBOARD ================= */
document.addEventListener("keydown", function(e){
  if(lbIsOpen()){
    if(e.key === "Escape") lbClose();
    else if(e.key === "+" || e.key === "=") lbZoom(1);
    else if(e.key === "-") lbZoom(-1);
    else if(e.key === "0") lbFit();
    return;
  }
  if(e.key === "Escape"){ closeMobilePalette(); }
  if(state.phase !== "testing" || state.between) return;
  if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
  if(["1","2","3","4","5"].indexOf(e.key) !== -1){
    if(QUESTIONS[state.current].options["option_" + e.key]) pickOption(e.key);
  } else if(e.key === "ArrowRight"){ saveAndNext(); }
  else if(e.key === "ArrowLeft"){ goPrev(); }
});

window.addEventListener("storage", function(e){ if(e.key === "sscscholars_saved_v1"){ refreshSavedIds(); if(state){ paintSaveBtns(); } } });

/* ================= INIT ================= */
/* ?new=1 (hub "Start new test"): archive the finished attempt, then begin a clean one */
function archiveCurrent(){
  try{
    if(window.HubCommon && typeof HubCommon.addAttempt === "function" && state && state.phase === "submitted" && state.finishedAt){
      return HubCommon.addAttempt(CFG.year, CFG.subject, CFG.setId, N, JSON.parse(JSON.stringify(state)));
    }
  }catch(e){}
  return false;
}
function startFreshIfAsked(){
  var p = new URLSearchParams(location.search);
  if(p.get("new") !== "1") return;
  p.delete("new");
  try{ history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p.toString() : "")); }catch(e){}
  if(state.phase === "submitted" && archiveCurrent()){   /* only wipe once the result is safely in the attempt history */
    state = freshState();
    saveState();
  }
}
function bootReview(){
  var found = (window.HubCommon && typeof HubCommon.getAttempt === "function") ? HubCommon.getAttempt(CFG.year, CFG.subject, CFG.setId, REVIEW_ID) : null;
  if(!found) throw new Error("That attempt was not found in this browser (or the latest common.js is missing).");
  var s = found.attempt.s;
  if(!s || !s.q || s.q.length !== N) throw new Error("This attempt belongs to an older version of this test and cannot be opened.");
  s.q.forEach(function(x){ if(typeof x.t !== "number") x.t = 0; });
  s.phase = "submitted"; s.solFilter = "all"; s.solIndex = 0;
  if(!s.result) s.result = computeResultFor(s);
  state = s;
  refreshSavedIds();
  initStaticText();
  applyPalState();
  var b = $("reviewBanner");
  b.hidden = false;
  b.textContent = "Reviewing Attempt " + found.number + " \u00B7 " + HubCommon.fmtAttemptDate(found.attempt.at) + " (read-only, nothing here changes your saved progress)";
  $("reattemptBtn").style.display = "none";
  renderResult();
  showScreen("resultPage");
}
function boot(){
  applyZoom();
  if(REVIEW){ bootReview(); return; }
  state = loadState();
  startFreshIfAsked();
  refreshSavedIds();
  initStaticText();
  initWelcome();
  applyPalState();

  if(state.phase === "submitted"){
    renderResult();
    showScreen("resultPage");
  } else if(state.phase === "testing" || state.phase === "paused"){
    $("instantFeedbackToggle").checked = state.instantFeedback;
    enterTestPage();
    if(state.phase === "paused"){
      clearInterval(timerHandle);
      $("pauseOverlay").classList.add("show");
    }
  } else {
    showScreen("welcomePage");
  }
}
function safeBoot(){
  try{ boot(); }
  catch(err){
    setTimeout(function(){
      var l = $("loadingScreen");
      if(!l) return;
      l.style.display = ""; l.classList.add("err");
      $("loadMsg").textContent = "Exam screen error: " + (err && err.message ? err.message : err);
      $("loadSub").textContent = "Make sure ALL files from the latest zip are uploaded (test.html, assets/engine.js, assets/common.js, assets/test.css), then press Ctrl+F5.";
      $("loadBack").style.display = "inline-block";
    }, 80);
    if(window.console) console.error(err);
  }
}
if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", safeBoot); } else { safeBoot(); }
