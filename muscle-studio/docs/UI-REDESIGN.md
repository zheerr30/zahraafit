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
  plain sentences, with the actions: التمارين, عزل, focus.
- **ⓘ details** — origin, insertion, action, innervation, related muscles, the
  layer, tools on the model (attachments on the bone, hide) and, in its own
  collapsed section, the source data (Z-Anatomy object, TA2 / Latin, hierarchy,
  definition).
- **Exercises** — the exercise library for the muscle.

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
- colour swatches and technical lines from the muscle summary.

## Checks

`e2e/atlas-ui.cjs` drives the redesigned controls with real clicks / taps on
desktop and on a phone-sized touch screen; `e2e/exercise-flow.cjs` the muscle →
exercises flow; `e2e/back-select-each.cjs` clicks every muscle of a region.
