import { useMemo } from "react";

type Translations = { [key: string]: string };

// This hook takes data object from backend, finds english words and replaces them with translations
// Alternative to this approach is implementing i18 also on backend side, with double tables in database

export const useTranslateData = <T extends object>(
  data: T[],
  translations: Translations
): T[] => {
  const translate = (item: JsonValue): JsonValue => {
    if (Array.isArray(item)) {
      return item.map((innerItem) => translate(innerItem));
    }
    if (item !== null && typeof item === "object") {
      const newItem: JsonObject = {};
      Object.keys(item).forEach((key) => {
        const newKey = translations[key] || key;
        newItem[newKey] = translate((item as JsonObject)[key]);
      });
      return newItem;
    }
    if (typeof item === "string") {
      return Object.entries(translations).reduce((acc, [key, value]) => {
        return acc.replace(new RegExp(`\\b${key}\\b`, "g"), value);
      }, item);
    }
    return item;
  };

  return useMemo(
    () => data.map((item) => translate(item as never as JsonValue) as never as T),
    [data, translations]
  );
};
