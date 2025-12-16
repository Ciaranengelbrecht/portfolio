"use client";
import React, { useEffect, useState } from "react";
import { TypeAnimation } from "react-type-animation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import AssetImage from "./AssetImage";

// Floating tech tags with individual animations
const techTags = [
  { name: "React", delay: 0, position: "top-0 -right-4 lg:-right-8" },
  { name: "Python", delay: 0.1, position: "top-16 -right-2 lg:top-20 lg:-right-6" },
  { name: "Java", delay: 0.2, position: "-bottom-2 -left-4 lg:-left-8" },
  { name: "C", delay: 0.3, position: "bottom-16 -left-6 lg:bottom-20 lg:-left-10" },
  { name: "JavaScript", delay: 0.4, position: "-bottom-8 right-8 lg:-bottom-10 lg:right-10" },
  { name: "Next.js", delay: 0.5, position: "-top-6 left-8 lg:-top-8 lg:left-10" },
  { name: "TypeScript", delay: 0.6, position: "top-4 -left-2 lg:top-6 lg:-left-4" },
  { name: "SQL", delay: 0.7, position: "top-28 -left-4 lg:top-32 lg:-left-8" },
  { name: "Tailwind", delay: 0.8, position: "bottom-8 -right-2 lg:bottom-10 lg:-right-4" },
];

const TechTag = ({ name, delay, position }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay: 0.8 + delay, type: "spring", stiffness: 200 }}
    className={`absolute ${position} z-10`}
  >
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3 + delay, repeat: Infinity, ease: "easeInOut" }}
      className="glass px-3 py-1.5 rounded-full text-xs font-medium text-primary-300 border border-primary-500/30 shadow-glow-sm hover:shadow-glow hover:border-primary-400/50 transition-all duration-300 cursor-default"
    >
      {name}
    </motion.div>
  </motion.div>
);

// Animated background orb component
const BackgroundOrb = ({ className, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 1.5, delay }}
    className={`absolute rounded-full filter blur-3xl ${className}`}
  />
);

const HeroSection = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Mouse tracking for parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 150 };
  const parallaxX = useSpring(useTransform(mouseX, [-500, 500], [-20, 20]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-500, 500], [-20, 20]), springConfig);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      mouseX.set(clientX - centerX);
      mouseY.set(clientY - centerY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <section id="home" className="min-h-screen py-16 lg:py-24 relative overflow-x-hidden flex items-center">
      {/* Animated background orbs */}
      <BackgroundOrb 
        className="top-1/4 right-1/4 w-96 h-96 bg-primary-500/20 animate-pulse-slow" 
        delay={0.2}
      />
      <BackgroundOrb 
        className="bottom-1/4 left-1/4 w-80 h-80 bg-accent-500/15 animate-pulse-slow" 
        delay={0.4}
      />
      <BackgroundOrb 
        className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary-500/10 to-transparent" 
        delay={0.1}
      />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 relative z-20 w-full overflow-visible px-4 md:px-8 lg:px-12"
      >
        {/* Text Content */}
        <div className="lg:col-span-7 flex flex-col justify-center text-center lg:text-left order-2 lg:order-1">
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary-500/30 text-primary-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Available for opportunities
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1 
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6"
          >
            <span className="block text-slate-300 mb-2">Hi, I&apos;m</span>
            <span className="gradient-text-animated font-extrabold">
              Ciaran Engelbrecht
            </span>
          </motion.h1>

          {/* Type Animation */}
          <motion.div 
            variants={itemVariants}
            className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-400 mb-6 h-12"
          >
            <span className="text-slate-500">I&apos;m </span>
            <TypeAnimation
              sequence={[
                "a Software Developer",
                2000,
                "a Full-Stack Engineer",
                2000,
                "a Problem Solver",
                2000,
                "an ICT Professional",
                2000,
                "a Creative Builder",
                2000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
              className="text-primary-400"
            />
          </motion.div>

          {/* Description */}
          <motion.p 
            variants={itemVariants}
            className="text-slate-400 text-base lg:text-lg mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            Passionate about crafting elegant solutions to complex problems. 
            I specialise in building modern web applications, exploring AI/ML, 
            and creating impactful software that makes a difference.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <Link
              href="#projects"
              className="group btn-primary inline-flex items-center justify-center gap-2"
            >
              View My Work
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
                className="group-hover:translate-y-1 transition-transform duration-300"
              >
                <path
                  fillRule="evenodd"
                  d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"
                />
              </motion.svg>
            </Link>
            <Link
              href="#contact"
              className="group btn-secondary inline-flex items-center justify-center gap-2"
            >
              Let&apos;s Connect
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
                className="group-hover:translate-x-1 transition-transform duration-300"
              >
                <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
              </motion.svg>
            </Link>
          </motion.div>

          {/* Social Links */}
          <motion.div 
            variants={itemVariants}
            className="flex gap-4 mt-8 justify-center lg:justify-start"
          >
            <Link
              href="https://github.com/Ciaranengelbrecht"
              target="_blank"
              className="p-3 rounded-xl glass border border-white/10 hover:border-primary-500/50 hover:shadow-glow-sm transition-all duration-300 group"
              aria-label="GitHub"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
            </Link>
            <Link
              href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243"
              target="_blank"
              className="p-3 rounded-xl glass border border-white/10 hover:border-primary-500/50 hover:shadow-glow-sm transition-all duration-300 group"
              aria-label="LinkedIn"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </Link>
            <Link
              href="mailto:ciaran.engelbrecht@outlook.com"
              className="p-3 rounded-xl glass border border-white/10 hover:border-primary-500/50 hover:shadow-glow-sm transition-all duration-300 group"
              aria-label="Email"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* Profile Image with Tech Tags */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, type: "spring", stiffness: 100 }}
          className="lg:col-span-5 flex justify-center items-center order-1 lg:order-2 overflow-visible py-8 lg:py-0"
          style={{ x: parallaxX, y: parallaxY }}
        >
          <div className="relative w-[280px] h-[280px] lg:w-[400px] lg:h-[400px] lg:mr-16 xl:mr-20">
            {/* Glow ring behind image */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 blur-2xl animate-glow-pulse" />
            
            {/* Rotating border */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, #06B6D4, #8B5CF6, #06B6D4)",
                padding: "3px",
              }}
            >
              <div className="w-full h-full rounded-full bg-surface-900" />
            </motion.div>

            {/* Profile image container */}
            <div className="absolute inset-2 lg:inset-3 rounded-full overflow-hidden glass-dark">
              <AssetImage
                src="/portfolio/images/portrait.webp"
                alt="Ciaran Engelbrecht"
                className="object-cover scale-105 hover:scale-110 transition-transform duration-500"
                fill
                priority
              />
            </div>

            {/* Floating tech tags */}
            {techTags.map((tag) => (
              <TechTag key={tag.name} {...tag} />
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2"
      >
        <span className="text-slate-500 text-sm">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-6 h-10 rounded-full border-2 border-slate-600 flex justify-center pt-2"
        >
          <motion.div
            animate={{ opacity: [1, 0], y: [0, 12] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-primary-400"
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
