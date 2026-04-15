"use client";

import React, { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./hooks/useAuth";

/**
 * All possible "screens" on the login page.
 */
type View =
  | "welcome"                // Sign Up / Sign In choice
  | "signin-role"            // choose Student / Professor
  | "signin-student"         // student login form
  | "signin-professor"       // professor login form
  | "signup-role"            // create account: choose Student / Professor
  | "signup-professor-form"  // professor signup form (with key)
  | "signup-student-journey" // pick CS / Cyber
  | "signup-student-track"   // pick track (MIPS/RISC-V/x86)
  | "signup-student-form";   // student signup form

type UserRole = "student" | "staff";
type StudentJourney = "cs" | "cybersecurity" | null;
type StudentTrack = "mips" | "riscv" | "x86" | null;

// Hard-coded professor key for the demo.
// Change this string to whatever your professor key should be.
const PROFESSOR_KEY = "PROF2024";

// Colors and spacing to keep things consistent
const colors = {
  background: "#f7efe6",
  cardBackground: "#ffffff",
  maroon: "#7b1432",
  maroonHover: "#91173b",
  border: "#d8c9b4",
  inputBackground: "#f7efe6",
  text: "#3b3b3b",
  subtle: "#777777",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  padding: 0,
  backgroundColor: colors.background,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "420px",
  maxWidth: "90vw",
  backgroundColor: colors.cardBackground,
  borderRadius: "16px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
  padding: "28px 32px 32px",
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: colors.maroon,
  textAlign: "center",
  marginBottom: "4px",
};

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: colors.text,
  textAlign: "center",
  marginBottom: "24px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: colors.text,
  marginBottom: "4px",
};

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: colors.subtle,
  marginBottom: "20px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: colors.text,
  marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.inputBackground,
  fontSize: "14px",
  color: colors.text,
  outline: "none",
};


const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: colors.maroon,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "18px",
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.maroon}`,
  backgroundColor: "white",
  color: colors.maroon,
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "12px",
};

const subtleLinkStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  margin: 0,
  color: colors.maroon,
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
};

const footerTextStyle: React.CSSProperties = {
  marginTop: "16px",
  fontSize: "13px",
  color: colors.subtle,
  textAlign: "center",
};

/**
 * Main Login Page Component
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, register, user, isAuthenticated } = useAuth();

  const [view, setView] = useState<View>("welcome");
  const [role, setRole] = useState<UserRole>("student");
  const [studentJourney, setStudentJourney] = useState<StudentJourney>(null);
  const [studentTrack, setStudentTrack] = useState<StudentTrack>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<string>("");

  // Shared auth state (email, password, name, etc.)
  const [email, setEmail] = useState("");
  const [asuId, setAsuId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [professorKey, setProfessorKey] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect after successful login/register based on user role
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "staff") {
        router.push('/login/teacher');
      } else {
        router.push('/login/student');
      }
    }
  }, [user, isAuthenticated, router]);

  // -------------------------------
  // Handlers for each form
  // -------------------------------

  const handleStudentSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter email and password.");
      setIsLoading(false);
      return;
    }

    const result = await login(email, password, { role: "student" });
    if (!result.success) {
      setError(result.error || "Login failed.");
      setIsLoading(false);
    }
    // Redirect is handled by useEffect
  };

  const handleProfessorSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter email and password.");
      setIsLoading(false);
      return;
    }

    const result = await login(email, password, { role: "staff" });
    if (!result.success) {
      setError(result.error || "Login failed.");
      setIsLoading(false);
    }
    // Redirect is handled by useEffect
  };

  const handleProfessorSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (professorKey !== PROFESSOR_KEY) {
      setError("Invalid professor key.");
      setIsLoading(false);
      return;
    }

    if (!email || !asuId || !password || !confirmPassword || !name) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (!/^\d{10}$/.test(String(asuId).trim())) {
      setError("ASU ID must be a 10-digit number.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    const result = await register(name, email, asuId, password, "staff");
    if (!result.success) {
      setError(result.error || "Registration failed.");
      setIsLoading(false);
    }
    // Redirect is handled by useEffect
  };

  const handleStudentSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!studentJourney) {
      setError("Please select Computer Science or Cybersecurity.");
      setIsLoading(false);
      return;
    }

    if (!studentTrack) {
      setError("Please select a track.");
      setIsLoading(false);
      return;
    }

    if (!selectedProfessor) {
      setError("Please select a professor.");
      setIsLoading(false);
      return;
    }

    if (!email || !asuId || !password || !confirmPassword || !name) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (!/^\d{10}$/.test(String(asuId).trim())) {
      setError("ASU ID must be a 10-digit number.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    const result = await register(name, email, asuId, password, "student", {
      professorName: selectedProfessor,
      studentJourney,
      studentTrack,
    });
    if (!result.success) {
      setError(result.error || "Registration failed.");
      setIsLoading(false);
    }
    // Redirect is handled by useEffect
  };

  // Reset common fields when switching high-level flows
  const resetForm = () => {
    setEmail("");
    setAsuId("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setProfessorKey("");
    setSelectedProfessor("");
    setError("");
    // Don't reset studentJourney and studentTrack when just clearing form fields
  };

  // Reset everything including journey/track
  const resetAll = () => {
    resetForm();
    setStudentJourney(null);
    setStudentTrack(null);
  };

  // -------------------------------
  // Render helpers
  // -------------------------------

  const renderHeader = () => (
    <>
      {/* Little cap icon using plain text (you could swap for <img> if you have an SVG) */}
      <div style={{ textAlign: "center", marginBottom: "8px", fontSize: "30px" }}>
        🎓
      </div>

      <div style={headerTitleStyle}>Arizona State University</div>
      <div style={headerSubtitleStyle}>
        CSE 230: Computer Org/Assembl Lang Prog
      </div>
    </>
  );

  const renderWelcome = () => (
    <>
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px", color: colors.text }}>
          Welcome
        </div>
        <div style={{ fontSize: "14px", color: colors.subtle }}>
          Choose an option to continue
        </div>
      </div>

      <button
        type="button"
        style={primaryButtonStyle}
        onClick={() => {
          resetAll();
          setView("signup-role");
        }}
      >
        Sign Up
      </button>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          resetAll();
          setView("signin-role");
        }}
      >
        Sign In
      </button>
    </>
  );

  const renderSignInRole = () => (
    <>
      <div style={sectionTitleStyle}>Sign In</div>
      <div style={sectionSubtitleStyle}>Select your role to continue</div>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          resetAll();
          setRole("student");
          setView("signin-student");
        }}
      >
        Student
      </button>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          resetAll();
          setRole("staff");
          setView("signin-professor");
        }}
      >
        Staff (Professor / TA)
      </button>

      <div style={footerTextStyle}>
        Don&apos;t have an account?{" "}
        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetAll();
            setView("signup-role");
          }}
        >
          Sign up
        </button>
      </div>
    </>
  );

  const renderSignInForm = (currentRole: UserRole) => {
    const isStudent = currentRole === "student";

    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={sectionTitleStyle}>
              Sign in as {isStudent ? "Student" : "Staff"}
            </div>
            <div style={sectionSubtitleStyle}>
              Enter your credentials to continue
            </div>
          </div>

          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              resetAll();
              setView("signin-role");
            }}
          >
            Change
          </button>
        </div>

        {error && (
          <div style={{
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#fee",
            color: "#c00",
            fontSize: "14px",
            marginBottom: "14px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={isStudent ? handleStudentSignIn : handleProfessorSignIn}>
          <div style={{ marginBottom: "14px" }}>
            <div style={fieldLabelStyle}>ASU Email</div>
            <input
              type="email"
              placeholder="asurite@asu.edu"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: "4px" }}>
            <div style={fieldLabelStyle}>Password</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            style={{
              ...primaryButtonStyle,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }} 
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={footerTextStyle}>
          Don&apos;t have an account?{" "}
          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              resetAll();
              setView("signup-role");
            }}
          >
            Sign up
          </button>
        </div>
      </>
    );
  };

  const renderSignupRole = () => (
    <>
      <div style={sectionTitleStyle}>Create an account</div>
      <div style={sectionSubtitleStyle}>
        Enter your information to create your account
      </div>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          resetAll();
          setRole("student");
          setView("signup-student-journey");
        }}
      >
        Student
      </button>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          resetAll();
          setRole("staff");
          setView("signup-professor-form");
        }}
      >
        Staff (Professor / TA)
      </button>

      <div style={footerTextStyle}>
        Already have an account?{" "}
        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetAll();
            setView("signin-role");
          }}
        >
          Sign in
        </button>
      </div>
    </>
  );

  const renderProfessorSignupForm = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={sectionTitleStyle}>Create an account</div>
          <div style={sectionSubtitleStyle}>
            Enter your information to create your account
          </div>
        </div>

        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetForm();
            setView("signup-role");
          }}
        >
          Change
        </button>
      </div>

      {/* role badge */}
      <div
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          backgroundColor: "#fde7e9",
          fontSize: "14px",
          marginBottom: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: colors.text }}>Staff (Professor / TA)</span>
      </div>

      {error && (
        <div style={{
          padding: "10px 12px",
          borderRadius: "8px",
          backgroundColor: "#fee",
          color: "#c00",
          fontSize: "14px",
          marginBottom: "14px",
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleProfessorSignup}>
        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>Professor Key</div>
          <input
            type="text"
            placeholder="Enter professor key"
            value={professorKey}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setProfessorKey(e.target.value)
            }
            style={inputStyle}
            disabled={isLoading}
          />
          <div style={{ fontSize: "12px", color: colors.subtle, marginTop: "4px" }}>
            Contact your administrator for the professor key.
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>Name</div>
          <input
            type="text"
            placeholder="First Last"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>ASU Email</div>
          <input
            type="email"
            placeholder="asurite@asu.edu"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>ASU ID (10-digit)</div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ASU ID (10 digits)"
            value={asuId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAsuId(e.target.value)}
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>Password</div>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: "4px" }}>
          <div style={fieldLabelStyle}>Confirm Password</div>
          <input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

        <button 
          type="submit" 
          style={{
            ...primaryButtonStyle,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }} 
          disabled={isLoading}
        >
          {isLoading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <div style={footerTextStyle}>
        Already have an account?{" "}
        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetAll();
            setView("signin-role");
          }}
        >
          Sign in
        </button>
      </div>
    </>
  );

  const renderStudentJourneyChoice = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={sectionTitleStyle}>Create an account</div>
          <div style={sectionSubtitleStyle}>
            Enter your information to create your account
          </div>
        </div>

        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetAll();
            setView("signup-role");
          }}
        >
          Back
        </button>
      </div>

      <div style={{ marginBottom: "16px", fontSize: "14px", color: colors.text }}>
        Choose Your Journey:
      </div>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          setStudentJourney("cs");
          setStudentTrack(null);
          setView("signup-student-track");
        }}
      >
        Computer Science
      </button>

      <button
        type="button"
        style={secondaryButtonStyle}
        onClick={() => {
          setStudentJourney("cybersecurity");
          setStudentTrack(null);
          setView("signup-student-track");
        }}
      >
        Cybersecurity
      </button>

      <div style={footerTextStyle}>
        Already have an account?{" "}
        <button
          type="button"
          style={subtleLinkStyle}
          onClick={() => {
            resetAll();
            setView("signin-role");
          }}
        >
          Sign in
        </button>
      </div>
    </>
  );

  const renderStudentTrackChoice = () => {
    const isCS = studentJourney === "cs";
    const trackOptions = isCS 
      ? [
          { id: "mips" as StudentTrack, label: "MIPS" },
          { id: "riscv" as StudentTrack, label: "RISC-V" },
        ]
      : [
          { id: "x86" as StudentTrack, label: "x86" },
        ];

    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={sectionTitleStyle}>Create an account</div>
            <div style={sectionSubtitleStyle}>
              Enter your information to create your account
            </div>
          </div>

          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              setStudentTrack(null);
              setView("signup-student-journey");
            }}
          >
            Back
          </button>
        </div>

        <div style={{ marginBottom: "16px", fontSize: "14px", color: colors.text }}>
          Choose Your Track:
        </div>

        {trackOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              setStudentTrack(option.id);
              resetForm();
              setView("signup-student-form");
            }}
          >
            {option.label}
          </button>
        ))}

        <div style={footerTextStyle}>
          Already have an account?{" "}
          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              resetAll();
              setView("signin-role");
            }}
          >
            Sign in
          </button>
        </div>
      </>
    );
  };

  const renderStudentSignupForm = () => {
    const journeyLabel = studentJourney === "cs" ? "Computer Science" : "Cybersecurity";
    const trackLabel = studentTrack === "mips" ? "MIPS" : studentTrack === "riscv" ? "RISC-V" : "x86";
    const fullLabel = `Student – ${journeyLabel} – ${trackLabel}`;

    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={sectionTitleStyle}>Create an account</div>
            <div style={sectionSubtitleStyle}>
              Enter your information to create your account
            </div>
          </div>

          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              setStudentTrack(null);
              setView("signup-student-track");
            }}
          >
            Change
          </button>
        </div>

        {/* role + journey + track badge */}
        <div
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#fde7e9",
            fontSize: "14px",
            marginBottom: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: colors.text,
          }}
        >
          <span style={{ color: colors.text }}>{fullLabel}</span>
        </div>

        {error && (
          <div style={{
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#fee",
            color: "#c00",
            fontSize: "14px",
            marginBottom: "14px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleStudentSignup}>
          <div style={{ marginBottom: "14px" }}>
            <div style={fieldLabelStyle}>Name</div>
            <input
              type="text"
              placeholder="First Last"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div style={fieldLabelStyle}>ASU Email</div>
            <input
              type="email"
              placeholder="asurite@asu.edu"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <div style={fieldLabelStyle}>Professor</div>
            <select
              value={selectedProfessor}
              onChange={(e) => setSelectedProfessor(e.target.value)}
              style={inputStyle}
              disabled={isLoading}
            >
              <option value="">Select a professor</option>
              <option value="Steven Osburn">Steven Osburn</option>
              <option value="Soumya Indela">Soumya Indela</option>
              <option value="Swathi Punathumkandi">Swathi Punathumkandi</option>
            </select>
          </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={fieldLabelStyle}>ASU ID (10-digit)</div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ASU ID (10 digits)"
            value={asuId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAsuId(e.target.value)}
            style={inputStyle}
            disabled={isLoading}
          />
        </div>

          <div style={{ marginBottom: "14px" }}>
            <div style={fieldLabelStyle}>Password</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: "4px" }}>
            <div style={fieldLabelStyle}>Confirm Password</div>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(e.target.value)
              }
              style={inputStyle}
              disabled={isLoading}
            />
          </div>

          <button type="submit" style={primaryButtonStyle} disabled={isLoading}>
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div style={footerTextStyle}>
          Already have an account?{" "}
          <button
            type="button"
            style={subtleLinkStyle}
            onClick={() => {
              resetAll();
              setView("signin-role");
            }}
          >
            Sign in
          </button>
        </div>
      </>
    );
  };

  // -------------------------------
  // MAIN RENDER
  // -------------------------------

  return (
    <>
      <style>{`
        input::placeholder {
          color: ${colors.subtle};
        }
        input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
      <div style={pageStyle}>
        <div style={cardStyle}>
          {renderHeader()}

        {/* Inner content based on current view */}
        {view === "welcome" && renderWelcome()}
        {view === "signin-role" && renderSignInRole()}
        {view === "signin-student" && renderSignInForm("student")}
        {view === "signin-professor" && renderSignInForm("staff")}
        {view === "signup-role" && renderSignupRole()}
        {view === "signup-professor-form" && renderProfessorSignupForm()}
        {view === "signup-student-journey" && renderStudentJourneyChoice()}
        {view === "signup-student-track" && renderStudentTrackChoice()}
        {view === "signup-student-form" && renderStudentSignupForm()}
        </div>
      </div>
    </>
  );
}
