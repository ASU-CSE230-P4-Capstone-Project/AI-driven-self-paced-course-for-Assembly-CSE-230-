import Sidebar from "@/components/sidebar";

export default function StudentLabLoadingShell({
  label = "Opening lab...",
}: {
  label?: string;
}) {
  return (
    <div className="min-h-screen bg-[rgb(82,82,82)] text-zinc-100 flex">
      <Sidebar initialOpen={false} />
      <main className="flex-1 relative px-4 pt-16 sm:px-6 md:pl-23 md:pt-0">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-500 border-t-transparent" />
            <p className="text-sm text-zinc-300">{label}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
