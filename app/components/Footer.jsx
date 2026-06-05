"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const socialLinks = [
  { name: "LinkedIn", href: "https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243" },
  { name: "GitHub", href: "https://github.com/Ciaranengelbrecht" },
  { name: "Email", href: "mailto:ciaran.engelbrecht@outlook.com" },
];

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "About", href: "#about" },
  { name: "Skills", href: "#skills" },
  { name: "Projects", href: "#projects" },
  { name: "Contact", href: "#contact" },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 pb-4 text-white sm:pb-0">
      <div className="ops-container py-8 sm:py-12">
        <div className="grid grid-cols-1 gap-7 border-b border-white/10 pb-7 sm:gap-8 sm:pb-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-400/30 bg-accent-400/10 text-sm font-semibold text-accent-100">
                CE
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-primary-400">Portfolio</p>
                <p className="text-lg font-semibold text-white">Ciaran Engelbrecht</p>
              </div>
            </Link>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-200 sm:mt-5">
              Software developer and ICT professional focused on reliable applications,
              practical support, automation, and workflow improvement.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target={social.href.startsWith("http") ? "_blank" : undefined}
                  rel={social.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="ops-chip"
                >
                  {social.name}
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <h3 className="ops-kicker mb-3 sm:mb-4">navigation</h3>
            <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
              {navLinks.map((link, index) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="group flex min-h-10 items-center gap-3 rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-primary-300 transition-colors hover:text-white sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-1 sm:py-1.5"
                >
                  <span className="text-[11px] font-semibold text-accent-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="md:col-span-4">
            <h3 className="ops-kicker mb-3 sm:mb-4">get in touch</h3>
            <p className="max-w-sm text-sm text-primary-200">
              If you have a project in mind or a role to discuss, feel free to reach out.
            </p>

            <a
              href="mailto:ciaran.engelbrecht@outlook.com"
              className="mt-4 inline-flex max-w-full items-center gap-2 break-all text-sm text-accent-200 transition-colors hover:text-white"
            >
              ciaran.engelbrecht@outlook.com
              <span>-&gt;</span>
            </a>

            <div className="mt-5">
              <Link
                href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
                target="_blank"
                className="ops-button-secondary w-full sm:w-auto"
              >
                Download resume
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-6 md:flex-row">
          <p className="text-center text-xs text-primary-400 md:text-left">
            {currentYear} Ciaran Engelbrecht.
          </p>
          <p className="text-xs text-primary-500">Built with Next.js and Tailwind</p>
        </div>
      </div>

      <motion.button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-50 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-surface-850/95 text-primary-200 shadow-ops-soft backdrop-blur-md transition-colors hover:border-accent-400/35 hover:text-white sm:bottom-8 sm:right-8 sm:h-11 sm:w-11"
        aria-label="Scroll to top"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </motion.button>
    </footer>
  );
};

export default Footer;
