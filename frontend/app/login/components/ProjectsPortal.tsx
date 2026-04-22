import Link from "next/link";

type ProjectsPortalProps = {
  variant: "student" | "staff";
};

function _normalizeExternalUrl(raw: string | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
}

const P1_URL = _normalizeExternalUrl(process.env.NEXT_PUBLIC_PROJECT1_URL);
const P2_URL = _normalizeExternalUrl(process.env.NEXT_PUBLIC_PROJECT2_URL);
const P3_URL = _normalizeExternalUrl(process.env.NEXT_PUBLIC_PROJECT3_URL);

type ProjectLink = {
  title: string;
  description: string;
  href: string | null;
  envKey: "NEXT_PUBLIC_PROJECT1_URL" | "NEXT_PUBLIC_PROJECT2_URL" | "NEXT_PUBLIC_PROJECT3_URL";
};

export function ProjectsPortal({ variant }: ProjectsPortalProps) {
  const links: ProjectLink[] = [
    {
      title: "Project 1: MIPS Emulator",
      description: "MIPS32 emulator + labs (standalone app).",
      href: P1_URL,
      envKey: "NEXT_PUBLIC_PROJECT1_URL",
    },
    {
      title: "Project 2: RISC-V Emulator",
      description: "RISC-V emulator + grading (standalone app).",
      href: P2_URL,
      envKey: "NEXT_PUBLIC_PROJECT2_URL",
    },
    {
      title: "Project 3: x86 Emulator",
      description: "Educational 32-bit x86 subset emulator (standalone app).",
      href: P3_URL,
      envKey: "NEXT_PUBLIC_PROJECT3_URL",
    },
  ];

  return (
    <div className="rounded border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Other projects</h3>
          <p className="text-sm text-gray-600">
            Open Projects 1–3 hosted on the VPS. These run independently from Project 4.
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {variant === "staff" ? "Staff view" : "Student view"}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {links.map((p) => (
          <div key={p.title} className="rounded border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">{p.title}</div>
            <div className="mt-1 text-sm text-gray-600">{p.description}</div>
            <div className="mt-3">
              {p.href ? (
                <Link
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-[#800020] hover:underline"
                >
                  Open
                </Link>
              ) : (
                <div className="text-xs text-gray-500">
                  Not configured. Set <span className="font-mono">{p.envKey}</span>.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

