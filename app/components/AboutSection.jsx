"use client";
import React, { useTransition, useState, useEffect } from "react";
import Image from "next/image";
import TabButton from "./TabButton";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";

// Stats data
const stats = [
  { label: "Years Experience", value: "4+", icon: "⚡" },
  { label: "Projects Completed", value: "23+", icon: "🚀" },
  { label: "Technologies", value: "20+", icon: "💻" },
  { label: "Certifications", value: "2", icon: "🏆" },
];

// Personal interests/values
const interests = [
  { name: "Software Development", icon: "💻" },
  { name: "Full-Stack Engineering", icon: "🚀" },
  { name: "Automation & Scripting", icon: "⚙️" },
  { name: "Problem Solving", icon: "🧩" },
];

const TAB_DATA = [
  {
    title: "Education",
    id: "education",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
    content: (
      <div className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="relative pl-8 border-l-2 border-warm-500/50"
        >
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gradient-to-br from-warm-400 to-warm-600 shadow-lg" />
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-warm-500/40 text-warm-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse" />
            2021 - 2025
          </div>
          <h4 className="text-xl font-semibold text-white mb-1">
            Bachelor of Science - Computer Science
          </h4>
          <p className="text-warm-400 font-medium mb-2">University of Western Australia</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Specialised in software engineering, advanced algorithms, and artificial intelligence. 
            Gained hands-on experience with real-world projects and collaborative development.
          </p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative pl-8 border-l-2 border-primary-500/40"
        >
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gradient-to-br from-primary-300 to-primary-500" />
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-primary-500/30 text-primary-400 text-xs font-medium">
            2017 - 2020
          </div>
          <h4 className="text-xl font-semibold text-white mb-1">Bachelor of Science - Nursing</h4>
          <p className="text-primary-400 font-medium mb-2">Edith Cowan University</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Foundation in scientific methodology and analytical thinking. 
            Developed strong problem-solving skills and research capabilities.
          </p>
        </motion.div>
      </div>
    ),
  },
  {
    title: "Certifications",
    id: "certifications",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
    content: (
      <div className="grid grid-cols-1 gap-4">
        {[
          {
            title: "CompTIA Network+",
            issuer: "CompTIA",
            code: "N10-009",
            color: "primary",
          },
          {
            title: "GitHub Foundations",
            issuer: "GitHub",
            code: "Certified",
            color: "accent",
          },
        ].map((cert, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className={`glass-card p-4 hover:shadow-glow-sm transition-all duration-300 group`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-${cert.color}-500/20 group-hover:bg-${cert.color}-500/30 transition-colors`}>
                <svg className={`w-6 h-6 text-${cert.color}-400`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">{cert.title}</h4>
                <p className="text-slate-400 text-sm">{cert.issuer}</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-white/5 text-slate-500">{cert.code}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: "Experience",
    id: "experience",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card p-5 hover:shadow-glow-sm transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-lg font-semibold text-white">Graduate ICT Officer (Cyber Security)</h4>
              <p className="text-primary-400 text-sm font-medium">Main Roads Western Australia</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full glass border border-green-500/30 text-green-400">
              2025 - Present
            </span>
          </div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              SIEM monitoring with Microsoft Sentinel, developing KQL queries for threat detection and incident triage
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Essential Eight uplift: macro security controls, digital signing validation, governance documentation
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Identity & access management: privileged account reviews, least privilege enforcement, MFA analysis
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Security automation: PowerShell/GraphAPI scripting for audit evidence collection and reporting
            </li>
          </ul>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card p-5 hover:shadow-glow-sm transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-lg font-semibold text-white">Junior IT Systems Engineer</h4>
              <p className="text-primary-400 text-sm font-medium">ITDynamics</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full glass border border-primary-500/30 text-primary-400">
              2023 - 2025
            </span>
          </div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Administered Microsoft 365, SharePoint, Teams, Active Directory, JAMF MDM for secure deployments
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Managed network infrastructure (Aruba Central, Cisco): switches, APs, VLANs, troubleshooting
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Built Python OCR utility reducing manual processing by ~90%, automated workflows with Power Automate
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Provided L2 support across Windows/macOS, business applications, structured documentation in IT Glue
            </li>
          </ul>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-card p-5 hover:shadow-glow-sm transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-lg font-semibold text-white">IT Help Desk Technician</h4>
              <p className="text-primary-400 text-sm font-medium">Catholic Education WA (CEWA)</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full glass border border-primary-500/30 text-primary-400">
              2021 - 2023
            </span>
          </div>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Delivered L1 IT support: device imaging, AV troubleshooting, Wi-Fi connectivity in education setting
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Triaged tickets and escalated complex issues to L2/L3 teams per SLA requirements
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">▹</span>
              Created user documentation and guides, improving staff confidence and reducing repeat incidents
            </li>
          </ul>
        </motion.div>
      </div>
    ),
  },
];

const AboutSection = () => {
  const [tab, setTab] = useState("education");
  const [isPending, startTransition] = useTransition();
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  const handleTabChange = (id) => {
    startTransition(() => {
      setTab(id);
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
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
    <motion.section
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className="text-white py-12 sm:py-16 md:py-20 relative overflow-visible px-4 sm:px-6 md:px-8"
      id="about"
    >
      {/* Background decorations */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary-500/10 rounded-full filter blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent-500/10 rounded-full filter blur-3xl" />

      {/* Section Header */}
      <motion.div variants={itemVariants} className="text-center mb-10 sm:mb-12 md:mb-16">
        <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full glass border border-primary-500/30 text-primary-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-primary-400" />
          Get to know me
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
          About <span className="gradient-text">Me</span>
        </h2>
        <div className="h-1 w-16 sm:w-24 bg-gradient-to-r from-primary-500 to-accent-500 mx-auto rounded-full" />
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-start">
        {/* Left Column - Bio & Stats */}
        <motion.div variants={itemVariants} className="space-y-8">
          {/* Bio Card */}
          <div className="glass-card p-5 sm:p-6 md:p-8 relative overflow-hidden">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-accent-500" />
            
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
              Hello! I&apos;m Ciaran 👋
            </h3>
            
            <div className="space-y-3 sm:space-y-4 text-slate-300 leading-relaxed text-sm sm:text-base">
              <p>
                I&apos;m a <span className="text-primary-400 font-medium">Software Developer</span> and 
                <span className="text-primary-400 font-medium"> ICT Professional</span> based in Perth, Australia, 
                passionate about building innovative solutions and solving complex technical challenges.
              </p>
              <p>
                With a <span className="text-accent-400 font-medium">Bachelor of Computer Science from UWA</span> and 
                4+ years of IT experience, I specialise in full-stack development, automation, and systems engineering. 
                I enjoy working across the entire development lifecycle, from design to deployment.
              </p>
              <p>
                I leverage strong technical skills in Python, JavaScript, C, and modern frameworks to build robust applications, 
                automate workflows, and deliver practical solutions. Currently gaining valuable experience in the security 
                space while maintaining my core focus on software development.
              </p>
            </div>

            {/* Interest Tags */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-4 sm:mt-6">
              {interests.map((interest, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full glass border border-white/10 text-xs sm:text-sm text-slate-300 hover:border-primary-500/50 hover:text-primary-400 transition-all cursor-default"
                >
                  <span>{interest.icon}</span>
                  {interest.name}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="glass-card p-3 sm:p-4 md:p-5 text-center hover:shadow-glow-sm transition-all duration-300 group"
              >
                <span className="text-xl sm:text-2xl mb-1 sm:mb-2 block">{stat.icon}</span>
                <div className="text-2xl sm:text-3xl font-bold gradient-text mb-0.5 sm:mb-1">{stat.value}</div>
                <div className="text-slate-400 text-xs sm:text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Profile Image - Mobile Only */}
          <div className="lg:hidden relative">
            <div className="rounded-2xl overflow-hidden glass-card p-1">
              <div className="rounded-xl overflow-hidden">
                <Image
                  src="/images/about-image.webp"
                  alt="Computer setup"
                  width={500}
                  height={350}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column - Tabs */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Profile Image - Desktop Only */}
          <div className="hidden lg:block relative mb-8">
            <div className="rounded-2xl overflow-hidden relative">
              {/* Gradient border */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl" />
              <div className="relative m-[2px] rounded-[14px] overflow-hidden bg-surface-900">
                <Image
                  src="/images/about-image.webp"
                  alt="Computer setup"
                  width={500}
                  height={300}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
            {/* Decoration */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl" />
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-accent-500/10 rounded-full blur-2xl" />
          </div>

          {/* Tab Buttons */}
          <div className="flex flex-wrap gap-2">
            {TAB_DATA.map((tabData) => (
              <button
                key={tabData.id}
                onClick={() => handleTabChange(tabData.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300
                  ${tab === tabData.id 
                    ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-sm" 
                    : "glass border border-white/10 text-slate-400 hover:text-white hover:border-primary-500/50"
                  }
                `}
              >
                {tabData.icon}
                {tabData.title}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="glass-card p-6"
            >
              {TAB_DATA.find((t) => t.id === tab)?.content}
            </motion.div>
          </AnimatePresence>

          {/* Resume CTA */}
          <motion.div variants={itemVariants} className="text-center lg:text-left">
            <a
              href="/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 btn-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Resume
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default AboutSection;
