'use client';

import { useEffect } from 'react';

/**
 * Keeps document.title in the visitor's language. The server renders the Russian
 * <title>, and Next.js streams metadata (the <title> may arrive in <body> after
 * hydration), so the title is re-applied whenever the document changes.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
