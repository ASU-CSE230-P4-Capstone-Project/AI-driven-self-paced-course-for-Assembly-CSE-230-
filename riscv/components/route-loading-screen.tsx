export default function RouteLoadingScreen({
  label = "Loading page...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(82,82,82)] px-6 text-zinc-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-500 border-t-transparent" />
        <p className="text-sm text-zinc-300">{label}</p>
      </div>
    </div>
  );
}
