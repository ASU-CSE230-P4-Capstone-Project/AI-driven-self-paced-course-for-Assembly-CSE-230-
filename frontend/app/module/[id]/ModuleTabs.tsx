import Link from "next/link";
import ReactMarkdown from "react-markdown";

export type ModuleActiveTab = "content" | "mastery" | "sandbox" | "tutor";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ModuleData = {
  title: string;
  description: string;
  mastery: string;
  progress: string;
  readings: { title: string; time: string; url?: string | null; content_markdown?: string | null }[];
  videos: { title: string; time: string; url?: string | null }[];
};

type ModuleTabsProps = {
  moduleId: string;
  activeTab?: ModuleActiveTab;
  module?: ModuleData;
};

function tabClass(active: boolean) {
  return active
    ? "px-6 py-3 font-semibold text-black border-b-2 border-black"
    : "px-6 py-3 text-gray-600 hover:text-black transition-colors";
}

function resolveResourceUrl(url: string | null | undefined): string | null {
  const u = String(url ?? "").trim();
  if (!u) return null;
  // PDFs uploaded via backend are returned as /static/...; make absolute so it opens from frontend origin.
  if (u.startsWith("/static/")) return `${API_URL}${u}`;
  return u;
}

export default function ModuleTabs({ moduleId, activeTab = "content", module }: ModuleTabsProps) {
  const a = activeTab;
  const isValidModuleId = /^\d+$/.test(String(moduleId ?? ""));

  const youtubeEmbedUrl = (url: string) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.replace("/", "").trim();
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-gray-300 mb-6">
        {a === "content" ? (
          <div className={tabClass(true)}>Learning Content</div>
        ) : (
          isValidModuleId ? (
            <Link href={`/module/${moduleId}`} className={tabClass(false)}>
              Learning Content
            </Link>
          ) : (
            <div className={tabClass(false)}>Learning Content</div>
          )
        )}
        {a === "mastery" ? (
          <div className={tabClass(true)}>Practice &amp; Mastery</div>
        ) : (
          isValidModuleId ? (
            <Link href={`/module/${moduleId}/mastery`} className={tabClass(false)}>
              Practice &amp; Mastery
            </Link>
          ) : (
            <div className={tabClass(false)}>Practice &amp; Mastery</div>
          )
        )}
        {a === "sandbox" ? (
          <div className={tabClass(true)}>Coding Sandbox</div>
        ) : (
          isValidModuleId ? (
            <Link href={`/module/${moduleId}/sandbox`} className={tabClass(false)}>
              Coding Sandbox
            </Link>
          ) : (
            <div className={tabClass(false)}>Coding Sandbox</div>
          )
        )}
        {a === "tutor" ? (
          <div className={tabClass(true)}>AI Tutor</div>
        ) : (
          isValidModuleId ? (
            <Link href={`/module/${moduleId}/tutor`} className={tabClass(false)}>
              AI Tutor
            </Link>
          ) : (
            <div className={tabClass(false)}>AI Tutor</div>
          )
        )}
      </div>

      {a === "content" && module && (
        <div>
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-black">Readings</h3>
              </div>

              <div className="space-y-0">
                {module.readings.map((reading, index) => (
                  <div key={index} className={`py-4 ${index < module.readings.length - 1 ? "border-b border-gray-200" : ""}`}>
                    <div className="flex items-center">
                      <div className="w-6 h-6 mr-4 rounded-full bg-[#800020] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-black font-medium">{reading.title}</h4>
                        {(reading.url || reading.content_markdown) && (
                          <div className="mt-2 space-y-2">
                            {resolveResourceUrl(reading.url) && (
                              <a
                                href={resolveResourceUrl(reading.url) ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-[#800020] hover:underline"
                              >
                                Open PDF / link
                              </a>
                            )}
                            {reading.content_markdown && (
                              <div className="prose prose-slate max-w-none">
                                <ReactMarkdown>{reading.content_markdown}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500 text-sm">{reading.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-black">Video Lessons</h3>
              </div>

              <div className="space-y-0">
                {module.videos.map((video, index) => (
                  <div key={index} className={`py-4 ${index < module.videos.length - 1 ? "border-b border-gray-200" : ""}`}>
                    <div className="flex items-center">
                      <div className="w-6 h-6 mr-4 rounded-full bg-[#800020] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-black font-medium">{video.title}</h4>
                        {video.url && (
                          <div className="mt-3 space-y-2">
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-[#800020] hover:underline"
                            >
                              Open video link
                            </a>
                            {youtubeEmbedUrl(video.url) && (
                              <div className="aspect-video w-full overflow-hidden rounded border border-gray-200">
                                <iframe
                                  src={youtubeEmbedUrl(video.url) ?? undefined}
                                  className="h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={video.title}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500 text-sm">{video.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
