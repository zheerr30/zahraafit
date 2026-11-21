# Atlas interface redesign

The atlas (`/atlas`, `/back`) was rebuilt around the 3D model. Nothing about the
anatomy, the muscle mapping, selection, layers or filtering changed — the same
store (`stores/backStore.ts`) and model code drive the new interface.

## Layout

| | Desktop (≥ 1024 px) | Phone |
| --- | --- | --- |
| Top bar | brand, body switch (ذكر / أنثى), exercise library, settings | the same, compact |
| Controls ("dock") | a column beside the view with three tabs: المناطق · الطبقات · العضلات | a bar at the bottom; a tab opens a sheet (≤ 50 % of the screen), tapping it again closes it |
| 3D view | fills the rest | fills the screen between the bars (> 80 % of it) |
| View controls | one floating bar: أمامي · خلفي · أيمن · أيسر · قريب · 360° · − · + | the same without «قريب» |
| Muscle panel | floating card at the side | bottom sheet: short for the summary, taller for details / exercises |

- **Regions**: a two-column grid of equal buttons with short names; «الجسم كاملًا» on top.
- **Layers**: one row per layer (colour mark, label, switch), muscle depth as a
  three-way control, quick actions (skeleton only, nerves & tendons, reset).
- **Muscles**: search and the list by region; each row selects, the eye hides / shows.
- **Settings** (gear): English names, HD detail, navy backdrop, selection colour, sources.

## Muscle panel

- **Summary** — only the muscle's name, its group and what it does in one or two
  plain sentences, with the actions: اعرف أكثر, عزل, focus.
- **اعرف أكثر** opens one view with two tabs, الشرح and التمارين.
- **Explanation tab** — written for people who train, in simple Arabic: أين تقع
  (where the muscle is), ماذا تفعل (what it does, as short points) and تعمل في
  (movements and exercises that use it); for the back and shoulder muscles also the
  muscles that work with and against it. Then two tools on the model (show its
  attachment on the bone, hide it) and a button to its exercises.
- **Exercises tab** — the exercise library for the muscle.

No source or database data is shown anywhere in the panel: the Z-Anatomy object
names, TA2 codes, hierarchy, author classification, attachment listing and the
English definitions were removed together with their component. (The licence
credit for the model stays as one line under the controls and on the sources page.)
Other structures (bones, tendons, ligaments, nerves) show their name and one
sentence on what they are.

The explanations live in `data/exercises/groups.ts` (`fn`, `where`, `does`,
`moves` for the 39 trained groups) and `lib/exercises/describe.ts` (families of
small muscles outside them). They are original text and general education, not
medical advice.

## Arabic text

The interface shows Arabic without diacritics (tashkeel). The source strings are
kept free of them (`python3 pipeline/strip-tashkeel.py --check`), the imported
exercise names are stripped by the importer, and names read from the model files
are stripped when the model is loaded (`plainArabic`). Search still accepts text
typed with or without them.

## The view makes room for the panels

Panels float over the view instead of resizing it. The part they cover is
measured (`useCover` → `insets` in the store) and the camera shifts its picture
so the subject sits in the middle of the free part — a view offset in the
projection, so picking and orbiting stay exact — and frames views, regions and
muscles for the free part. When a panel opens or closes the last framing is
applied again, unless the user has moved the camera since. On a phone, opening
the tall details / exercises sheet brings the selected muscle into the part of
the view that stays visible.

## Interaction

Drag to rotate, wheel / pinch to zoom (towards the pointer), right-drag to pan —
unchanged. Added: zoom − / + buttons (and the `+` / `-` keys), smooth steps.
View buttons animate between front, back and the sides; 360° turns the body.

## Removed from the interface

- every note about the female model (the body switch is just ذكر / أنثى; a later
  load shows a small progress pill and keeps the current model on screen);
- the explanatory paragraphs, the keyboard hint line, the source and licence text
  in the control column (a one-line credit with a link to the sources page stays,
  as the licence requires attribution);
- colour swatches and technical lines from the muscle summary; all source data from the panel.

## Checks

`e2e/atlas-ui.cjs` drives the redesigned controls with real clicks / taps on
desktop and on a phone-sized touch screen; `e2e/exercise-flow.cjs` the muscle →
exercises flow; `e2e/back-select-each.cjs` clicks every muscle of a region.

## ZahraaFit theme and the body for phones

Both are for opening the atlas inside the ZahraaFit app, and both are read from the
address:

| Address | Effect |
| --- | --- |
| `?theme=zahraafit` | The brand's light colours: cream page `#F6F2EA`, white cards and menus, navy text `#050F2C`, separators `rgba(5,15,44,.1)`, orange `#E8602C` for buttons, chosen items and the selected muscle, a light cream backdrop behind the model. Kept for the browser tab; `?theme=dark` goes back. |
| `?lite=1` | The lightweight body (`core-lite.glb`, about 6.4 MB instead of 27). Loaded by itself on phones and tablets. |
| `?lite=0` | The full body, also on a phone. |

- **Theme**: the colours are CSS variables (`app/globals.css`); the theme overrides
  them under `:root[data-theme="zahraafit"]`, set before the first paint
  (`lib/theme.ts`, root layout). The atlas components use the tokens (`bg-surface`,
  `border-ink/10`, `bg-select`, …) instead of fixed dark colours, so the default
  theme looks as before.
- **Body for phones** (`pipeline/lite/body.mjs`): the same nodes, names and ids as
  the full body — selection, names and explanations are unchanged — with about a
  fifth of the triangles. No muscle surface moves more than 5 mm; the abdominal wall
  keeps more detail (the opening of the rectus sheath depends on it).
  `node pipeline/lite/body.mjs public/models/zanatomy male` (and `female`).
- Checks: `tests/lite.test.ts`, `e2e/theme-lite.cjs`.
