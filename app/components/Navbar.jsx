"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import NavLink from "./NavLink";
import MenuOverlay from "./MenuOverlay";

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolling(window.scrollY > 50);
      
      // Track active section
      const sections = navLinks.map(link => link.path.substring(1));
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

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (navbarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [navbarOpen]);

  return (
    <header
      className={`fixed w-full top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolling
          ? "backdrop-blur-xl bg-surface-900/80 border-b border-white/5 shadow-2xl shadow-black/20"
          : "bg-transparent"
      }`}
    >
      {/* Progress indicator */}
      <motion.div
        className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-primary-500 to-accent-500"
        initial={{ width: "0%" }}
        animate={{
          width: scrolling ? `${Math.min((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100, 100)}%` : "0%",
        }}
        transition={{ duration: 0.1 }}
      />

      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="container mx-auto py-3 sm:py-4 px-4 md:px-8 flex items-center justify-between"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 z-50 group">
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300"
          >
            <span className="text-base sm:text-lg font-bold text-white">CE</span>
          </motion.div>
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: scrolling ? 0 : 1, x: scrolling ? -10 : 0 }}
            className="hidden sm:block text-lg font-semibold text-white"
          >
            Ciaran
          </motion.span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <div className="flex items-center gap-1 p-1.5 rounded-full glass border border-white/10">
            {navLinks.map((link, index) => (
              <NavLink
                key={index}
                href={link.path}
                title={link.title}
                isActive={activeSection === link.path.substring(1)}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="ml-4"
          >
            <Link
              href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
              target="_blank"
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white text-sm font-medium transition-all duration-300 shadow-glow-sm hover:shadow-glow overflow-hidden"
            >
              <span className="relative z-10">Resume</span>
              <svg className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.5 }}
              />
            </Link>
          </motion.div>
        </div>

        {/* Mobile Menu Button */}
        <motion.button
          onClick={() => setNavbarOpen(!navbarOpen)}
          whileTap={{ scale: 0.95 }}
          className="md:hidden z-50 w-11 h-11 rounded-xl glass border border-white/10 flex items-center justify-center text-white focus:outline-none active:scale-95 transition-transform"
        >
          <div className="relative w-5 h-5">
            <motion.span
              animate={{
                rotate: navbarOpen ? 45 : 0,
                y: navbarOpen ? 0 : -6,
              }}
              className="absolute top-1/2 left-0 w-full h-0.5 bg-current transform -translate-y-1/2 transition-all"
            />
            <motion.span
              animate={{
                opacity: navbarOpen ? 0 : 1,
                x: navbarOpen ? -10 : 0,
              }}
              className="absolute top-1/2 left-0 w-full h-0.5 bg-current transform -translate-y-1/2"
            />
            <motion.span
              animate={{
                rotate: navbarOpen ? -45 : 0,
                y: navbarOpen ? 0 : 6,
              }}
              className="absolute top-1/2 left-0 w-full h-0.5 bg-current transform -translate-y-1/2 transition-all"
            />
          </div>
        </motion.button>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {navbarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-surface-900/98 backdrop-blur-2xl md:hidden z-40"
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
