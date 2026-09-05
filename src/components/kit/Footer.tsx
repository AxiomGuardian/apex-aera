import Link from "next/link";
import { KIT, KIT_NAV, KIT_VERSES } from "@/lib/kit/constants";
import { KitLogo } from "@/components/kit/Logo";

export function KitFooter() {
  return (
    <footer className="kit-content relative border-t border-[rgba(212,175,55,0.18)] bg-[#07090D]">
      <div className="mx-auto grid max-w-[1120px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <KitLogo size="footer" />
          <p className="mt-5 max-w-sm text-[0.95rem] leading-relaxed text-[#A8B0C0]">
            K.I.T. exists to help believers walk with Christ daily and to help
            churches disciple their people with order — in a distracted world.
          </p>
          <p className="mt-4 text-sm text-[#A8B0C0]">
            Built in public. Still in development.
          </p>
          <a
            href={KIT.journey}
            className="mt-2 inline-block text-sm text-[#D4AF37] underline-offset-4 hover:underline"
          >
            Field notes at isaacoriginals.com/kit
          </a>
        </div>

        <div className="lg:col-span-3">
          <p className="kit-overline mb-4">Navigate</p>
          <ul className="space-y-2">
            {KIT_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[#A8B0C0] transition-colors hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <p className="kit-overline mb-4">Held to</p>
          <ul className="space-y-4">
            {KIT_VERSES.slice(0, 2).map((v) => (
              <li key={v.ref}>
                <p className="text-sm leading-relaxed text-[#F4F1E8]">“{v.text}”</p>
                <p className="mt-1 text-xs tracking-wide text-[#A8B0C0]">{v.ref}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[rgba(212,175,55,0.12)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-5 py-5 text-xs text-[#7C8596] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {KIT.year} {KIT.name}. Stewarded, not celebrated.
          </p>
          <p>Every tool points back to the local church.</p>
        </div>
      </div>
    </footer>
  );
}
