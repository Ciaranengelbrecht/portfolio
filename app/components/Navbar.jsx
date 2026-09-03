"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resumeHref } from "../data/portfolio";

const links = [
  { label: "Experience", href: "#experience" },
  { label: "Capabilities", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#302f2b] bg-[#10110f]">
      <nav className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 sm:h-24 sm:px-8 lg:px-10" aria-label="Primary navigation">
        <Link href="#home" className="group flex items-baseline gap-3" onClick={() => setOpen(false)}>
          <span className="font-editorial text-2xl leading-none text-[#f1eee7]">CE</span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#8f8c85] transition-colors group-hover:text-[#c9c5bd] sm:block">
            ICT portfolio
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-[#b2afa8] transition-colors hover:text-[#f1eee7]">
              {link.label}
            </Link>
          ))}
          <Link href={resumeHref} target="_blank" rel="noopener noreferrer" className="editorial-button min-h-10 px-4 py-2">
            CV
          </Link>
        </div>

        <button
          type="button"
          className="relative grid h-11 w-11 place-items-center border border-[#45433e] text-[#f1eee7] lg:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="mobile-navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="relative h-4 w-5" aria-hidden="true">
            <span className={`absolute left-0 top-0 h-px w-5 bg-current transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`absolute left-0 top-[7px] h-px w-5 bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`absolute bottom-0 left-0 h-px w-5 bg-current transition-transform ${open ? "-translate-y-[8px] -rotate-45" : ""}`} />
          </span>
        </button>
      </nav>

      {open && (
        <div id="mobile-navigation" className="mobile-menu absolute inset-x-0 top-full border-b border-[#34332f] bg-[#10110f] px-5 pb-7 pt-3 lg:hidden">
          <div className="mx-auto flex max-w-[1160px] flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-[#2c2c28] py-4 font-editorial text-2xl text-[#d8d4cc]"
              >
                {link.label}
              </Link>
            ))}
            <Link href={resumeHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="editorial-button editorial-button-primary mt-5">
              Download CV
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
