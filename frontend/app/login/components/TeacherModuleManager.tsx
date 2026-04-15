"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ModuleRow = {
  id: number;
  title: string;
  description: string;
  is_published: boolean;
};

type ModuleDetail = ModuleRow & {
  resources?: Array<{
    id: number;
    kind: "reading" | "video" | string;
    title: string;
    duration: string;
    url?: string | null;
    content_markdown?: string | null;
  }>;
};

type ResourceDraft = {
  key: string;
  kind: "reading" | "video";
  title: string;
  duration: string;
  url?: string;
  content_markdown?: string;
  // UI-only toggles (not persisted)
  showLinkLayer?: boolean;
  showMarkdownLayer?: boolean;
};

export default function TeacherModuleManager({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [resources, setResources] = useState<ResourceDraft[]>([]);

  const readings = useMemo(() => resources.filter((r) => r.kind === "reading"), [resources]);
  const videos = useMemo(() => resources.filter((r) => r.kind === "video"), [resources]);

  const loadModules = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_URL}/modules`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401 || r.status === 403) {
        toast.error("Session expired. Please sign in again.");
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      if (!r.ok) {
        toast.error("Failed to load modules.");
        return;
      }
      const data = (await r.json()) as any[];
      if (!Array.isArray(data)) return;
      setModules(
        data
          .map((m) => ({
            id: Number(m?.id ?? 0),
            title: String(m?.title ?? ""),
            description: String(m?.description ?? ""),
            is_published: Boolean(m?.is_published),
          }))
          .filter((m) => Number.isFinite(m.id) && m.id > 0 && m.title),
      );
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const addResource = (kind: "reading" | "video") => {
    setResources((prev) => [
      ...prev,
      kind === "reading"
        ? {
            key: crypto.randomUUID(),
            kind,
            title: "",
            duration: "",
            url: "",
            content_markdown: "",
            showLinkLayer: false,
            showMarkdownLayer: true,
          }
        : {
            key: crypto.randomUUID(),
            kind,
            title: "",
            duration: "",
            url: "",
            content_markdown: "",
          },
    ]);
  };

  const updateResource = (key: string, patch: Partial<ResourceDraft>) => {
    setResources((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeResource = (key: string) => {
    setResources((prev) => prev.filter((r) => r.key !== key));
  };

  const createOrUpdateModule = async () => {
    if (!token) return;
    const t = title.trim();
    if (!t) {
      toast.error("Enter a module title.");
      return;
    }
    setLoading(true);
    try {
      const body = {
        title: t,
        description: description.trim(),
        is_published: Boolean(isPublished),
        resources: resources
          .map((r) => ({
            kind: r.kind,
            title: r.title.trim(),
            duration: r.duration.trim(),
            url: String(r.url ?? "").trim() || null,
            content_markdown: String(r.content_markdown ?? "").trim() || null,
          }))
          .filter((r) => r.title),
      };
      const isEdit = typeof selectedId === "number" && selectedId > 0;
      const r = await fetch(isEdit ? `${API_URL}/modules/${selectedId}` : `${API_URL}/modules`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(typeof data?.detail === "string" ? data.detail : isEdit ? "Failed to update module." : "Failed to create module.");
        return;
      }

      const moduleId = Number(data?.id ?? 0);
      toast.success(`${isEdit ? "Updated" : "Created"} module ${moduleId}. Ensuring Canvas assignment…`);

      const r2 = await fetch(`${API_URL}/pushback/ensure-module-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ module_id: moduleId }),
      });
      const data2 = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        toast.error(typeof data2?.detail === "string" ? data2.detail : "Module created, but Canvas assignment failed.");
      } else {
        toast.success(`Canvas assignment ready for module ${moduleId}.`);
      }

      setSelectedId(null);
      setTitle("");
      setDescription("");
      setIsPublished(true);
      setResources([]);
      await loadModules();
    } catch {
      toast.error("Failed to save module.");
    } finally {
      setLoading(false);
    }
  };

  const deleteModule = async (id: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/modules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) {
        toast.error("Not authorized (session expired or not staff). Please sign in again.");
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      if (!r.ok) {
        toast.error(typeof data?.detail === "string" ? data.detail : "Failed to delete module.");
        return;
      }
      toast.success(`Deleted module ${id}.`);
      setModules((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setTitle("");
        setDescription("");
        setIsPublished(true);
        setResources([]);
      }
      await loadModules();
    } catch {
      toast.error("Failed to delete module.");
    } finally {
      setLoading(false);
    }
  };

  const loadModuleDetail = useCallback(
    async (id: number) => {
      if (!token) return null;
      try {
        const r = await fetch(`${API_URL}/modules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return null;
        return (await r.json()) as ModuleDetail;
      } catch {
        return null;
      }
    },
    [token],
  );

  const renderResourceTable = (kind: "reading" | "video", rows: ResourceDraft[]) => (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">{kind === "reading" ? "Readings" : "Videos"}</h4>
        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => addResource(kind)}>
          Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">None yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            return (
              <div key={r.key} className="rounded border border-gray-200 p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <input
                  value={r.title}
                  onChange={(e) => updateResource(r.key, { title: e.target.value })}
                  placeholder="Title"
                  className="md:col-span-7 h-9 rounded border border-gray-300 bg-white px-3 text-sm"
                />
                <input
                  value={r.duration}
                  onChange={(e) => updateResource(r.key, { duration: e.target.value })}
                  placeholder="Duration (e.g. 20 min)"
                  className="md:col-span-4 h-9 rounded border border-gray-300 bg-white px-3 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="md:col-span-1 h-9 px-3 text-xs"
                  onClick={() => removeResource(r.key)}
                >
                  Remove
                </Button>
                </div>

                {kind === "video" ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <input
                      value={r.url ?? ""}
                      onChange={(e) => updateResource(r.key, { url: e.target.value })}
                      placeholder="YouTube link (optional)"
                      className="md:col-span-12 h-9 rounded border border-gray-300 bg-white px-3 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={r.showMarkdownLayer ? "default" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => updateResource(r.key, { showMarkdownLayer: !r.showMarkdownLayer })}
                      >
                        Markdown layer
                      </Button>
                      <Button
                        type="button"
                        variant={r.showLinkLayer ? "default" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => updateResource(r.key, { showLinkLayer: !r.showLinkLayer })}
                      >
                        PDF / link layer
                      </Button>
                    </div>

                    {r.showLinkLayer ? (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <input
                          value={r.url ?? ""}
                          onChange={(e) => updateResource(r.key, { url: e.target.value })}
                          placeholder="PDF/link URL (optional) or use Upload PDF"
                          className="md:col-span-9 h-9 rounded border border-gray-300 bg-white px-3 text-sm"
                        />
                        <label className="md:col-span-3 inline-flex h-9 items-center justify-center rounded border border-gray-300 bg-white px-3 text-xs font-medium cursor-pointer">
                          Upload PDF
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const fd = new FormData();
                                fd.append("file", f);
                                const resp = await fetch(`${API_URL}/modules/upload-pdf`, {
                                  method: "POST",
                                  headers: { Authorization: `Bearer ${token}` },
                                  body: fd,
                                });
                                const data = await resp.json().catch(() => ({}));
                                if (!resp.ok) {
                                  toast.error(typeof data?.detail === "string" ? data.detail : "Upload failed.");
                                  return;
                                }
                                const url = String(data?.url ?? "");
                                if (url) {
                                  updateResource(r.key, { url: `${API_URL}${url}` });
                                  toast.success("Uploaded PDF.");
                                }
                              } catch {
                                toast.error("Upload failed.");
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {r.showMarkdownLayer ? (
                      <textarea
                        value={r.content_markdown ?? ""}
                        onChange={(e) => updateResource(r.key, { content_markdown: e.target.value })}
                        placeholder="Reading notes/content (Markdown supported)"
                        className="h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-mono"
                      />
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage modules</h2>
          <p className="text-sm text-gray-600">Create new modules and auto-create the Canvas mastery assignment.</p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{selectedId ? `Edit module ${selectedId}` : "Create new module"}</h3>
          {selectedId ? (
            <div className="flex items-center gap-2">
              <a
                href={`/module/${selectedId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-[#800020] hover:underline"
              >
                Preview as student
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedId(null);
                  setTitle("");
                  setDescription("");
                  setIsPublished(true);
                  setResources([]);
                }}
              >
                Cancel edit
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Module title"
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Visible to students</label>
            <select
              value={isPublished ? "yes" : "no"}
              onChange={(e) => setIsPublished(e.target.value === "yes")}
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="yes">Published (unlocked)</option>
              <option value="no">Unpublished (locked)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short module description"
            className="h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderResourceTable("reading", readings)}
          {renderResourceTable("video", videos)}
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={createOrUpdateModule} disabled={loading} className="bg-[#800020] text-white hover:bg-[#6b001a]">
            {loading ? "Saving…" : selectedId ? "Save changes" : "Create module"}
          </Button>
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Existing modules</h3>
          <Button type="button" variant="outline" onClick={loadModules}>
            Refresh
          </Button>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-600">
              <tr>
                <th className="py-2 pr-3">id</th>
                <th className="py-2 pr-3">title</th>
                <th className="py-2 pr-3">status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {modules.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3">{m.id}</td>
                  <td className="py-2 pr-3">{m.title}</td>
                  <td className="py-2 pr-3">{m.is_published ? "published" : "locked"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={async () => {
                          setSelectedId(m.id);
                          setTitle(m.title);
                          setDescription(m.description);
                          setIsPublished(Boolean(m.is_published));
                          setResources([]);

                          const detail = await loadModuleDetail(m.id);
                          if (!detail) {
                            toast.error("Failed to load module details.");
                            return;
                          }
                          const res = Array.isArray(detail.resources) ? detail.resources : [];
                          const drafts = res
                            .map(
                              (r) =>
                                ({
                                key: crypto.randomUUID(),
                                  kind: String(r.kind).toLowerCase() === "video" ? "video" : "reading",
                                  title: String(r.title ?? ""),
                                  duration: String(r.duration ?? ""),
                                  url: String(r.url ?? ""),
                                  content_markdown: String(r.content_markdown ?? ""),
                                  showLinkLayer: Boolean(r.url),
                                  showMarkdownLayer: Boolean(r.content_markdown) || !r.url,
                                }) satisfies ResourceDraft,
                            )
                            .filter((r) => r.title);
                          setResources(drafts);
                          toast.success(`Loaded module ${m.id} resources for editing.`);
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        disabled={loading}
                        onClick={() => {
                          if (!confirm(`Delete module ${m.id}? This will remove its resources, progress rows, and Canvas mapping.`)) return;
                          deleteModule(m.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {modules.length === 0 && (
                <tr>
                  <td className="py-3 text-gray-600" colSpan={4}>
                    No modules found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

