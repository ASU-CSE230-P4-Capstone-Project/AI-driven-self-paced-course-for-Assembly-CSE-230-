import { headers } from "next/headers";
import StaffSimulator from "@/components/staff-simulator";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

export default async function InstructorSimulatorPage() {
  const auth = readVerifiedRequestAuth(await headers());

  return (
    <StaffSimulator
      role="instructor"
      sessionUsername={auth?.username ?? null}
    />
  );
}
