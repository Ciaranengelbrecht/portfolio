"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, x: -40 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    }
  },
};

const MenuOverlay = ({ links, setNavbarOpen, activeSection }) => {
  return (
    <motion.div
      className="flex flex-col items-start justify-center h-full w-full px-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Menu Links */}
      <div className="space-y-2 mb-12 w-full">
        {links.map((link, index) => {
          const isActive = activeSection === link.path.substring(1);
          return (
            <motion.div key={index} variants={item}>
              <Link
                href={link.path}
                onClick={() => setNavbarOpen(false)}
                className="group flex items-center gap-4 py-4 border-b border-white/5"
              >
                {/* Index number */}
                <span className={`text-sm font-mono ${isActive ? 'text-primary-400' : 'text-slate-600'}`}>
                  0{index + 1}
                </span>
                
                {/* Link title */}
                <span className={`text-3xl font-bold transition-all duration-300 ${
                  isActive 
                    ? 'text-white translate-x-2' 
                    : 'text-slate-400 group-hover:text-white group-hover:translate-x-2'
                }`}>
                  {link.title}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveNav"
                    className="ml-auto w-2 h-2 rounded-full bg-primary-400"
                  />
                )}
                
                {/* Hover arrow */}
                <svg 
                  className={`ml-auto w-6 h-6 transition-all duration-300 ${
                    isActive ? 'text-primary-400 translate-x-0 opacity-100' : 'text-slate-600 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                  }`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Resume Button */}
      <motion.div variants={item} className="w-full">
        <Link
          href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
          target="_blank"
          onClick={() => setNavbarOpen(false)}
          className="group w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white font-semibold text-lg transition-all duration-300 shadow-glow"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Resume
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </motion.div>

      {/* Social Links */}
      <motion.div variants={item} className="mt-12 flex items-center gap-4">
        <span className="text-sm text-slate-500">Find me on</span>
        <div className="flex gap-3">
          {[
            { href: "https://github.com/Ciaranengelbrecht", icon: "github" },
            { href: "https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243", icon: "linkedin" },
          ].map((social, index) => (
            <a
              key={index}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-primary-500/50 transition-all duration-300"
            >
              {social.icon === "github" ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              )}
            </a>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MenuOverlay;
