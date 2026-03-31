import Link from "next/link";

export type ModuleActiveTab = "content" | "mastery" | "sandbox" | "tutor";

type ModuleData = {
  title: string;
  description: string;
  mastery: string;
  progress: string;
  readings: { title: string; time: string }[];
  videos: { title: string; time: string }[];
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

export default function ModuleTabs({ moduleId, activeTab = "content", module }: ModuleTabsProps) {
  const a = activeTab;

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-gray-300 mb-6">
        {a === "content" ? (
          <div className={tabClass(true)}>Learning Content</div>
        ) : (
          <Link href={`/module/${moduleId}`} className={tabClass(false)}>
            Learning Content
          </Link>
        )}
        {a === "mastery" ? (
          <div className={tabClass(true)}>Practice &amp; Mastery</div>
        ) : (
          <Link href={`/module/${moduleId}/mastery`} className={tabClass(false)}>
            Practice &amp; Mastery
          </Link>
        )}
        {a === "sandbox" ? (
          <div className={tabClass(true)}>Coding Sandbox</div>
        ) : (
          <Link href={`/module/${moduleId}/sandbox`} className={tabClass(false)}>
            Coding Sandbox
          </Link>
        )}
        {a === "tutor" ? (
          <div className={tabClass(true)}>AI Tutor</div>
        ) : (
          <Link href={`/module/${moduleId}/tutor`} className={tabClass(false)}>
            AI Tutor
          </Link>
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
                  <div
                    key={index}
                    className={`flex items-center py-4 ${index < module.readings.length - 1 ? "border-b border-gray-200" : ""}`}
                  >
                    <div className="w-6 h-6 mr-4 rounded-full bg-[#800020] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-black font-medium">{reading.title}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm">{reading.time}</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
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
                  <div
                    key={index}
                    className={`flex items-center py-4 ${index < module.videos.length - 1 ? "border-b border-gray-200" : ""}`}
                  >
                    <div className="w-6 h-6 mr-4 rounded-full bg-[#800020] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-black font-medium">{video.title}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm">{video.time}</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
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
