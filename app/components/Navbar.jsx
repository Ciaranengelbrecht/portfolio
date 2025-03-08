"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import NavLink from "./NavLink";
import MenuOverlay from "./MenuOverlay";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";

const navLinks = [
  {
    title: "Home",
    path: "#home",
  },
  {
    title: "About",
    path: "#about",
  },
  {
    title: "Skills",
    path: "#skills",
  },
  {
    title: "Projects",
    path: "#projects",
  },
  {
    title: "Contact",
    path: "#contact",
  },
];

const Navbar = () => {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolling(true);
      } else {
        setScrolling(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={`fixed w-full top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolling ? "backdrop-blur-xl bg-black/70 shadow-lg" : "bg-transparent"
      }`}>
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto py-4 px-4 md:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center z-50">
          <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
            CE
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-x-8">
          {navLinks.map((link, index) => (
            <NavLink
              key={index}
              href={link.path}
              title={link.title}
              className={`text-sm uppercase tracking-wider font-medium transition-colors duration-300`}
            />
          ))}

          <Link
            href="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/Resume+Ciaran+Engelbrecht+for+website.pdf"
            target="_blank"
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-medium transition-all shadow-lg shadow-primary-500/20">
            Resume
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setNavbarOpen(!navbarOpen)}
          className="md:hidden z-50 flex items-center px-3 py-2 text-white focus:outline-none">
          {navbarOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>

        {/* Mobile Menu Overlay */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: navbarOpen ? 1 : 0,
            height: navbarOpen ? "100vh" : 0,
          }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 bg-black/95 backdrop-blur-lg md:hidden z-40 ${
            navbarOpen ? "block" : "hidden"
          }`}>
          {navbarOpen && (
            <MenuOverlay links={navLinks} setNavbarOpen={setNavbarOpen} />
          )}
        </motion.div>
      </motion.nav>
    </header>
  );
};

export default Navbar;
