/* test.html?y=2025&s=GS&id=<set_id>  ->  JSON se wo set nikalo, engine chalao */
(function () {
  var H = window.HubCommon;
  var P = new URLSearchParams(location.search);
  var year = P.get("y"), subject = P.get("s"), id = P.get("id");
  function $(i) { return document.getElementById(i); }

  function fail(msg, sub) {
    $("loadingScreen").classList.add("err");
    $("loadMsg").textContent = msg;
    $("loadSub").textContent = sub || "";
    $("loadBack").style.display = "inline-block";
  }

  if (!year || !subject || !id) {
    fail("This test link is incomplete.", "Open Mock Hub, choose a chapter and press Start test.");
    return;
  }
  $("loadSub").textContent = year + " " + subject;

  H.fetchSubject(year, subject, function (bytes) {
    $("loadSub").textContent = year + " " + subject + " - " + (bytes / 1048576).toFixed(1) + " MB received";
  }).then(function (json) {
    var found = H.findSet(json, id);
    if (!found) { fail("Test not found.", "\"" + id + "\" is not present in this data file. Choose the test again from Mock Hub."); return; }
    var t = H.buildTest(json, found, year, subject);
    if (!t.questions.length) { fail("This test has no questions.", id); return; }
    window.MOCK_CFG = t.cfg;
    window.MOCK_QUESTIONS = t.questions;
    var sc = document.createElement("script");
    sc.src = "assets/engine.js";
    sc.onload = function () { $("loadingScreen").style.display = "none"; };
    sc.onerror = function () { fail("The test engine could not be loaded.", "assets/engine.js is missing or unreachable."); };
    document.body.appendChild(sc);
  }).catch(function (e) {
    var d = H.describeError(e, year, subject);
    fail(d.msg, d.sub);
  });
})();
