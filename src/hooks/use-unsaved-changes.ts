"use client";

import { useEffect, useRef, useState } from "react";

export function useUnsavedChanges(enabled: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allowNavigation = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (allowNavigation.current) return;
      event.preventDefault();
    }

    function interceptInternalLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(destination.href);
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", interceptInternalLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", interceptInternalLink, true);
    };
  }, [enabled]);

  return {
    cancelNavigation: () => setPendingHref(null),
    confirmNavigation: () => {
      if (pendingHref) {
        allowNavigation.current = true;
        window.location.assign(pendingHref);
      }
    },
    navigationPending: Boolean(pendingHref),
  };
}
