import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </BaseIcon>
  );
}

export function NewProjectIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </BaseIcon>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7.5h16" />
      <path d="M4 12h16" />
      <path d="M4 16.5h10" />
      <path d="M7 4v16" />
    </BaseIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 10.5 12 4l7.5 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </BaseIcon>
  );
}

export function LabsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 4v5l-5 8a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 17l-5-8V4" />
      <path d="M8 4h8" />
      <path d="M8.5 13h7" />
    </BaseIcon>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2" />
      <path d="M12 18.3v2.2" />
      <path d="M3.5 12h2.2" />
      <path d="M18.3 12h2.2" />
      <path d="m6 6 1.6 1.6" />
      <path d="m16.4 16.4 1.6 1.6" />
      <path d="m18 6-1.6 1.6" />
      <path d="M7.6 16.4 6 18" />
    </BaseIcon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9.2a2.5 2.5 0 1 1 4.5 1.5c-.6.8-1.7 1.3-2.1 2.3" />
      <path d="M12 17h.01" />
    </BaseIcon>
  );
}

export function DocsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 4h6l4 4v12H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M14 4v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </BaseIcon>
  );
}
