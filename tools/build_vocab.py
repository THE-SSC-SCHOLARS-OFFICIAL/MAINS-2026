#!/usr/bin/env python3
"""
build_vocab.py  --  THE SSC SCHOLARS OFFICIAL

Mains JSON + Live JSON se English ke Vocabulary questions nikalta hai aur
25-25 ke FREEZE sets banata hai  ->  data/vocab/

  python tools/build_vocab.py            # repo root se chalao
  python tools/build_vocab.py --dry      # sirf count dikhao, kuch likho mat

Rules
 * data/*.json            (key "mocks")    -> Mains file(s)
 * data/live/*.json       (key "sections") -> Live tests
   Naya file / naye mock questions aate hi automatically pick ho jate hain.
 * Duplicate question (alag mock me repeat) ek hi baar aata hai.
 * Set sirf tab banta hai jab 25 naye questions ready ho jayen. Ek baar bana hua set
   KABHI nahi badalta (isliye purane attempts / review / saved questions safe rahte hain).
 * Bache hue (<25) questions "pending" me wait karte hain, agle run me use hote hain.
"""
import json, re, sys, os, glob, hashlib, random, datetime, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "vocab")
SET_SIZE = 25
INCLUDE_FILL_IN = True        # single-word "fill in the blank" (vocab word-choice) bhi lo; False = band

# ------------------------------------------------------------------ classifier
RULES = [   # (category, regex on lower-cased question text) -- first match wins
    ("Proverb",            r"proverb|\badage\b"),
    ("Idiom & Phrase",     r"\bidiom"),
    ("Phrasal Verb",       r"phrasal"),
    ("Homonym/Homophone",  r"homonym|homophone|homograph"),
    ("Collocation",        r"collocation"),
    ("Fixed Preposition",  r"fixed preposition|dependent preposition|(?:suitable|appropriate|correct|right|proper|apt)\s+preposition|preposition to (?:fill|complete)|preposition for the blank"),
    ("One Word Substitution", r"one[- ]word|single word"),
    ("Spelling",           r"\bspelt\b|\bspelled\b|spelling|misspelt|misspelled"),
    ("Antonym",            r"antonym|opposite in meaning|opposite meaning"),
    ("Synonym",            r"synonym|similar in meaning|nearest in meaning|closest in meaning|same meaning"),
    ("Word Meaning",       r"(?:most nearly|nearly) means|word .{0,40}(?:in|from) the passage .{0,30}mean|suitable substitute for the word"),
]
FILL = re.compile(r"fill in the blank(?!s? no)|can fit in the blank|complete the sentence|most appropriate (?:word|option) to fill")
GRAMMAR_WORDS = set("""a an the of in on at by for to from with into onto over under about above below between among through
during before after since until till up down off out as than that this these those is am are was were be been being has have had
do does did will would shall should can could may might must not no nor and or but so yet if because although though while whether
i me my mine we us our you your he him his she her it its they them their who whom whose which what when where why how
one some any each every either neither both all more most less least much many few little other another such same""".split())

def clean(h):
    h = re.sub(r"<br\s*/?>|</p>", "\n", h or "")
    h = re.sub(r"<[^>]+>", "", h)
    h = h.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", h).strip()

def classify(q):
    t = clean(q.get("question")).lower()
    for cat, rx in RULES:
        if re.search(rx, t):
            return cat
    if INCLUDE_FILL_IN and FILL.search(t) and not clean(q.get("passage")) and not re.search(r"verb form|tense|correct form|article|pronoun|conjunction|determiner|voice", t):
        opts = [clean(o.get("text")).lower() for o in (q.get("options") or [])]
        # vocab word-choice = 4 single, DIFFERENT words (grammar-form questions share one stem: motivate/motivated/motivating)
        if len(opts) >= 4 and all(re.fullmatch(r"[a-z][a-z'\-]{2,}", o) for o in opts):
            stems = [o[:4] for o in opts]
            if len(set(stems)) == len(stems) and sum(o in GRAMMAR_WORDS for o in opts) < 2:
                return "Fill in the Blank"
    return None

# ------------------------------------------------------------------ reading sources
def fingerprint(q):
    s = clean(q.get("question")).lower() + "|" + "|".join(sorted(clean(o.get("text")).lower() for o in q.get("options", [])))
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:16]

def answer_index(q):
    if q.get("correct_index") not in (None, ""):
        try: return int(q["correct_index"])
        except Exception: pass
    co = q.get("correct_option")
    if isinstance(co, str) and re.fullmatch(r"[A-Ea-e]", co.strip()):
        return ord(co.strip().upper()) - 65
    return None

def is_english(name):
    return "english" in str(name or "").lower()

def iter_sources():
    """yield (source_label, order_key, english_questions[])  for every JSON in data/ and data/live/"""
    files = sorted(glob.glob(os.path.join(DATA, "*.json"))) + sorted(glob.glob(os.path.join(DATA, "live", "*.json")))
    for f in files:
        base = os.path.basename(f)
        if base.lower() == "index.json": continue
        try:
            with open(f, encoding="utf-8") as fh: d = json.load(fh)
        except Exception as e:
            print("  skip (unreadable):", base, e); continue
        if isinstance(d, dict) and isinstance(d.get("mocks"), list):               # Mains file
            for m in sorted(d["mocks"], key=lambda x: x.get("mock") or 0):
                eng = [q for sb in m.get("subjects", []) if is_english(sb.get("subject")) for q in sb.get("questions", [])]
                if eng:
                    yield "Mains Mock %s" % m.get("mock"), "0|%s|%06d" % (base, m.get("mock") or 0), eng
        elif isinstance(d, dict) and isinstance(d.get("sections"), list):          # Live test
            meta = d.get("meta", {})
            eng = [q for s in d["sections"] if is_english(s.get("name")) or s.get("short") == "EL" for q in s.get("questions", [])]
            if eng:
                label = str(meta.get("exam") or base.replace(".json", ""))
                yield label, "1|%s|%s" % (str(meta.get("extracted_at") or ""), base), eng

def slim(q, cat, source):
    ai = answer_index(q)
    opts = [{"label": "ABCDE"[i], "text": o.get("text", ""), "text_hi": o.get("text_hi", "") or ""} for i, o in enumerate(q.get("options", [])[:5])]
    return {
        "qid": q.get("qid"), "category": cat, "source": source,
        "question": q.get("question", ""), "question_hi": q.get("question_hi", "") or "",
        "passage": q.get("passage") or "", "passage_hi": q.get("passage_hi") or "", "passage_id": q.get("passage_id"),
        "options": opts, "correct_index": ai, "correct_option": "ABCDE"[ai],
        "solution": q.get("solution", "") or "", "solution_hi": q.get("solution_hi", "") or "",
    }

# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    idx_path = os.path.join(OUT, "index.json")
    index = {"set_size": SET_SIZE, "minutes": 15, "sets": []}
    if os.path.exists(idx_path):
        with open(idx_path, encoding="utf-8") as fh: index = json.load(fh)
    used = set(k for s in index["sets"] for k in s.get("keys", []))

    pool, seen, total_eng = [], set(), 0
    for source, order, eng in sorted(iter_sources(), key=lambda x: x[1]):
        for q in eng:
            total_eng += 1
            cat = classify(q)
            if not cat or answer_index(q) is None or len(q.get("options", [])) < 2: continue
            k = fingerprint(q)
            if k in seen: continue
            seen.add(k)
            if k in used: continue
            pool.append((k, slim(q, cat, source)))

    print("English questions scanned : %d" % total_eng)
    print("Already in published sets : %d (%d sets)" % (len(used), len(index["sets"])))
    print("New vocab questions       : %d" % len(pool))
    cats = {}
    for _, q in pool: cats[q["category"]] = cats.get(q["category"], 0) + 1
    for c, n in sorted(cats.items(), key=lambda x: -x[1]): print("   %-22s %d" % (c, n))

    new_sets = []
    no = len(index["sets"])
    while len(pool) >= SET_SIZE:
        # variety: round-robin across categories (biggest bucket first)
        buckets = {}
        for item in pool: buckets.setdefault(item[1]["category"], []).append(item)
        order = sorted(buckets, key=lambda c: -len(buckets[c]))
        pick = []
        while len(pick) < SET_SIZE:
            for c in order:
                if buckets[c] and len(pick) < SET_SIZE: pick.append(buckets[c].pop(0))
        picked = set(k for k, _ in pick)
        pool = [it for it in pool if it[0] not in picked]
        no += 1
        random.Random(no).shuffle(pick)                       # fixed shuffle per set number
        sid = "vocab_%03d" % no
        qs = [q for _, q in pick]
        comp = {}
        for q in qs: comp[q["category"]] = comp.get(q["category"], 0) + 1
        new_sets.append({"id": sid, "no": no, "file": sid + ".json", "title": "Vocab Set %d" % no, "count": len(qs),
                         "cats": comp, "keys": [k for k, _ in pick], "added": datetime.date.today().isoformat(),
                         "_questions": qs})

    print("New sets to publish       : %d   (pending left: %d)" % (len(new_sets), len(pool)))
    if a.dry or not new_sets: return
    os.makedirs(OUT, exist_ok=True)
    for s in new_sets:
        qs = s.pop("_questions")
        with open(os.path.join(OUT, s["file"]), "w", encoding="utf-8") as fh:
            json.dump({"id": s["id"], "title": s["title"], "questions": qs}, fh, ensure_ascii=False, separators=(",", ":"))
        index["sets"].append(s)
    index["updated"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index["pending"] = len(pool)
    with open(idx_path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)
    print("Written -> data/vocab/")

if __name__ == "__main__":
    main()
