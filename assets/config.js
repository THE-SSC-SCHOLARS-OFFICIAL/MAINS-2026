/* ===== Mock Hub settings (SSC CGL Mains full-mock pattern) ===== */
window.HUB_CONFIG = {
  brand: "THE SSC SCHOLARS OFFICIAL",

  /* Folder holding the mock JSON. File name: <year>_<subject>.json  ->  data/2026_Mains.json */
  dataDir: "data",

  /* Change this number (1 -> 2 -> 3) whenever the JSON file is replaced,
     so browsers do not keep serving an old cached copy. */
  dataVersion: "1",

  /* LIVE tests: every single-test JSON placed in this folder shows up in the hub's LIVE tab automatically */
  liveDir: "data/live",

  years: ["2026"],

  /* key = part of the file name (2026_<key>.json), label = name shown around the site */
  subjects: [
    { key: "Mains", label: "SSC CGL Mains Full Mock" }
  ],

  /* ---- Full mock pattern (SSC CGL Tier II / Mains) ----
     Sections run strictly in this order. Each section has its own timer.
     match     = words used to find the section inside the JSON's "subject" names
     minutes   = timer of that section
     part      = which Part it belongs to (1, 2, 3)
     qualifying = true -> marks are shown separately and NOT added to the main-paper total */
  mains: {
    correct: 3,
    negative: 1,
    sections: [
      { key: "maths",     name: "Mathematical Abilities",              short: "Maths",     match: ["math"],                         minutes: 30, part: 1 },
      { key: "reasoning", name: "Reasoning and General Intelligence",  short: "Reasoning", match: ["reason"],                       minutes: 30, part: 1 },
      { key: "english",   name: "English",                             short: "English",   match: ["english"],                      minutes: 40, part: 2 },
      { key: "gs",        name: "General Awareness",                   short: "GS",        match: ["general awareness", "gk", "gs"], minutes: 20, part: 2 },
      { key: "computer",  name: "Computer Knowledge",                  short: "Computer",  match: ["computer"],                     minutes: 15, part: 3, qualifying: true }
    ]
  }
};
