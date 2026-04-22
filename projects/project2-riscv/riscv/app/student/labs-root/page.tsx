import { redirect } from "next/navigation";

type StudentLabsRootPageProps = {
  searchParams?: Promise<{
    course_id?: string | string[] | undefined;
    lab?: string | string[] | undefined;
  }>;
};

function getSingleSearchParam(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function StudentLabsRootPage({
  searchParams,
}: StudentLabsRootPageProps) {
  const resolvedSearchParams = await (
    searchParams ??
    Promise.resolve({
      course_id: undefined,
      lab: undefined,
    } as {
      course_id?: string | string[] | undefined;
      lab?: string | string[] | undefined;
    })
  );
  const courseId = getSingleSearchParam(resolvedSearchParams.course_id).trim();
  const labUid = getSingleSearchParam(resolvedSearchParams.lab).trim();

  if (!courseId || !labUid) {
    redirect("/student/labs");
  }

  redirect(
    `/student/labs/${encodeURIComponent(labUid)}?course_id=${encodeURIComponent(courseId)}`
  );
}
