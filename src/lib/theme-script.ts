/**
 * Runs before the first paint, from the root layout, so a dark-theme visitor never sees a white flash.
 * A string, because it has to execute before React does; in a module of its own with no "use client",
 * because the layout is a server component and needs the text itself, not a reference to a client module.
 *
 * Storage that cannot be read is not a reason to ignore the device: the choice falls back to "system",
 * and "system" is always resolved against the device.
 */
export const THEME_STORAGE_KEY = "prep-kit:theme";

export const THEME_SCRIPT = `(function(){var c="system";try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==="light"||s==="dark")c=s;}catch(e){}var d=c==="dark";if(c==="system"){try{d=matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}}var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeChoice=c;})();`;
