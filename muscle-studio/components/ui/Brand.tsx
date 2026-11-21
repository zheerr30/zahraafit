import Link from "next/link";
import { LogoMark } from "./icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="MUSCLE STUDIO 3D — اللوحة الرئيسية">
      <LogoMark size={compact ? 26 : 30} />
      {!compact && (
        <span dir="ltr" className="text-[13px] font-semibold tracking-[0.18em] text-fg">
          MUSCLE STUDIO <span className="text-accent">3D</span>
        </span>
      )}
    </Link>
  );
}
