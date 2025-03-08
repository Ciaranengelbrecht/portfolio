"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const NavLink = ({ href, title }) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Skip if href doesn't start with #
      if (!href.startsWith("#")) return;

      const sectionId = href.substring(1);
      const section = document.getElementById(sectionId);

      if (section) {
        const rect = section.getBoundingClientRect();
        const isInView = rect.top <= 100 && rect.bottom >= 100;
        setIsActive(isInView);
      }
    };

    window.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [href]);

  return (
    <Link
      href={href}
      className={`relative py-2 text-[#ADB7BE] hover:text-white transition-colors duration-300 ${
        isActive ? "text-primary-500" : ""
      }`}>
      {title}
      {isActive && (
        <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary-500 transform origin-left"></span>
      )}
    </Link>
  );
};

export default NavLink;
