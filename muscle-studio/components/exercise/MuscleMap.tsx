import { MAP_OVERLAYS } from "@/data/exercises/maps";
import { cn } from "@/components/ui/cn";

/**
 * Muscle map of an exercise: the 3D model itself, front and back, with the
 * prime movers highlighted and the helpers in a lighter tint. The images are
 * rendered from the application's own model (pipeline/exercises/maps.py), one
 * transparent overlay per muscle group, and composited here — so every
 * exercise, including ones added later, gets its picture from the anatomy.
 */
const BASE = "/exercise-maps";

function Figure({ view, primary, secondary }: { view: "front" | "back"; primary: string[]; secondary: string[] }) {
  const has = (g: string) => MAP_OVERLAYS.has(`${g}-${view}`);
  return (
    <span className="relative block aspect-[5/11] flex-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE}/base-${view}.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      {secondary.filter((g) => has(g) && !primary.includes(g)).map((g) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={g} src={`${BASE}/${g}-${view}.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-50" />
      ))}
      {primary.filter(has).map((g) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={g} src={`${BASE}/${g}-${view}.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ))}
    </span>
  );
}

export function MuscleMap({ primary, secondary, className, label }: { primary: string[]; secondary: string[]; className?: string; label: string }) {
  return (
    <span role="img" aria-label={label} className={cn("flex overflow-hidden rounded-lg bg-[#131416]", className)}>
      <Figure view="front" primary={primary} secondary={secondary} />
      <Figure view="back" primary={primary} secondary={secondary} />
    </span>
  );
}
