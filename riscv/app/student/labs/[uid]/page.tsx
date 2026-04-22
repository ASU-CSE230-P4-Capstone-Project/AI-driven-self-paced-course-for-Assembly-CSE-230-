import { headers } from "next/headers";
import StudentLabRoutePage from "@/components/student-lab-route-page";
import { readVerifiedRequestAuth } from "@/app/verify/request-auth";

type StudentLabDetailPageProps = {
  params: Promise<{ uid: string }>;
  searchParams?: Promise<{ course_id?: string | string[] | undefined }>;
};

function getSingleSearchParam(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function StudentLabDetailPage({
  params,
  searchParams,
}: StudentLabDetailPageProps) {
  const auth = readVerifiedRequestAuth(await headers());
  const resolvedParams = await params;
  const resolvedSearchParams = await (
    searchParams ?? Promise.resolve({} as { course_id?: string | string[] | undefined })
  );
  const courseId = getSingleSearchParam(resolvedSearchParams.course_id).trim();

  return (
    <StudentLabRoutePage
      courseId={courseId}
      labUid={resolvedParams.uid}
      sessionUsername={auth?.username ?? null}
    />
  );
}
