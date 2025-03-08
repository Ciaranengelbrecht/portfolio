"use client";
import React from "react";
import { TypeAnimation } from "react-type-animation";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

const HeroSection = () => {
  return (
    <section className="lg:py-16 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 right-0 bottom-0 bg-[#121212] z-0">
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-b from-transparent to-black/40 z-10"></div>
        <div className="absolute grid grid-cols-6 w-full h-full z-0 opacity-20">
          {[...Array(36)].map((_, i) => (
            <div key={i} className="border-[0.5px] border-gray-700/30"></div>
          ))}
        </div>
      </div>

      {/* Animated circles in the background */}
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-primary-600/30 rounded-full filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-1/3 left-1/4 w-60 h-60 bg-accent/30 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>

      <div className="grid grid-cols-1 sm:grid-cols-12 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="col-span-7 place-self-center text-center sm:text-left justify-self-start">
          <div className="inline-block px-2 py-1 bg-gradient-to-r from-primary-500/20 to-primary-500/10 rounded-lg backdrop-blur-sm mb-4">
            <h2 className="text-primary-400 text-sm">
              Software Engineer & Developer
            </h2>
          </div>

          <h1 className="text-white mb-4 text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
              I am{" "}
            </span>
            <TypeAnimation
              sequence={[
                "a Creator",
                1000,
                "a Learner",
                1000,
                "a Thinker",
                1000,
                "Ciaran",
                5000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
              className="text-white"
            />
          </h1>

          <p className="text-[#ADB7BE] text-base sm:text-lg mb-6 lg:text-xl max-w-md">
            Passionate about creating clean, efficient code and solving complex
            problems. I specialize in full-stack development and software
            engineering solutions.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="#projects"
              className="px-6 py-3 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-white font-medium transition-all duration-300 shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2">
              View My Work
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-arrow-down"
                viewBox="0 0 16 16">
                <path
                  fillRule="evenodd"
                  d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"
                />
              </svg>
            </Link>
            <Link
              href="mailto:ciaran.engelbrecht@outlook.com"
              className="px-6 py-3 rounded-full border border-primary-500 hover:bg-primary-500/10 text-white transition-all duration-300 flex items-center justify-center gap-2">
              Contact Me
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                className="bi bi-envelope"
                viewBox="0 0 16 16">
                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z" />
              </svg>
            </Link>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="col-span-5 place-self-center mt-8 lg:mt-0">
          <div className="rounded-full bg-gradient-to-r from-primary-500/10 to-primary-500/30 w-[250px] h-[250px] lg:w-[350px] lg:h-[350px] relative backdrop-filter backdrop-blur-md shadow-lg">
            <div className="absolute inset-2 rounded-full overflow-hidden bg-gradient-to-b from-primary-800/10 to-primary-900/10">
              <Image
                src="/portfolio/images/portrait.webp"
                alt="Ciaran Engelbrecht"
                className="object-cover"
                fill
                priority
              />
            </div>

            {/* Tech stack indicators */}
            <div className="tech-tag absolute -top-2 -right-8 bg-primary-800 text-white text-xs py-1 px-3 rounded-full shadow-lg">
              React
            </div>
            <div className="tech-tag absolute -bottom-2 -left-8 bg-primary-800 text-white text-xs py-1 px-3 rounded-full shadow-lg">
              Python
            </div>
            <div className="tech-tag absolute -bottom-10 right-10 bg-primary-800 text-white text-xs py-1 px-3 rounded-full shadow-lg">
              JavaScript
            </div>
          </div>
        </motion.div>
      </div>

     
    </section>
  );
};

export default HeroSection;
