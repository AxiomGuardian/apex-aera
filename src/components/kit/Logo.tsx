import Link from "next/link";
import { cn } from "@/lib/utils";

const LETTERS = ["K", "I", "T"] as const;

const SIZES = {
  nav: {
    letter: "text-[1.05rem] sm:text-[1.12rem]",
    gap: "gap-2.5",
    dot: "mt-[5px] h-[3px] w-[3px]",
  },
  hero: {
    letter: "text-[4.25rem] sm:text-[6.5rem] lg:text-[7.25rem]",
    gap: "gap-5 sm:gap-10",
    dot: "mt-3 sm:mt-4 h-1.5 w-1.5 sm:h-2 sm:w-2",
  },
  footer: {
    letter: "text-[0.95rem]",
    gap: "gap-2",
    dot: "mt-1 h-[3px] w-[3px]",
  },
} as const;

export function KitLogo({
  size = "nav",
  href = "/kit",
  className,
}: {
  size?: keyof typeof SIZES;
  href?: string | null;
  className?: string;
}) {
  const s = SIZES[size];
  const mark = (
    <span
      className={cn("kit-mark inline-flex items-start", s.gap, className)}
      aria-label="K.I.T."
    >
      {LETTERS.map((letter) => (
        <span key={letter} className="inline-flex flex-col items-center">
          <span className={cn("leading-none", s.letter)}>{letter}</span>
          <span
            className={cn("rounded-full bg-[#D4AF37]", s.dot)}
            aria-hidden
          />
        </span>
      ))}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="K.I.T. home">
      {mark}
    </Link>
  );
}
