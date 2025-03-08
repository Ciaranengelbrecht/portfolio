import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-gray-800 text-white overflow-hidden">
      {/* Background blur effects */}
      <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-primary-500/10 filter blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-primary-900/10 filter blur-3xl"></div>

      <div className="container mx-auto py-16 px-4 relative z-10">
        {/* Top Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-gray-800">
          {/* Logo & Info */}
          <div>
            <Link href="/" className="flex items-center">
              <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
                CE
              </span>
            </Link>
            <p className="text-gray-400 mt-4 max-w-sm">
              Software engineer passionate about creating clean, efficient code
              and solving complex problems.
            </p>
            <div className="flex gap-4 mt-6">
              <Link
                href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243"
                target="_blank"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-800/20 flex items-center justify-center text-gray-400 hover:text-primary-400 transition-all">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </Link>
              <Link
                href="https://github.com/Ciaranengelbrecht"
                target="_blank"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-800/20 flex items-center justify-center text-gray-400 hover:text-primary-400 transition-all">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:text-center">
            <h3 className="text-lg font-semibold text-white mb-4">
              Quick Links
            </h3>
            <div className="flex flex-col items-start md:items-center gap-3 text-gray-400">
              <Link href="#about" className="hover:text-primary-400 transition">
                About
              </Link>
              <Link
                href="#skills"
                className="hover:text-primary-400 transition">
                Skills
              </Link>
              <Link
                href="#projects"
                className="hover:text-primary-400 transition">
                Projects
              </Link>
              <Link
                href="#contact"
                className="hover:text-primary-400 transition">
                Contact
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="md:text-right">
            <h3 className="text-lg font-semibold text-white mb-4">Contact</h3>
            <div className="text-gray-400">
              <p className="mb-2">Ciaran Engelbrecht</p>
              <a
                href="mailto:ciaran.engelbrecht@outlook.com"
                className="hover:text-primary-400 transition">
                ciaran.engelbrecht@outlook.com
              </a>
              <div className="mt-4">
                <Link
                  href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
                  target="_blank"
                  className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-medium transition-all">
                  Download Resume
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            © {currentYear} Ciaran Engelbrecht. All rights reserved.
          </p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-500 text-sm mt-2 md:mt-0"></motion.p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
