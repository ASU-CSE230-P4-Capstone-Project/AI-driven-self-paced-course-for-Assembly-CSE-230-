import { headers } from "next/headers";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";
import StudentNewProjectClient from "./client";

export default async function StudentNewProjectPage() {
  const auth = readVerifiedRequestAuth(await headers());

  return <StudentNewProjectClient sessionUsername={auth?.username ?? null} />;
}
