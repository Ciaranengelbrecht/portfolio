import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const MenuOverlay = ({ links, setNavbarOpen }) => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full w-full"
      variants={container}
      initial="hidden"
      animate="show">
      {links.map((link, index) => (
        <motion.div key={index} variants={item} className="my-4">
          <Link
            href={link.path}
            onClick={() => setNavbarOpen(false)}
            className="text-2xl font-semibold text-white hover:text-primary-500 transition-colors">
            {link.title}
          </Link>
        </motion.div>
      ))}
      <motion.div variants={item} className="mt-8">
        <Link
          href="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/Resume+Ciaran+Engelbrecht+for+website.pdf"
          target="_blank"
          className="px-8 py-3 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium"
          onClick={() => setNavbarOpen(false)}>
          Resume
        </Link>
      </motion.div>
    </motion.div>
  );
};

export default MenuOverlay;
