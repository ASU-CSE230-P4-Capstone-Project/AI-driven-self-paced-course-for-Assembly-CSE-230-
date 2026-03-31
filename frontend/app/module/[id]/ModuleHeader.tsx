import Link from "next/link";

type ModuleHeaderProps = {
  moduleId: string;
};

export default function ModuleHeader({ moduleId }: ModuleHeaderProps) {
  return (
    <header className="bg-[#800020] px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
            <span className="text-[#800020] font-bold text-lg">CSE</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CSE 230</h1>
            <p className="text-sm text-white">Computer Systems</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-white/90 hover:text-white text-sm">
            Dashboard
          </Link>
          <Link href={`/module/${moduleId}/tutor`} className="text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17a5.5 5.5 0 010-9.663m5.197 0a5.5 5.5 0 010 9.663M7.5 21L7.5 9M16.5 21V9M12 21V9"
              />
            </svg>
            <span>AI Tutor</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
