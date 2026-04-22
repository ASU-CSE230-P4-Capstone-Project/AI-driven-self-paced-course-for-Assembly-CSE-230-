import { headers } from "next/headers";
import Root from "@/components/root";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

export default async function StudentProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const auth = readVerifiedRequestAuth(await headers());
  const { projectId } = await params;

  return (
    <Root
      initialView="editor"
      initialProjectId={projectId}
      sessionUsername={auth?.username ?? null}
    />
  );
}
