"use client";

import { motion } from "framer-motion";

const NavLink = ({ href, title, isActive }) => {
  const handleClick = (event) => {
    event.preventDefault();

    const sectionId = href.replace("#", "");
    const section = document.getElementById(sectionId);

    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", href);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="relative rounded-lg px-3 py-2 text-xs font-semibold uppercase transition-colors duration-200"
    >
      {isActive && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 rounded-lg border border-accent-400/35 bg-accent-400/10"
          transition={{ type: "spring", bounce: 0.16, duration: 0.5 }}
        />
      )}

      <span className={`relative z-10 ${isActive ? "text-accent-100" : "text-primary-300 hover:text-white"}`}>
        {title}
      </span>
    </a>
  );
};

export default NavLink;
