"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, x: -24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const MenuOverlay = ({ links, setNavbarOpen, activeSection }) => {
  const handleLinkClick = (event, path) => {
    event.preventDefault();
    setNavbarOpen(false);

    setTimeout(() => {
      const sectionId = path.replace("#", "");
      const section = document.getElementById(sectionId);

      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", path);
      }
    }, 250);
  };

  return (
    <motion.div
      className="flex h-[100svh] w-full flex-col overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] sm:px-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="mb-5 sm:mb-8">
        <p className="ops-kicker">Navigation</p>
        <div className="ops-rule mt-3" />
      </motion.div>

      <div className="space-y-2">
        {links.map((link, index) => {
          const isActive = activeSection === link.path.substring(1);

          return (
            <motion.div key={link.path} variants={item}>
              <a
                href={link.path}
                onClick={(event) => handleLinkClick(event, link.path)}
                className={`group flex min-h-14 items-center gap-3 rounded-xl border p-3.5 transition-colors duration-200 sm:gap-4 sm:p-4 ${
                  isActive
                    ? "border-accent-400/35 bg-accent-400/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-primary-200 hover:border-primary-300/35 hover:text-white"
                }`}
              >
                <span className="text-xs font-semibold text-accent-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-xl font-semibold sm:text-2xl">{link.title}</span>
                <span className="ml-auto text-sm transition-transform duration-200 group-hover:translate-x-1">
                  -&gt;
                </span>
              </a>
            </motion.div>
          );
        })}
      </div>

      <motion.div variants={item} className="mt-6 sm:mt-8">
        <Link
          href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
          target="_blank"
          onClick={() => setNavbarOpen(false)}
          className="ops-button w-full"
        >
          Download resume
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </Link>
      </motion.div>

      <motion.div variants={item} className="mt-5 flex flex-wrap gap-2 sm:mt-6">
        <a
          href="https://github.com/Ciaranengelbrecht"
          target="_blank"
          rel="noopener noreferrer"
          className="ops-chip"
        >
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243"
          target="_blank"
          rel="noopener noreferrer"
          className="ops-chip"
        >
          LinkedIn
        </a>
      </motion.div>
    </motion.div>
  );
};

export default MenuOverlay;
