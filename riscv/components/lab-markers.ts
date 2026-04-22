export type LabViewMode = "student" | "teacher";

function stripTeacherSections(md: string): string {
  // Remove any teacher-only solution/answers blocks.
  let out = md
    .replace(
      /<!--\s*EXPECTED_SOLUTION\s*-->[\s\S]*?<!--\s*EXPECTED_SOLUTION_END\s*-->/gi,
      ""
    )
    .replace(
      /<!--\s*SAMPLE_SHORT_ANSWER\s*-->[\s\S]*?<!--\s*SAMPLE_SHORT_ANSWER_END\s*-->/gi,
      ""
    );
  // Strip short-answer section even if markers were omitted (legacy / hand-edited MD).
  out = out.replace(
    /##\s*Short Answer[^\n]*\n[\s\S]*?(?=\n##\s*Grading Breakdown\b)/gi,
    ""
  );
  // Legacy rows: "Part B: Short Answer Question — 20 points" left under Grading after Part A.
  out = out.replace(
    /^\s*(?:\*\*)?Part\s*B:(?:\*\*)?\s*[^\n]*\bshort answer\b[^\n]*$/gim,
    ""
  );
  return out.replace(/\n{3,}/g, "\n\n");
}

function extractSection(md: string, startTag: string, endTag: string): string | null {
  const re = new RegExp(
    startTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + endTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );
  const startRe = new RegExp(startTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const endRe = new RegExp(endTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const match = md.match(re);
  if (!match) return null;

  // Strip the surrounding markers.
  return match[0]
    .replace(startRe, "")
    .replace(endRe, "")
    .trim();
}

function extractFirstCodeFence(section: string): string | null {
  // Support both ``` and ~~~ code fences.
  const fenceMatch =
    section.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/m) ??
    section.match(/~~~[a-zA-Z0-9_-]*\n([\s\S]*?)~~~/m);

  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return section.trim() || null;
}

export function filterLabMd(md: string, mode: LabViewMode): string {
  if (mode === "teacher") return md;
  return stripTeacherSections(md);
}

export function extractStarterCode(md: string): string | null {
  const section = extractSection(md, "<!-- STUDENT_STARTER -->", "<!-- STUDENT_STARTER_END -->");
  if (!section) return null;
  return extractFirstCodeFence(section);
}

export function extractExpectedSolutionCode(md: string): string | null {
  const section = extractSection(md, "<!-- EXPECTED_SOLUTION -->", "<!-- EXPECTED_SOLUTION_END -->");
  if (!section) return null;
  return extractFirstCodeFence(section);
}

