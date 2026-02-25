'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { LogOut, UserCircle } from 'lucide-react';
import { useState } from 'react';

import PerformanceInsights from "./PerformanceInsights";  //new

export function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modules" | "review">("modules");

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Concepts data by module
  const moduleConcepts = {
    1: {
      title: "Introduction to Computer Architecture",
      concepts: [
        "Computer Abstraction and Technology",
        "Performance Metrics (CPI, Clock Rate)",
        "Instruction Set Principles",
        "MIPS Architecture Basics"
      ],
      progress: 100
    },
    2: {
      title: "MIPS Introduction, ALU and Data Transfer",
      concepts: [
        "MIPS Register File and Conventions",
        "Arithmetic and Logical Operations",
        "Load and Store Instructions",
        "Memory Addressing Modes"
      ],
      progress: 100
    },
    3: {
      title: "Branch Instructions and Machine Code",
      concepts: [
        "Conditional Branch Instructions",
        "Jump and Jump Register",
        "MIPS Instruction Encoding",
        "Machine Code Format"
      ],
      progress: 50
    }
  };

  const coveredConcepts: string[] = [];
  const missedConcepts: string[] = [];

  Object.entries(moduleConcepts).forEach(([id, module]) => {
    if (module.progress === 100) {
      coveredConcepts.push(...module.concepts);
    } else if (module.progress > 0 && module.progress < 100) {
      const coveredCount = Math.ceil((module.progress / 100) * module.concepts.length);
      coveredConcepts.push(...module.concepts.slice(0, coveredCount));
      missedConcepts.push(...module.concepts.slice(coveredCount));
    } else {
      missedConcepts.push(...module.concepts);
    }
  });

  const lockedModuleConcepts = [
    "Function Call Mechanism", "Stack Frame Structure", "Register Conventions", "Procedure Linkage",
    "Object File Format", "Static Linking Process", "Dynamic Linking", "MIPS Instruction Set Reference",
    "Integer Addition and Subtraction", "Integer Multiplication and Division", "Floating Point Representation", "Floating Point Operations",
    "Single Cycle Datapath Design", "Control Unit Implementation", "Instruction Execution Flow", "Performance Limitations",
    "Multicycle Datapath Design", "Finite State Machine Control", "Instruction Execution States", "Performance Analysis",
    "Pipeline Stages and Structure", "Data Hazards and Forwarding", "Control Hazards and Branch Prediction", "Exception Handling in Pipelines",
    "Memory Hierarchy Principles", "Cache Organization Basics", "Direct Mapped Cache Design", "Cache Performance Metrics",
    "Fully Associative Caches", "Set-Associative Cache Design", "Replacement Policies (LRU, FIFO)", "Cache Performance Optimization",
    "Virtual Memory Concepts", "Page Table Organization", "Translation Lookaside Buffer (TLB)", "Memory Protection and Sharing",
    "Parallel Processing Fundamentals", "Multiprocessor Architectures", "Shared Memory Systems", "Synchronization Mechanisms"
  ];
  missedConcepts.push(...lockedModuleConcepts);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#800020] px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
              <span className="text-[#800020] font-bold text-lg">CSE</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CSE 230 Computer Systems</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Button variant="outline" onClick={handleLogout} className="bg-transparent border-white text-white hover:bg-white hover:text-[#800020]">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name ?? user?.email ?? 'Student'}!
          </h2>
          <p className="text-gray-600">Continue your mastery-based learning journey</p>
        </div>

        {/* Key Metrics - Horizontal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Modules Completed */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Modules Completed</p>
              <p className="text-3xl font-bold text-gray-900">2/10</p>
            </div>
            <div className="text-[#800020]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>

          {/* Overall Mastery */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Overall Mastery</p>
              <p className="text-3xl font-bold text-gray-900">90%</p>
            </div>
            <div className="text-yellow-500">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>

          {/* Time on Task */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Time on Task</p>
              <p className="text-3xl font-bold text-gray-900">12.5h</p>
            </div>
            <div className="text-[#800020]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Achievements</p>
              <p className="text-3xl font-bold text-gray-900">5</p>
            </div>
            <div className="text-yellow-500">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 border-b border-gray-300 mb-6">
          <button
            onClick={() => setActiveTab("modules")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "modules"
                ? "text-gray-900 border-b-2 border-[#800020]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Learning Modules
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "review"
                ? "text-gray-900 border-b-2 border-[#800020]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Review
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === "modules" ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Core Modules</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Module 1 */}
              <Link href="/module/1" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Module 1: Introduction to Computer Architecture</h3>
                <p className="text-gray-600 text-sm mb-4">Abstraction layers, performance metrics, instruction sets, MIPS basics</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">Progress</span>
                    <span className="text-gray-900 font-medium">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#800020] h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700 text-sm">Mastery Score</span>
                  <span className="bg-[#800020] text-white px-4 py-1 rounded-full text-sm font-semibold">92%</span>
                </div>
              </Link>

              {/* Module 2 */}
              <Link href="/module/2" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Module 2: MIPS Introduction, ALU and Data Transfer</h3>
                <p className="text-gray-600 text-sm mb-4">MIPS registers, arithmetic operations, load/store instructions, memory addressing</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">Progress</span>
                    <span className="text-gray-900 font-medium">100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#800020] h-2 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700 text-sm">Mastery Score</span>
                  <span className="bg-[#800020] text-white px-4 py-1 rounded-full text-sm font-semibold">88%</span>
                </div>
              </Link>

              {/* Module 3 */}
              <Link href="/module/3" className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Module 3: Branch Instructions and Machine Code</h3>
                <p className="text-gray-600 text-sm mb-4">Conditional branching, jump instructions, encoding MIPS to machine code</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">Progress</span>
                    <span className="text-gray-900 font-medium">50%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-[#800020] h-2 rounded-full" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </Link>

              {/* Module 4 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 4: Procedure Execution</h3>
                <p className="text-gray-400 text-sm mb-4">Function calls, stack frames, register conventions, procedure linkage</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 5 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 5: Linking, Loading and MIPS Summary</h3>
                <p className="text-gray-400 text-sm mb-4">Object files, linking process, loaders, MIPS instruction set summary</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 6 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 6: Arithmetic For Computers</h3>
                <p className="text-gray-400 text-sm mb-4">Integer arithmetic, floating point representation, arithmetic operations</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 7 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 7: Single Cycle Implementation</h3>
                <p className="text-gray-400 text-sm mb-4">Single cycle datapath, control unit design, instruction execution</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 8 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 8: Multicycle Implementation</h3>
                <p className="text-gray-400 text-sm mb-4">Multicycle datapath, finite state machine control, performance tradeoffs</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 9 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 9: Pipeline Implementation and Exception Handling</h3>
                <p className="text-gray-400 text-sm mb-4">Pipeline stages, hazards, forwarding, exception handling</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 10 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 10: Memory Hierarchy and Direct Mapped Caches</h3>
                <p className="text-gray-400 text-sm mb-4">Memory hierarchy, cache organization, direct mapped cache design</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 11 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 11: Associative Caches</h3>
                <p className="text-gray-400 text-sm mb-4">Fully associative, set-associative caches, replacement policies</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 12 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 12: Virtual Memory</h3>
                <p className="text-gray-400 text-sm mb-4">Virtual addresses, page tables, TLB, memory protection</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>

              {/* Module 13 - Locked */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 relative opacity-60 cursor-not-allowed">
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-500 mb-2">Module 13: Parallel Processors</h3>
                <p className="text-gray-400 text-sm mb-4">Parallelism, multiprocessors, shared memory, synchronization</p>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-400">Progress</span>
                    <span className="text-gray-400 font-medium">Locked</span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review: Concepts Summary</h2>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Total Concepts Covered</p>
                <p className="text-3xl font-bold text-[#800020]">{coveredConcepts.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Concepts to Review</p>
                <p className="text-3xl font-bold text-orange-600">{missedConcepts.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round((coveredConcepts.length / (coveredConcepts.length + missedConcepts.length)) * 100)}%
                </p>
              </div>
            </div>

            {/* Concepts Covered Section */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-black">Concepts Covered</h3>
                <span className="ml-auto text-sm text-gray-600">{coveredConcepts.length} concepts mastered</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coveredConcepts.map((concept, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-900 font-medium">{concept}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Concepts Missed Section */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-semibold text-black">Concepts to Review</h3>
                <span className="ml-auto text-sm text-gray-600">{missedConcepts.length} concepts need attention</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {missedConcepts.length > 0 ? (
                  missedConcepts.map((concept, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <svg className="w-5 h-5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-900 font-medium">{concept}</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <p>Great job! You've covered all available concepts so far.</p>
                    <p className="text-sm mt-2">Complete more modules to unlock additional concepts.</p>
                  </div>
                )}
              </div>
            </div>
            <PerformanceInsights />
        </div>
        )}
      </main>
    </div>
  );
}
