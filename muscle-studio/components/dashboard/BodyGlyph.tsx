/**
 * Decorative silhouette icon for male/female shortcuts. Purely an interface
 * glyph — it is never presented as anatomical content.
 */
export function BodyGlyph({ gender, className }: { gender: "male" | "female"; className?: string }) {
  const shoulders = gender === "male" ? 15 : 12.5;
  const hips = gender === "male" ? 10 : 12;
  return (
    <svg viewBox="0 0 40 80" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="20" cy="9" r="6" />
      <path
        d={`M${20 - shoulders} 20 Q20 16 ${20 + shoulders} 20 L${20 + hips - 1} 44 Q20 47 ${20 - hips + 1} 44 Z`}
        opacity="0.9"
      />
      <path d={`M${20 - shoulders} 21 l-3 22 l3 1 l4-20 Z M${20 + shoulders} 21 l3 22 l-3 1 l-4-20 Z`} opacity="0.75" />
      <path d={`M${20 - hips + 1} 45 l1 31 h5 l2-29 Z M${20 + hips - 1} 45 l-1 31 h-5 l-2-29 Z`} opacity="0.85" />
    </svg>
  );
}
