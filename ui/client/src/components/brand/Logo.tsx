import { cn } from "@/lib/utils";

/**
 * Custom mark for the Copilot Issue Console.
 *
 * Concept: an open issue glyph (the circle, drawn as an outline) handed off
 * to an agent (the chevron pointing right). Monochromatic — uses currentColor
 * so it inherits text color across themes. Pairs with a wordmark in larger
 * compositions, but works alone at 16-24px.
 */
export function Logo({
  className,
  withWordmark = false,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-mono", className)}
      data-testid="brand-logo"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        aria-label="Copilot Issue Console"
        className="shrink-0"
      >
        <rect
          x="0.75"
          y="0.75"
          width="30.5"
          height="30.5"
          rx="6.5"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />
        <circle
          cx="11"
          cy="16"
          r="3.5"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M18 11 L24 16 L18 21"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark && (
        <span className="text-sm font-semibold tracking-tight font-sans">
          Copilot Issue Console
        </span>
      )}
    </span>
  );
}
