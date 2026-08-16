// views/script/i18n.js
//
// Lightweight i18n system for vanilla JS + HTML.
//
// Features:
// - Loads /views/lang/<lang>.json
// - Browser language detection
// - Saves language in localStorage
// - data-i18n for text content
// - data-i18n-attr for HTML attributes
// - t() for JavaScript-generated text
// - Supports dynamically added HTML
// - Prevents race conditions when changing languages quickly
// - Dispatches "i18nApplied" event after translations are applied

const SUPPORTED = ["en", "hu", "es", "po"];
const DEFAULT_LANG = "en";
const STORAGE_KEY = "wt.lang";

let dict = {};
let currentLang = DEFAULT_LANG;
const textSources = new WeakMap();
const placeholderSources = new WeakMap();

// Used to prevent older language requests from overwriting newer ones.
let languageRequestId = 0;

/**
 * Get the language from localStorage.
 * If none exists, use the browser language.
 */
function langFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved && SUPPORTED.includes(saved)) {
    return saved;
  }

  const browserLang = (
    navigator.language ||
    navigator.userLanguage ||
    DEFAULT_LANG
  )
    .slice(0, 2)
    .toLowerCase();

  return SUPPORTED.includes(browserLang)
    ? browserLang
    : DEFAULT_LANG;
}

/**
 * Translate a key from JavaScript.
 *
 * Example:
 *   t("welcome")
 *
 * If the key doesn't exist:
 *   t("welcome", "Welcome!")
 */
export function t(key, fallback) {
  return dict[key] ?? fallback ?? key;
}

/**
 * Get the currently active language.
 */
export function getLang() {
  return currentLang;
}

/**
 * Get all supported languages.
 */
export function getSupportedLanguages() {
  return [...SUPPORTED];
}

/**
 * Load the language JSON file.
 */
async function loadDict(lang) {
  const url = new URL(`../lang/${lang}.json`, import.meta.url);

  const response = await fetch(url, {
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load language "${lang}": ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Get elements matching a selector.
 *
 * This also checks whether the root element itself matches.
 * This is useful when translating dynamically-created components.
 */
function getElements(root, selector) {
  const elements = [];

  if (root?.matches?.(selector)) {
    elements.push(root);
  }

  if (root?.querySelectorAll) {
    elements.push(...root.querySelectorAll(selector));
  }

  return elements;
}

function automaticTranslation(source) {
  const key = source.trim();
  return dict.auto?.[key] ?? dict.autoExtra?.[key];
}

function applyAutomaticTranslations(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.nodeValue.trim() || !parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, .material-symbols-rounded, [data-i18n]")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const source = textSources.get(node) ?? node.nodeValue;
    textSources.set(node, source);
    const translated = automaticTranslation(source);
    if (!translated) return;
    const leading = source.match(/^\s*/)[0];
    const trailing = source.match(/\s*$/)[0];
    node.nodeValue = `${leading}${translated}${trailing}`;
  });

  getElements(root, "[placeholder]").forEach((element) => {
    const source = placeholderSources.get(element) ?? element.getAttribute("placeholder");
    placeholderSources.set(element, source);
    const translated = automaticTranslation(source || "");
    if (translated) element.setAttribute("placeholder", translated);
  });
}

/**
 * Apply all translations inside a root element.
 */
export function applyTranslations(root = document, emitEvent = true) {
  // ---------------------------------------------------------
  // Text content
  //
  // Example:
  // <h1 data-i18n="home.title"></h1>
  // ---------------------------------------------------------

  getElements(root, "[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");

    if (!key) return;

    const value = t(key);

    // If the key doesn't exist, t() returns the key itself.
    // We don't want to replace the original HTML in that case.
    if (dict[key] != null) {
      element.textContent = value;
    }
  });

  // ---------------------------------------------------------
  // Attributes
  //
  // Example:
  // <input
  //   data-i18n-attr="placeholder:search.placeholder;title:search.title"
  // >
  // ---------------------------------------------------------

  getElements(root, "[data-i18n-attr]").forEach((element) => {
    const specification =
      element.getAttribute("data-i18n-attr") || "";

    specification.split(";").forEach((pair) => {
      const [attribute, key] = pair
        .split(":")
        .map((value) => (value || "").trim());

      if (!attribute || !key) return;

      if (dict[key] != null) {
        element.setAttribute(attribute, dict[key]);
      }
    });
  });

  applyAutomaticTranslations(root);

  // Update HTML language attribute.
  document.documentElement.setAttribute("lang", currentLang);

  // Tell the rest of the application that translation finished.
  if (emitEvent) {
    document.dispatchEvent(
      new CustomEvent("i18nApplied", {
        detail: {
          lang: currentLang,
        },
      })
    );
  }
}

/**
 * Change the current language.
 */
export async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) {
    lang = DEFAULT_LANG;
  }

  // Create a unique ID for this request.
  const requestId = ++languageRequestId;

  try {
    const newDict = await loadDict(lang);

    // Another language was requested while this one was loading.
    // Ignore this old request.
    if (requestId !== languageRequestId) {
      return;
    }

    dict = newDict;
    currentLang = lang;

    localStorage.setItem(STORAGE_KEY, lang);

    applyTranslations();
  } catch (error) {
    console.error(`[i18n] Failed to load "${lang}"`, error);

    throw error;
  }
}

/**
 * Initialize i18n.
 *
 * Priority:
 *
 * 1. Previously selected language
 * 2. Browser language
 * 3. English
 */
export async function initI18n() {
  const language = langFromStorage();

  try {
    await setLanguage(language);
  } catch (error) {
    console.error("[i18n] Initialization failed:", error);

    // If the selected/browser language failed,
    // fall back to English.
    if (language !== DEFAULT_LANG) {
      try {
        await setLanguage(DEFAULT_LANG);
      } catch (fallbackError) {
        console.error(
          "[i18n] English fallback also failed:",
          fallbackError
        );
      }
    }
  }
}

/**
 * Bind a language <select>.
 *
 * Example:
 *
 * <select id="langSelect">
 *   <option value="en">English</option>
 *   <option value="hu">Magyar</option>
 *   <option value="de">Deutsch</option>
 * </select>
 *
 * Then:
 *
 * bindLangSelect(document.getElementById("langSelect"));
 */
export function bindLangSelect(selectElement) {
  if (!selectElement) return;

  // Set initial value.
  selectElement.value = currentLang;

  selectElement.addEventListener("change", async (event) => {
    const selectedLanguage = event.target.value;

    selectElement.disabled = true;

    try {
      await setLanguage(selectedLanguage);

      // Make sure the select reflects the actual language.
      selectElement.value = currentLang;
    } catch (error) {
      console.error(
        "[i18n] Language change failed:",
        error
      );

      // Restore current language.
      selectElement.value = currentLang;
    } finally {
      selectElement.disabled = false;
    }
  });
}

/**
 * Automatically bind #langSelect if it exists.
 *
 * This means you don't have to manually call
 * bindLangSelect() on every page.
 */
function autoBindLanguageSelect() {
  const select = document.getElementById("langSelect");

  if (select) {
    bindLangSelect(select);
  }
}

/**
 * Automatically translate dynamically-created HTML.
 *
 * Example:
 *
 * container.innerHTML = `
 *   <h1 data-i18n="welcome"></h1>
 * `;
 *
 * The MutationObserver will automatically translate it.
 */
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      // Translating added nodes must not announce another full language
      // update. Some pages (Settings' domain suggestions) add DOM in their
      // i18nApplied handler, which would otherwise recurse forever.
      applyTranslations(node, false);
    });
  }
});

/**
 * Start the MutationObserver.
 */
function startObserver() {
  if (!document.body) return;

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Start everything once the DOM exists.
 */
async function startI18n() {
  await initI18n();

  autoBindLanguageSelect();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startI18n, {
    once: true,
  });
} else {
  startI18n();
}
