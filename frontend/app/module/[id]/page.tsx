"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../login/hooks/useAuth";
import ModuleHeader from "./ModuleHeader";
import ModuleTabs from "./ModuleTabs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ModuleApi = {
  id: number;
  title: string;
  description: string;
  is_published: boolean;
  resources?: { id: number; kind: string; title: string; duration: string; url?: string | null; content_markdown?: string | null }[];
};

export default function ModuleDetailPage({ params }: { params: { id: string } }) {
  const routeParams = useParams<{ id?: string }>();
  const rawId = String(routeParams?.id ?? params?.id ?? "").trim();
  const hasId = Boolean(rawId);
  const isValidId = hasId && /^\d+$/.test(rawId);
  const { token } = useAuth();
  const [mod, setMod] = useState<ModuleApi | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  useEffect(() => {
    if (!token || !hasId || !isValidId) return;
    let cancelled = false;
    (async () => {
      setHasTriedFetch(true);
      setNotFound(false);
      setAuthExpired(false);
      setErrorDetail(null);
      setStatusCode(null);
      try {
        const r = await fetch(`${API_URL}/modules/${encodeURIComponent(rawId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (r.status === 401 || r.status === 403) {
          const data = await r.json().catch(() => ({}));
          const detail = typeof (data as any)?.detail === "string" ? (data as any).detail : null;
          setStatusCode(r.status);
          setErrorDetail(detail);
          setAuthExpired(true);
          setNotFound(true);
          setMod(null);
          return;
        }
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          const detail = typeof (data as any)?.detail === "string" ? (data as any).detail : null;
          setStatusCode(r.status);
          setErrorDetail(detail);
          setNotFound(true);
          setMod(null);
          return;
        }
        const data = (await r.json()) as ModuleApi;
        setMod(data);
      } catch {
        if (!cancelled) {
          setStatusCode(null);
          setErrorDetail("Network error contacting backend.");
          setNotFound(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, rawId, hasId, isValidId]);

  const moduleForTabs = useMemo(() => {
    const res = Array.isArray(mod?.resources) ? mod!.resources! : [];
    const readings = res
      .filter((r) => String(r.kind).toLowerCase() === "reading")
      .map((r) => ({ title: r.title, time: r.duration, url: r.url ?? null, content_markdown: r.content_markdown ?? null }));
    const videos = res
      .filter((r) => String(r.kind).toLowerCase() === "video")
      .map((r) => ({ title: r.title, time: r.duration, url: r.url ?? null }));
    return {
      title: mod?.title ?? "",
      description: mod?.description ?? "",
      mastery: "—",
      progress: "0%",
      readings,
      videos,
    };
  }, [mod]);

  return (
    <div className="min-h-screen bg-white">
      <ModuleHeader moduleId={rawId} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Modules</span>
        </Link>

        {!hasId ? (
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading…</h2>
            <p className="text-gray-600">Resolving module route.</p>
          </div>
        ) : !isValidId ? (
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Module not available</h2>
            <p className="text-gray-600">Invalid module id.</p>
          </div>
        ) : !token ? (
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading…</h2>
            <p className="text-gray-600">Getting your session ready.</p>
          </div>
        ) : notFound ? (
          <div className="rounded border border-gray-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Module not available</h2>
            {authExpired ? (
              <p className="text-gray-600">
                Your session expired. Please go back to the dashboard and log in again.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-600">This module is locked or does not exist yet.</p>
                {(statusCode || errorDetail) ? (
                  <div className="rounded border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                    <div>
                      <span className="font-semibold">Backend status</span>:{" "}
                      {statusCode ? statusCode : "no response"}
                    </div>
                    {errorDetail ? (
                      <div className="mt-1">
                        <span className="font-semibold">Detail</span>: {errorDetail}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!hasTriedFetch ? (
                  <div className="text-sm text-gray-600">
                    Note: module fetch was not attempted yet (token not ready).
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-black mb-2">
                  Module {rawId}: {mod?.title ?? "Loading..."}
                </h2>
                <p className="text-gray-600 text-lg">{mod?.description ?? ""}</p>
              </div>
            </div>

            <ModuleTabs moduleId={rawId} module={moduleForTabs} activeTab="content" />
          </>
        )}
      </main>
    </div>
  );
}
