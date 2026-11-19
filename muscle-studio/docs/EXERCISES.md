# Interactive muscle → exercises flow

The 3D anatomy model is the entry point: a tap on a muscle selects and highlights
it and opens its contextual panel; from there "learn more" and "exercises" stay
connected to the model.

| Step | What happens | Where |
| --- | --- | --- |
| Tap a muscle | selected + highlighted; contextual panel with its name, what it does and the actions | `components/region/MusclePanel.tsx` (summary) |
| اعرف أكثر (Learn more) | origin, insertion, action, innervation, related muscles, Z-Anatomy source data (TA2, Latin, hierarchy, definition) | panel `details` |
| التمارين (Exercises) | exercise library filtered for that muscle: تقوية / إطالة tabs, search, equipment and level filters, bookmarks | `components/exercise/ExerciseLibrary.tsx` |
| Look at / open an exercise | its prime movers light up on the model in the highlight colour, the helpers in a lighter tint; opening turns the body to the side that shows them | store `spotlight`, `applyStyle` |
| Tap a target muscle of an exercise | that muscle is selected on the model, exercises stay open | `pickGroup` |
| عزل العضلة / عرض الجسم كاملًا | isolate the muscle (rest ghosted) / back to the whole anatomy | store `setIsolate`, `showFullBody` |

On a phone the panel is a bottom sheet (short for the summary, taller for details /
exercises), so the model stays visible above it.

**Links.** The address follows the selection (`/atlas?muscle=<unit id>&panel=exercises`),
so a view can be shared; `&ex=<exercise id>` opens that exercise and lights it.
`/exercises` is the whole library (muscle filter added); each exercise links back
into the model ("عرض العضلات على المجسّم ثلاثي الأبعاد").

## Data

- `data/exercises/groups.ts` — 39 exercise muscle groups, each a list of unit ids of
  the 3D model (tested: every id exists in the model), a one-line function and the
  side it is seen from.
- `data/exercises/exercises.ts` — the library (70 strengthening / activation and
  32 stretching exercises): Arabic and English name, prime movers and helpers (group
  ids), equipment, level, dose, steps, a note. Original text; general educational
  content, not a training prescription.
- `media?: { image?, video? }` per exercise: a photo or video URL is shown on the
  card when provided. **No exercise photos or videos ship with the app** — none are
  included because no licensed media was available.
- Bookmarks: `stores/exerciseStore.ts`, saved in the browser (`localStorage`).

## Card pictures: muscle maps from the model

Every card shows the model itself, front and back, with the exercise's muscles lit
(`components/exercise/MuscleMap.tsx`). The images are renders of the application's
own model, one transparent overlay per muscle group, stacked per exercise — so new
exercises need no new images.

```
next build (static)  →  serve  →  node e2e/render-maps.cjs            # surface
                                   node e2e/render-maps-deep.cjs       # deep muscles, covering layers removed
python3 pipeline/exercises/maps.py <raw> public/exercise-maps data/exercises/maps.ts
```

Deep muscles (pectoralis minor, rhomboids, transversus, deep hip rotators …) are
rendered with the covering layers removed and shown through the surface. Two groups
cannot be seen from outside at all (pelvic floor, levator scapulae): their cards show
the plain figure. The maps are of the male body.

## Checks

- `tests/exercises.test.ts` — data integrity, filters, bookmarks, spotlight colours on
  the real model, store transitions.
- `e2e/exercise-flow.cjs` — the whole flow with real clicks / taps on the running app,
  desktop and phone-sized touch screen, the library page and its link into the model.
