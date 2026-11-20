"""Remove Arabic diacritics (tashkeel: short vowels, tanween, sukun, shadda, dagger alef)
from the interface text in the source. The interface shows Arabic without them.

Not touched: lib/anatomy/normalize.ts and its test (they handle diacritics in what a
person types into search), and the anatomy pipeline's name tables (names read from the
model files are stripped when the model is loaded: plainArabic in lib/anatomy/normalize.ts).

  python3 pipeline/strip-tashkeel.py          # rewrite
  python3 pipeline/strip-tashkeel.py --check  # list what would change, exit 1 if anything
"""
import glob, os, re, sys

TASHKEEL = re.compile("[ً-ْٰ]")
ROOTS = ["app", "components", "data", "hooks", "lib", "stores", "types", "tests", "e2e", "pipeline/exercises"]
KEEP = {"lib/anatomy/normalize.ts", "tests/normalize.test.ts"}
check = "--check" in sys.argv
total = 0
for root in ROOTS:
    for path in sorted(glob.glob(root + "/**/*", recursive=True)):
        if not os.path.isfile(path) or not path.endswith((".ts", ".tsx", ".cjs", ".mjs", ".css")) or path in KEEP:
            continue
        text = open(path, encoding="utf8").read()
        n = len(TASHKEEL.findall(text))
        if not n:
            continue
        total += n
        print(f"{n:4d}  {path}")
        if not check:
            open(path, "w", encoding="utf8").write(TASHKEEL.sub("", text))
print(total, "marks", "found" if check else "removed")
sys.exit(1 if check and total else 0)
