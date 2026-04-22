const resources = [
  {
    title: "RISC-V User ISA Manual (RV32)",
    description:
      "Authoritative reference for RV32 instruction set, formats, and behavior.",
    href: "https://five-embeddev.com/riscv-user-isa-manual/latest-latex/rv32.html",
    badge: "Manual",
  },
  {
    title: "RISC-V Green Card (PDF)",
    description:
      "Concise quick-reference for instruction encodings and key tables.",
    href: "http://riscvbook.com/greencard-20181213.pdf",
    badge: "Quick Reference",
  },
];

export default function StudentDocsPage() {
  return (
    <div className="px-4 py-6 md:px-6">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-6 shadow-lg">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-zinc-400">
            Resources
          </span>
          <h1 className="text-2xl font-semibold">RISC-V Documentation</h1>
          <p className="max-w-2xl text-sm text-zinc-300">
            Curated references for instruction set details, formats, and quick lookup while you code.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {resources.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-zinc-700 bg-zinc-900/50 p-5 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-900/70"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {item.badge}
              </span>
              <span className="text-xs text-zinc-400 group-hover:text-zinc-200">
                Open ↗
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              {item.description}
            </p>
          </a>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/40 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Tips
        </h3>
        <div className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3">
            Use the ISA Manual when you need precise behavior details.
          </div>
          <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3">
            Use the Green Card for quick opcode and format checks.
          </div>
        </div>
      </div>
    </div>
  );
}
