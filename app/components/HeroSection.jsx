"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import AssetImage from "./AssetImage";

const focusAreas = [
  "Software development",
  "ICT support & systems",
  "Networking & administration",
  "Automation, data & AI",
];

const stack = ["Python", "JavaScript", "TypeScript", "React", "Next.js", "C", "SQL", "PowerShell"];

const signalRows = [
  { label: "Current role", value: "Graduate ICT Officer" },
  { label: "Location", value: "Perth, Western Australia" },
  { label: "Focus", value: "Reliable software, practical ICT, automation, and support" },
];

const HeroSection = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(useTransform(mouseX, [-500, 500], [-10, 10]), {
    damping: 28,
    stiffness: 130,
  });
  const parallaxY = useSpring(useTransform(mouseY, [-500, 500], [-10, 10]), {
    damping: 28,
    stiffness: 130,
  });

  useEffect(() => {
    const handleMouseMove = (event) => {
      mouseX.set(event.clientX - window.innerWidth / 2);
      mouseY.set(event.clientY - window.innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section
      id="home"
      className="relative flex min-h-[100svh] items-start overflow-hidden pb-10 pt-20 sm:min-h-screen sm:items-center sm:py-28"
    >
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/40 to-transparent" />

      <motion.div
        initial={false}
        className="relative z-10 grid w-full grid-cols-1 gap-6 px-4 sm:gap-8 sm:px-6 md:px-12 lg:grid-cols-12 lg:gap-10 xl:px-20"
      >
        <div className="flex flex-col justify-center lg:col-span-7">
          <motion.div initial={false} className="mb-4 sm:mb-5">
            <span className="ops-label">Available for opportunities</span>
          </motion.div>

          <motion.div initial={false} className="mb-4 sm:mb-6">
            <p className="ops-kicker mb-3">Ciaran Engelbrecht / Software Developer & ICT Professional</p>
            <h1 className="max-w-4xl text-[2.15rem] font-semibold leading-[1.04] text-white sm:text-5xl md:text-6xl">
              Building practical software, automation, and ICT solutions
            </h1>
          </motion.div>

          <motion.p
            initial={false}
            className="max-w-2xl text-[0.96rem] leading-relaxed text-primary-100 sm:text-lg"
          >
            I build modern web applications and internal tools with a focus on
            reliability, usability, and clear outcomes. I also explore AI/ML
            workflows and automation where they add practical value.
          </motion.p>

          <motion.div initial={false} className="mt-5 grid max-w-2xl grid-cols-1 gap-2 sm:mt-7 sm:grid-cols-2">
            {focusAreas.map((item) => (
              <div key={item} className="ops-panel-plain px-3 py-2 text-[0.82rem] text-primary-100 sm:text-sm">
                <span className="mr-2 text-accent-300">&gt;</span>
                {item}
              </div>
            ))}
          </motion.div>

          <motion.div initial={false} className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <Link href="#projects" className="ops-button">
              View my work
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>
            <Link href="#contact" className="ops-button-secondary">
              Get in touch
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75" />
              </svg>
            </Link>
          </motion.div>

          <motion.div initial={false} className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
            <Link
              href="https://github.com/Ciaranengelbrecht"
              target="_blank"
              rel="noopener noreferrer"
              className="ops-chip"
            >
              GitHub
            </Link>
            <Link
              href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243"
              target="_blank"
              rel="noopener noreferrer"
              className="ops-chip"
            >
              LinkedIn
            </Link>
            <Link href="mailto:ciaran.engelbrecht@outlook.com" className="ops-chip">
              Email
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={false}
          className="lg:col-span-5"
          style={{ x: parallaxX, y: parallaxY }}
        >
          <div className="ops-panel hero-profile-card scan-mask">
            <span className="profile-top-glint" />
            <div className="grid grid-cols-1 gap-0">
              <div className="border-b border-white/10 p-3 text-xs font-medium uppercase text-primary-300">
                Profile overview
              </div>
              <div className="grid grid-cols-[0.42fr_0.58fr] gap-0 sm:grid-cols-[0.9fr_1.1fr] lg:grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="portrait-frame relative min-h-[205px] border-r border-white/10 bg-surface-950 sm:min-h-[280px] sm:border-b-0 sm:border-r lg:border-b lg:border-r-0 xl:border-b-0 xl:border-r">
                  <AssetImage
                    src="/images/portrait.webp"
                    alt="Ciaran Engelbrecht"
                    className="object-contain object-center grayscale-[8%] contrast-105 sm:object-cover"
                    fill
                    priority
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(8,11,15,0.32)_66%,rgba(8,11,15,0.82)_100%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-surface-950/20" />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-950 to-transparent" />
                </div>

                <div className="space-y-3 p-3 sm:space-y-5 sm:p-5">
                  <div>
                    <p className="ops-kicker mb-2">Profile</p>
                    <h2 className="text-lg font-semibold text-white min-[390px]:text-xl sm:text-2xl">Ciaran Engelbrecht</h2>
                    <p className="mt-1 text-sm text-primary-200">Software Developer / ICT Professional</p>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    {signalRows.map((row) => (
                      <div key={row.label} className="border-l border-accent-400/35 pl-3">
                        <p className="text-xs font-semibold uppercase text-primary-400">{row.label}</p>
                        <p className="text-sm text-primary-100">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="hidden min-[430px]:block sm:block">
                    <p className="ops-kicker mb-2">Technologies</p>
                    <div className="flex flex-wrap gap-2">
                      {stack.map((item) => (
                        <span key={item} className="ops-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.45 }}
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-xs text-primary-400 lg:flex"
      >
        <span>scroll</span>
        <span className="h-px w-12 bg-primary-700" />
        <span>more below</span>
      </motion.div>
    </section>
  );
};

export default HeroSection;
