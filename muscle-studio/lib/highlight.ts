/**
 * Colour of the selected muscle on the 3D model: the orange of the ZahraaFit identity.
 * While a muscle is selected the others are shown in neutral tones (see
 * `neutralTone` in lib/region/backModel.ts), so the accent reads clearly against
 * them. One value for the model, the exercise muscle maps and the UI marks that
 * stand for "this muscle".
 */
export const SELECTION_ACCENT = "#E8602C";

/** Helper (secondary) muscles of an exercise: the same accent, lighter. */
export const SELECTION_ACCENT_SOFT = "#F2A680";

/** Colours the user can pick for the selection instead. */
export const SELECTION_SWATCHES = [SELECTION_ACCENT, "#A5111F", "#173F8A", "#2E9E6A", "#6D3FB5"];
