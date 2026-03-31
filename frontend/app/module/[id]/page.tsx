import Link from "next/link";
import ModuleHeader from "./ModuleHeader";
import ModuleTabs from "./ModuleTabs";

// Module data structure
const moduleData: Record<string, {
  title: string;
  description: string;
  mastery: string;
  progress: string;
  readings: { title: string; time: string }[];
  videos: { title: string; time: string }[];
}> = {
  "1": {
    title: "Introduction to Computer Architecture",
    description: "Abstraction layers, performance metrics, instruction sets, MIPS basics.",
    mastery: "92%",
    progress: "100%",
    readings: [
      { title: "Computer Abstraction and Technology", time: "20 min" },
      { title: "Performance Metrics: CPI, Clock Rate", time: "18 min" },
      { title: "Instruction Set Principles", time: "22 min" },
      { title: "Introduction to MIPS Architecture", time: "25 min" }
    ],
    videos: [
      { title: "Overview of Computer Architecture", time: "15 min" },
      { title: "Performance Evaluation Techniques", time: "18 min" },
      { title: "MIPS Assembly Basics", time: "25 min" },
      { title: "MIPS Instruction Set Deep Dive", time: "30 min" }
    ]
  },
  "2": {
    title: "MIPS Introduction, ALU and Data Transfer",
    description: "MIPS registers, arithmetic operations, load/store instructions, memory addressing.",
    mastery: "88%",
    progress: "100%",
    readings: [
      { title: "MIPS Register File and Conventions", time: "20 min" },
      { title: "Arithmetic and Logical Operations", time: "18 min" },
      { title: "Load and Store Instructions", time: "22 min" },
      { title: "Memory Addressing Modes", time: "25 min" }
    ],
    videos: [
      { title: "MIPS Register Architecture", time: "15 min" },
      { title: "ALU Operations in MIPS", time: "18 min" },
      { title: "Data Transfer Instructions", time: "25 min" },
      { title: "Memory Access Patterns", time: "30 min" }
    ]
  },
  "3": {
    title: "Branch Instructions and Machine Code",
    description: "Conditional branching, jump instructions, encoding MIPS to machine code.",
    mastery: "70%",
    progress: "50%",
    readings: [
      { title: "Conditional Branch Instructions", time: "20 min" },
      { title: "Jump and Jump Register", time: "18 min" },
      { title: "MIPS Instruction Encoding", time: "22 min" },
      { title: "Machine Code Format", time: "25 min" }
    ],
    videos: [
      { title: "Branch Instruction Types", time: "15 min" },
      { title: "Control Flow in MIPS", time: "18 min" },
      { title: "Instruction Encoding", time: "25 min" },
      { title: "Machine Code Examples", time: "30 min" }
    ]
  },
  "4": {
    title: "Procedure Execution",
    description: "Function calls, stack frames, register conventions, procedure linkage.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Function Call Mechanism", time: "20 min" },
      { title: "Stack Frame Structure", time: "18 min" },
      { title: "Register Conventions ($ra, $sp, $fp)", time: "22 min" },
      { title: "Procedure Linkage and Return", time: "25 min" }
    ],
    videos: [
      { title: "Introduction to Procedures", time: "15 min" },
      { title: "Stack Management", time: "18 min" },
      { title: "Calling Conventions", time: "25 min" },
      { title: "Nested Procedure Calls", time: "30 min" }
    ]
  },
  "5": {
    title: "Linking, Loading and MIPS Summary",
    description: "Object files, linking process, loaders, MIPS instruction set summary.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Object File Format", time: "20 min" },
      { title: "Static Linking Process", time: "18 min" },
      { title: "Dynamic Linking", time: "22 min" },
      { title: "MIPS Instruction Set Reference", time: "25 min" }
    ],
    videos: [
      { title: "Object Files and Symbols", time: "15 min" },
      { title: "Linker Operation", time: "18 min" },
      { title: "Loader and Execution", time: "25 min" },
      { title: "Complete MIPS Reference", time: "30 min" }
    ]
  },
  "6": {
    title: "Arithmetic For Computers",
    description: "Integer arithmetic, floating point representation, arithmetic operations.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Integer Addition and Subtraction", time: "20 min" },
      { title: "Integer Multiplication and Division", time: "18 min" },
      { title: "Floating Point Representation", time: "22 min" },
      { title: "Floating Point Operations", time: "25 min" }
    ],
    videos: [
      { title: "Integer Arithmetic Operations", time: "15 min" },
      { title: "Multiplication Algorithms", time: "18 min" },
      { title: "IEEE 754 Floating Point", time: "25 min" },
      { title: "Floating Point Arithmetic", time: "30 min" }
    ]
  },
  "7": {
    title: "Single Cycle Implementation",
    description: "Single cycle datapath, control unit design, instruction execution.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Single Cycle Datapath Design", time: "20 min" },
      { title: "Control Unit Implementation", time: "18 min" },
      { title: "Instruction Execution Flow", time: "22 min" },
      { title: "Performance Limitations", time: "25 min" }
    ],
    videos: [
      { title: "Datapath Components", time: "15 min" },
      { title: "Control Signals", time: "18 min" },
      { title: "Complete Single Cycle CPU", time: "25 min" },
      { title: "Timing and Clock Cycles", time: "30 min" }
    ]
  },
  "8": {
    title: "Multicycle Implementation",
    description: "Multicycle datapath, finite state machine control, performance tradeoffs.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Multicycle Datapath Design", time: "20 min" },
      { title: "Finite State Machine Control", time: "18 min" },
      { title: "Instruction Execution States", time: "22 min" },
      { title: "Performance Analysis", time: "25 min" }
    ],
    videos: [
      { title: "Multicycle Approach", time: "15 min" },
      { title: "State Machine Design", time: "18 min" },
      { title: "Instruction Execution", time: "25 min" },
      { title: "Performance Comparison", time: "30 min" }
    ]
  },
  "9": {
    title: "Pipeline Implementation and Exception Handling",
    description: "Pipeline stages, hazards, forwarding, exception handling.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Pipeline Stages and Structure", time: "20 min" },
      { title: "Data Hazards and Forwarding", time: "18 min" },
      { title: "Control Hazards and Branch Prediction", time: "22 min" },
      { title: "Exception Handling in Pipelines", time: "25 min" }
    ],
    videos: [
      { title: "Pipeline Fundamentals", time: "15 min" },
      { title: "Hazard Detection", time: "18 min" },
      { title: "Forwarding and Stalling", time: "25 min" },
      { title: "Exception Mechanisms", time: "30 min" }
    ]
  },
  "10": {
    title: "Memory Hierarchy and Direct Mapped Caches",
    description: "Memory hierarchy, cache organization, direct mapped cache design.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Memory Hierarchy Principles", time: "20 min" },
      { title: "Cache Organization Basics", time: "18 min" },
      { title: "Direct Mapped Cache Design", time: "22 min" },
      { title: "Cache Performance Metrics", time: "25 min" }
    ],
    videos: [
      { title: "Memory Hierarchy Overview", time: "15 min" },
      { title: "Cache Fundamentals", time: "18 min" },
      { title: "Direct Mapped Implementation", time: "25 min" },
      { title: "Cache Performance Analysis", time: "30 min" }
    ]
  },
  "11": {
    title: "Associative Caches",
    description: "Fully associative, set-associative caches, replacement policies.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Fully Associative Caches", time: "20 min" },
      { title: "Set-Associative Cache Design", time: "18 min" },
      { title: "Replacement Policies (LRU, FIFO)", time: "22 min" },
      { title: "Cache Performance Optimization", time: "25 min" }
    ],
    videos: [
      { title: "Associative Cache Concepts", time: "15 min" },
      { title: "Set-Associative Implementation", time: "18 min" },
      { title: "Replacement Algorithms", time: "25 min" },
      { title: "Cache Optimization Techniques", time: "30 min" }
    ]
  },
  "12": {
    title: "Virtual Memory",
    description: "Virtual addresses, page tables, TLB, memory protection.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Virtual Memory Concepts", time: "20 min" },
      { title: "Page Table Organization", time: "18 min" },
      { title: "Translation Lookaside Buffer (TLB)", time: "22 min" },
      { title: "Memory Protection and Sharing", time: "25 min" }
    ],
    videos: [
      { title: "Virtual Memory Overview", time: "15 min" },
      { title: "Address Translation", time: "18 min" },
      { title: "TLB Design and Operation", time: "25 min" },
      { title: "Memory Management", time: "30 min" }
    ]
  },
  "13": {
    title: "Parallel Processors",
    description: "Parallelism, multiprocessors, shared memory, synchronization.",
    mastery: "0%",
    progress: "0%",
    readings: [
      { title: "Parallel Processing Fundamentals", time: "20 min" },
      { title: "Multiprocessor Architectures", time: "18 min" },
      { title: "Shared Memory Systems", time: "22 min" },
      { title: "Synchronization Mechanisms", time: "25 min" }
    ],
    videos: [
      { title: "Introduction to Parallelism", time: "15 min" },
      { title: "Multiprocessor Design", time: "18 min" },
      { title: "Shared Memory Consistency", time: "25 min" },
      { title: "Synchronization Primitives", time: "30 min" }
    ]
  }
};

export async function generateStaticParams() {
  return Object.keys(moduleData).map((id) => ({
    id,
  }));
}


export default async function ModuleDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const module = moduleData[id] || moduleData["1"];
  const progressNum = parseInt(module.progress.replace("%", ""));

  return (
    <div className="min-h-screen bg-white">
      <ModuleHeader moduleId={id} />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Back to Modules */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-black mb-6 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Modules</span>
        </Link>

        {/* Module Title and Description */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-black mb-2">Module {id}: {module.title}</h2>
            <p className="text-gray-600 text-lg">{module.description}</p>
          </div>
          <div className="ml-6">
            <span className="bg-[#800020] text-white px-6 py-2 rounded-full text-sm font-semibold">
              {module.mastery} Mastery
            </span>
          </div>
        </div>

        {/* Module Progress */}
        <div className="flex items-center gap-4 mb-8">
          <span className="font-semibold text-black text-sm">Module Progress</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div className="bg-[#800020] h-2 rounded-full" style={{ width: module.progress }}></div>
          </div>
          <span className="text-black font-semibold">{module.progress}</span>
        </div>

        <ModuleTabs moduleId={id} module={module} activeTab="content" />
      </main>
    </div>
  );
}
