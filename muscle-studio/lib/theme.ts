/**
 * Themes of the app.
 *  - "dark": the default look.
 *  - "zahraafit": the ZahraaFit brand's light colours (cream page, white cards, navy
 *    text, orange buttons and selection), turned on with `?theme=zahraafit` — for
 *    opening the atlas inside the ZahraaFit app. The colours are in app/globals.css.
 * The choice is kept for the browser tab, so it survives moving between pages;
 * `?theme=dark` goes back.
 */
export type ThemeId = "dark" | "zahraafit";

/** Selection colour of the ZahraaFit theme (buttons, chosen items, the selected muscle). */
export const BRAND_SELECT = "#E8602C";

export function currentTheme(): ThemeId {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "zahraafit" ? "zahraafit" : "dark";
}

/** Runs before the first paint (root layout), so the page never flashes in the other theme. */
export const THEME_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get("theme"),s=null;try{s=sessionStorage.getItem("ms-theme")}catch(e){}if(q){try{sessionStorage.setItem("ms-theme",q)}catch(e){}}if((q||s)==="zahraafit")document.documentElement.dataset.theme="zahraafit"}catch(e){}})()`;
