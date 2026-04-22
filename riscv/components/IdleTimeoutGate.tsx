"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearClientSessionData } from "@/components/client-session";

export default function IdleTimeoutGate({
  children,
  timeoutMs = 30 * 60 * 1000, // default: (30 * 60 * 1000,); (10 * 1000,) 10s for testing 
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  timeoutMs?: number;
  redirectTo?: string;
}) {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const logout = () => {
      if (loggingOutRef.current) {
        return;
      }

      loggingOutRef.current = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      void (async () => {
        try {
          await fetch("/logout/api", {
            method: "POST",
            credentials: "include",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.warn("Idle logout request failed:", error);
        } finally {
          clearClientSessionData();
          if (!disposed) {
            router.replace(redirectTo);
          }
        }
      })();
    };

    const reset = () => {
      if (loggingOutRef.current) {
        return;
      }

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(logout, timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    //listen on window + document (more reliable)
    events.forEach((e) => {
      window.addEventListener(e, reset, { passive: true });
      document.addEventListener(e, reset, { passive: true });
    });

    //start timer immediately
    reset();

    return () => {
      disposed = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      events.forEach((e) => {
        window.removeEventListener(e, reset);
        document.removeEventListener(e, reset);
      });
    };
  }, [router, timeoutMs, redirectTo]);

  return <>{children}</>;
}
