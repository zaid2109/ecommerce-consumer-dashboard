import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useAppStore } from "../../../store/appStore";
import { useDropdown } from "../../../hooks/useDropdown";

export const useNavbar = () => {
  const { theme, setTheme } = useTheme();
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const { isMobileMenuOpen, toggleMobileMenu, isSideMenuOpen } = useAppStore();
  const t = useTranslations("navbar");
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const session = null;

  const closeMobileMenu = () => {
    if (isMobileMenuOpen) {
      toggleMobileMenu();
    }
  };

  const themes = ["snowlight", "midnight", "charcoal", "obsidian"];
  const themesDisplayNames = ["Snowlight", "Midnight", "Charcoal", "Obsidian"];

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 1280 && isMobileMenuOpen) {
        toggleMobileMenu();
      }
    }
  }, []);

  const userIconBtnRef = useRef<HTMLButtonElement | null>(null);
  const themeDropdown = useDropdown();
  const userDropdown = useDropdown();
  const languageDropdown = useDropdown();
  const searchDropdown = useDropdown();

  useEffect(() => {
    const getCurrentLanguage = () => {
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        return pathname.startsWith("/pl") ? "pl" : "en";
      }
      return "en";
    };
    setCurrentLanguage(getCurrentLanguage());
  }, []);

  const selectTheme = (themeName: string) => {
    setTheme(themeName);
  };

  const cycleThemeUp = () => {
    if (typeof theme === "string") {
      const currentThemeIndex = themes.indexOf(theme);
      const previousThemeIndex =
        (currentThemeIndex - 1 + themes.length) % themes.length;
      setTheme(themes[previousThemeIndex]);
    }
  };

  const cycleThemeDown = () => {
    if (typeof theme === "string") {
      const currentThemeIndex = themes.indexOf(theme);
      const nextThemeIndex = (currentThemeIndex + 1) % themes.length;
      setTheme(themes[nextThemeIndex]);
    }
  };

  return {
    theme,
    setTheme,
    currentLanguage,
    setCurrentLanguage,
    isMobileMenuOpen,
    toggleMobileMenu,
    isSideMenuOpen,
    t,
    closeMobileMenu,
    authEnabled,
    session,
    themes,
    themesDisplayNames,
    userIconBtnRef,
    themeDropdown,
    userDropdown,
    languageDropdown,
    selectTheme,
    cycleThemeUp,
    cycleThemeDown,
    searchDropdown,
  };
};
