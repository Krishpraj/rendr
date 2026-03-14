export function CubeLogo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Back face */}
      <path
        d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2Z"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Middle horizontal line */}
      <path
        d="M2 7.5L12 13L22 7.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Vertical center line */}
      <path
        d="M12 13V22"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  )
}
