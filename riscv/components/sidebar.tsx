"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DocsIcon,
  HelpIcon,
  HomeIcon,
  LabsIcon,
  LogoutIcon,
  MenuIcon,
  ProfileIcon,
  ProjectsIcon,
  SettingsIcon,
} from "@/components/sidebar-icons";

type SidebarProps = {
  initialOpen?: boolean;
  onOpenProjects?: () => void;
  onLogout?: () => void | Promise<void>;
};

const Sidebar: React.FC<SidebarProps> = ({
  initialOpen = false,
  onOpenProjects,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !asideRef.current) return;
      if (!asideRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  type SidebarItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    href?: string;
  };

  const primaryItems: SidebarItem[] = [
    { id: "home", label: "Home", icon: HomeIcon, href: "/student" },
    { id: "labs", label: "Labs", icon: LabsIcon, href: "/student/labs" },
    {
      id: "projects",
      label: "Personal Projects",
      icon: ProjectsIcon,
      onClick: onOpenProjects,
      href: "/student/projects",
    },
  ];

  const secondaryItems: SidebarItem[] = [
    { id: "profile", label: "Profile", icon: ProfileIcon, href: "/student/profile" },
    { id: "settings", label: "Settings", icon: SettingsIcon, href: "/student/settings" },
    { id: "help-feedback", label: "Help & Feedback", icon: HelpIcon, href: "/student/help" },
    { id: "riscv-docs", label: "RISC-V Documentation", icon: DocsIcon, href: "/student/docs" },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        const { logout } = await import("@/app/logout/frontend");
        await logout();
      }
    } finally {
      window.location.href = "/login";
    }
  };


  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-orange-300/60 bg-[rgb(34,33,34)] text-white shadow-lg shadow-black/30 transition-colors hover:bg-[rgb(59,56,59)] md:hidden"
          aria-label="Open sidebar"
          aria-expanded={isOpen}
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        ref={asideRef}
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-orange-300 bg-[rgb(34,33,34)] text-slate-100 transition-[width,transform] duration-300 ease-out ${
          isOpen ? "w-72 translate-x-0 md:w-64" : "w-72 -translate-x-full md:w-16 md:translate-x-0"
        }`}
        aria-label="Sidebar"
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("button, a")) return;
          setIsOpen((prev) => !prev);
        }}
      >
      {/* menu toggle button*/}
      <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex gap-3 px-4 py-4 border-b border-slate-800 hover:bg-[rgb(59,56,59)] transition-colors"
            aria-expanded={isOpen}
      >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-950 text-white text-lg font-bold">
                <MenuIcon className="h-5 w-5" />
            </div>
            {isOpen && (
            <div className="flex flex-col text-left">
                <span className="text-sm font-semibold tracking-tight">
                RISC-V IDE
                </span>
                <span className="text-[11px] text-slate-400">
                Arizona State University
                </span>
            </div>
            )}
      </button>

      {/* Main nav */}
      <nav className="flex-1  px-2 py-3 space-y-4">
        {/* Primary section */}
        <div>
          {isOpen && (
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Workspaces
            </p>
          )}
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarButton
                key={item.id}
                label={item.label}
                icon={item.icon}
                showTooltipOnCollapse
                isOpen={isOpen}
                href={item.href}
                onClick={() => {
                  if (!item.href) {
                    item.onClick?.();
                  }
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
        </div>

        {/* Secondary section (only when open) */}
        {isOpen && (
          <div>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              General
            </p>
            <div className="space-y-1">
              {secondaryItems.map((item) => (
                <SidebarButton
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  isOpen={isOpen}
                  href={item.href}
                  onClick={() => {
                    if (!item.href) {
                      item.onClick?.();
                    }
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
            isOpen ? "justify-start" : "justify-center"
          } ${
            isLoggingOut
              ? "cursor-not-allowed bg-slate-800 text-slate-500"
              : "text-slate-100 hover:bg-[rgb(59,56,59)]"
          }`}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white">
            <LogoutIcon className="h-4 w-4" />
          </span>
          {isOpen && <span className="truncate">{isLoggingOut ? "Logging out..." : "Log out"}</span>}
        </button>
      </div>

      {/* Footer / version / whatever (optional) */}
      <div className="px-3 py-3 border-t border-slate-800 text-[11px] text-slate-500">
        {isOpen ? (
          <span>Capstone Project Est. 2025</span>
        ) : (
          <span className="block text-center">v0.1</span>
        )}
      </div>
      </aside>
    </>
  );
};

type SidebarButtonProps = {
  label: string;
  isOpen: boolean;
  icon: React.ComponentType<{ className?: string }>;
  showTooltipOnCollapse?: boolean; //for the buttons that are always shown when collapsed
  onClick?: () => void;
  href?: string;
};

const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  isOpen,
  icon: Icon,
  showTooltipOnCollapse,
  onClick,
  href,
}) => {
  const content = (
    <>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-300 text-[11px] font-semibold tracking-wide text-slate-200">
        <Icon className="h-4 w-4 text-white" />
      </span>
      {isOpen && <span className="truncate">{label}</span>}
    </>
  );

  return (
    <div className="relative group">
      {href ? (
        <Link
          href={href}
          onClick={onClick}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-100 hover:bg-[rgb(59,56,59)] transition-colors ${
            isOpen ? "justify-start" : "justify-center"
          }`}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-100 hover:bg-[rgb(59,56,59)] transition-colors ${
            isOpen ? "justify-start" : "justify-center"
          }`}
        >
          {content}
        </button>
      )}

        {!isOpen && showTooltipOnCollapse && (
        <div
          className="
            pointer-events-none
            absolute left-full top-1/2 -translate-y-1/2 ml-4
            hidden group-hover:flex
            items-center
            rounded-lg bg-black px-3 py-1
            text-xs text-slate-100 shadow-lg whitespace-nowrap
            z-50
          "
        >
          {label}

        </div>
      )}
    </div>

  );
};

export default Sidebar;
