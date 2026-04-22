export type ProjectState = {
  code: string;
  resp: AssemblyInfoData | null;
  simState: SimState | null;
  stepIndex: number;
  allStates: SubmitResponse["states"];
  registerOverrides: Record<string, string>;
  memoryOverrides: Record<string, string>;
};

/**
 * A single project (like one Google Doc)
 */
export type Project = {
  id: string; // "p-..." unique per project
  name: string; // "Untitled project 1", etc.
  description?: string;
  createdAt: string; // ISO timestamp
  state: ProjectState;
};

/**
 * Workspace = everything saved for a user in localStorage
 */
export type Workspace = {
  uid: string;
  currentProjectId: string | null;
  projects: Project[];
};

//BACKEND MUST MATCH THIS
export type SubmitRequest = {
  code: string;
  registers: Record<string, string>;
  memory: Record<string, string>;
};

//BACKEND MUST MATCH THIS
export type SubmitResponse = {
  hadError: boolean;
  errorMessage: string;
  states: Array<{
    registers: Record<string, string>; // register -> value
    memory: Record<string, string>; // addr -> value
    labelName: string;
  }>;
};

export type AssemblyInfoData = {
  hadError: boolean;
  errorMessage: string;
  registers: Record<string, string>;
  memory: Record<string, string>;
};

export type CompileStatus = {
  state: "idle" | "compiling" | "success" | "error";
  message: string;
};

// State shape returned by /api/sim
export type SimState = {
  currentLine: number;
  halted: boolean;
  registers: Record<string, number | string>;
  memory: Record<string, number | string>;
  labelName?: string;
  errorMessage?: string | null;
};
