"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import MenuOverlay from "./MenuOverlay";
import NavLink from "./NavLink";

const navLinks = [
  { title: "Home", path: "#home" },
  { title: "About", path: "#about" },
  { title: "Skills", path: "#skills" },
  { title: "Projects", path: "#projects" },
  { title: "Contact", path: "#contact" },
];

const Navbar = () => {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      setScrolling(window.scrollY > 40);
      setScrollProgress(maxScroll > 0 ? Math.min((window.scrollY / maxScroll) * 100, 100) : 0);

      const sections = navLinks.map((link) => link.path.substring(1));
      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = navbarOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [navbarOpen]);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 border-b pt-[env(safe-area-inset-top)] transition-all duration-300 ${
        scrolling
          ? "border-white/10 bg-surface-950/86 backdrop-blur-md"
          : "border-transparent bg-surface-950/40"
      }`}
    >
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-accent-400/70"
        initial={{ width: "0%" }}
        animate={{ width: `${scrollProgress}%` }}
        transition={{ duration: 0.1 }}
      />

      <motion.nav
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className="container mx-auto flex items-center justify-between px-4 py-2.5 md:px-8 md:py-3"
      >
        <Link href="/" className="group z-50 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-400/30 bg-accent-400/10 text-sm font-semibold text-accent-100 transition-colors duration-200 group-hover:border-accent-300/60">
            CE
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase text-primary-400">Portfolio</p>
            <p className="text-sm font-semibold text-white">Ciaran Engelbrecht</p>
          </div>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-surface-850/70 p-1 backdrop-blur-xl">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                href={link.path}
                title={link.title}
                isActive={activeSection === link.path.substring(1)}
              />
            ))}
          </div>

          <Link
            href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
            target="_blank"
            className="ops-button-secondary"
          >
            Resume
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </Link>
        </div>

        <button
          onClick={() => setNavbarOpen(!navbarOpen)}
          className="z-50 flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-surface-850 text-white transition-colors md:hidden"
          aria-label="Toggle navigation menu"
        >
          <div className="relative h-5 w-5">
            <motion.span
              animate={{ rotate: navbarOpen ? 45 : 0, y: navbarOpen ? 0 : -6 }}
              className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-current"
            />
            <motion.span
              animate={{ opacity: navbarOpen ? 0 : 1, x: navbarOpen ? -8 : 0 }}
              className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-current"
            />
            <motion.span
              animate={{ rotate: navbarOpen ? -45 : 0, y: navbarOpen ? 0 : 6 }}
              className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-current"
            />
          </div>
        </button>

        <AnimatePresence>
          {navbarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-surface-950/98 backdrop-blur-md md:hidden"
            >
              <MenuOverlay
                links={navLinks}
                setNavbarOpen={setNavbarOpen}
                activeSection={activeSection}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </header>
  );
};

export default Navbar;
