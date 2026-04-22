import { headers } from "next/headers";
import Root from "@/components/root";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

export default async function StudentProjectsPage() {
  const auth = readVerifiedRequestAuth(await headers());

  return (
    <Root
      initialView="projects"
      sessionUsername={auth?.username ?? null}
    />
  );
}
