// Переводы и вспомогательные функции локализации.
import { DEFAULT_SETTINGS, translations } from "./config.js";

export const translate = (language, key, params = {}) => {
  const lang = language || DEFAULT_SETTINGS.language;
  const dictionary = translations[lang] || translations.ru;
  const fallback = translations.ru[key] ?? key;
  const template = dictionary[key] ?? fallback;
  return template.replace(/\{(\w+)\}/g, (_, token) => params[token] ?? "");
};
