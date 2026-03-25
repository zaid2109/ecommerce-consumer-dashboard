"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { ApolloProvider } from "@apollo/client";

import { Layout } from "../layout/Layout";
import { client } from "./apolloClient";

export const THEMES_ARRAY = ["snowlight", "midnight", "charcoal", "obsidian"];

export const Providers = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Global error handler for browser extension communication issues
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored:', event.message);
        event.preventDefault();
        return false;
      }
    };

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && event.reason.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension promise rejection ignored:', event.reason.message);
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ApolloProvider client={client}>
      <ThemeProvider
        enableSystem={false}
        attribute="class"
        themes={THEMES_ARRAY}
        defaultTheme="obsidian"
        disableTransitionOnChange
      >
        <Layout>{children}</Layout>
      </ThemeProvider>
    </ApolloProvider>
  );
};
