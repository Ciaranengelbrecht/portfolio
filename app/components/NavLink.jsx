"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const NavLink = ({ href, title, isActive }) => {
  return (
    <Link
      href={href}
      className="relative px-4 py-2 rounded-full transition-all duration-300"
    >
      {/* Active background */}
      {isActive && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-full border border-primary-500/30"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      
      <span
        className={`relative z-10 text-sm font-medium transition-colors duration-300 ${
          isActive ? "text-white" : "text-slate-400 hover:text-white"
        }`}
      >
        {title}
      </span>
    </Link>
  );
};

export default NavLink;
