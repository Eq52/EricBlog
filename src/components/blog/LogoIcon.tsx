interface LogoIconProps {
  className?: string
}

export default function LogoIcon({ className = 'h-8 w-8' }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 30 30"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Eric Blog"
    >
      {/* Rounded square background */}
      <rect x="1" y="1" width="28" height="28" rx="6" ry="6" fill="#18181b" />
      {/* Letter E */}
      <g fill="#fafafa">
        <rect x="8" y="7" width="2.2" height="16" rx="0.8" />
        <rect x="8" y="7" width="10" height="2.2" rx="0.8" />
        <rect x="8" y="13.9" width="8" height="2.2" rx="0.8" />
        <rect x="8" y="20.8" width="12" height="2.2" rx="0.8" />
      </g>
      {/* Decorative dot */}
      <circle cx="23" cy="7" r="1.5" fill="#52525b" />
    </svg>
  )
}
