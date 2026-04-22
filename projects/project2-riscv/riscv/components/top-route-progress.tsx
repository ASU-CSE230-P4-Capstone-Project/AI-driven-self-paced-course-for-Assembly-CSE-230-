"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type TimerHandle = number;

export default function TopRouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const [isVisible, setIsVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [width, setWidth] = useState(0);

  const isVisibleRef = useRef(isVisible);
  const lastRouteKeyRef = useRef(routeKey);
  const navPendingRef = useRef(false);
  const revealTimerRef = useRef<TimerHandle | null>(null);
  const rampTimersRef = useRef<TimerHandle[]>([]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearRampTimers = useCallback(() => {
    for (const timer of rampTimersRef.current) {
      window.clearTimeout(timer);
    }
    rampTimersRef.current = [];
  }, []);

  const resetBar = useCallback(() => {
    clearRevealTimer();
    clearRampTimers();
    setIsVisible(false);
    setIsFinishing(false);
    setWidth(0);
  }, [clearRampTimers, clearRevealTimer]);

  const beginProgress = useCallback(() => {
    navPendingRef.current = true;
    clearRevealTimer();
    clearRampTimers();
    setIsFinishing(false);

    revealTimerRef.current = window.setTimeout(() => {
      if (!navPendingRef.current) {
        return;
      }

      setIsVisible(true);
      setWidth(18);

      rampTimersRef.current = [
        window.setTimeout(() => setWidth(46), 120),
        window.setTimeout(() => setWidth(68), 360),
        window.setTimeout(() => setWidth(82), 820),
        window.setTimeout(() => setWidth(90), 1600),
      ];
    }, 90);
  }, [clearRampTimers, clearRevealTimer]);

  const finishProgress = useCallback(() => {
    navPendingRef.current = false;
    clearRevealTimer();
    clearRampTimers();

    if (!isVisibleRef.current) {
      setWidth(0);
      return;
    }

    setWidth(100);
    setIsFinishing(true);

    rampTimersRef.current = [
      window.setTimeout(() => {
        setIsVisible(false);
        setIsFinishing(false);
        setWidth(0);
      }, 240),
    ];
  }, [clearRampTimers, clearRevealTimer]);

  useEffect(() => {
    if (lastRouteKeyRef.current === routeKey) {
      return;
    }

    lastRouteKeyRef.current = routeKey;
    finishProgress();
  }, [finishProgress, routeKey]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("href")?.startsWith("#")
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const targetUrl = `${nextUrl.pathname}${nextUrl.search}`;

      if (targetUrl === currentUrl) {
        return;
      }

      beginProgress();
    };

    const handlePopState = () => {
      beginProgress();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearRevealTimer();
      clearRampTimers();
    };
  }, [beginProgress, clearRampTimers, clearRevealTimer]);

  useEffect(() => resetBar, [resetBar]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className={`h-full origin-left bg-gradient-to-r from-[#5b1020] via-[#8b1e2d] to-[#e4b63f] shadow-[0_0_14px_rgba(180,135,28,0.6)] transition-[width,opacity] ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        } ${isFinishing ? "duration-200" : "duration-300"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
