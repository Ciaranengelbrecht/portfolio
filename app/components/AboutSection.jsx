"use client";
import React, { useTransition, useState, useEffect } from "react";
import Image from "next/image";
import TabButton from "./TabButton";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const TAB_DATA = [
  {
    title: "Skills",
    id: "skills",
    content: (
      <div className="grid grid-cols-2 gap-4">
        {[
          { skill: "C", level: 85 },
          { skill: "Python", level: 90 },
          { skill: "Java", level: 80 },
          { skill: "SQL", level: 75 },
          { skill: "JavaScript", level: 85 },
          { skill: "CSS", level: 70 },
          { skill: "HTML", level: 90 },
        ].map((item, index) => (
          <div key={index} className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="font-medium">{item.skill}</span>
              <span>{item.level}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.level}%` }}
                transition={{ duration: 1, delay: 0.2 * index }}
                className="bg-primary-500 h-2 rounded-full"></motion.div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Education",
    id: "education",
    content: (
      <div className="space-y-6">
        <div className="relative pl-8 border-l-2 border-primary-500">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary-500"></div>
          <div className="mb-1 text-xs inline-block px-2 py-1 rounded bg-primary-900/30 text-primary-300">
            2020 - 2022
          </div>
          <h4 className="text-xl font-semibold">
            Graduate Diploma - Computer Science
          </h4>
          <p className="text-gray-400">University of Western Australia</p>
          <p className="mt-2">
            Specialized in software engineering and advanced algorithms
          </p>
        </div>
        <div className="relative pl-8 border-l-2 border-primary-500">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary-500"></div>
          <div className="mb-1 text-xs inline-block px-2 py-1 rounded bg-primary-900/30 text-primary-300">
            2016 - 2020
          </div>
          <h4 className="text-xl font-semibold">Bachelor of Science</h4>
          <p className="text-gray-400">Edith Cowan University</p>
          <p className="mt-2">
            Focused on foundational science and analytical skills
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Certifications",
    id: "certifications",
    content: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: "Harvard CS50x",
            subtitle: "Intro to Computer Science",
            image: "/images/certifications/cs50.png",
          },
          {
            title: "Harvard CS50P",
            subtitle: "Intro to Python",
            image: "/images/certifications/cs50p.png",
          },
        ].map((cert, index) => (
          <div key={index} className="bg-gray-800 p-4 rounded-lg">
            <div className="h-24 mb-3 bg-gray-700 rounded flex items-center justify-center">
              {cert.image ? (
                <Image
                  src={cert.image}
                  alt={cert.title}
                  width={100}
                  height={60}
                />
              ) : (
                <div className="text-center text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    fill="currentColor"
                    className="bi bi-award mx-auto mb-1"
                    viewBox="0 0 16 16">
                    <path d="M9.669.864 8 0 6.331.864l-1.858.282-.842 1.68-1.337 1.32L2.6 6l-.306 1.854 1.337 1.32.842 1.68 1.858.282L8 12l1.669-.864 1.858-.282.842-1.68 1.337-1.32L13.4 6l.306-1.854-1.337-1.32-.842-1.68L9.669.864zm1.196 1.193.684 1.365 1.086 1.072L12.387 6l.248 1.506-1.086 1.072-.684 1.365-1.51.229L8 10.874l-1.355-.702-1.51-.229-.684-1.365-1.086-1.072L3.614 6l-.25-1.506 1.087-1.072.684-1.365 1.51-.229L8 1.126l1.356.702 1.509.229z" />
                    <path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z" />
                  </svg>
                </div>
              )}
            </div>
            <h4 className="text-lg font-semibold">{cert.title}</h4>
            <p className="text-gray-400">{cert.subtitle}</p>
          </div>
        ))}
      </div>
    ),
  },
];

const AboutSection = () => {
  const [tab, setTab] = useState("skills");
  const [isPending, startTransition] = useTransition();
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
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
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={containerVariants}
      className="text-white py-20"
      id="about">
      <div className="md:grid md:grid-cols-2 gap-12 items-start py-8 px-4 xl:gap-16 sm:py-16 xl:px-16">
        <motion.div variants={itemVariants} className="relative">
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <div className="h-full w-full bg-gradient-to-br from-primary-500 to-primary-700 p-1">
              <div className="bg-dark h-full w-full rounded-xl overflow-hidden">
                <Image
                  src="/images/about-image.jpg"
                  alt="Computer setup"
                  width={500}
                  height={350}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>

          {/* Decoration elements */}
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary-500/20 rounded-full blur-2xl"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-primary-800/10 rounded-full blur-2xl"></div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 md:mt-0 text-left flex flex-col h-full">
          <div className="flex flex-col gap-2 mb-6">
            <h2 className="text-4xl font-bold text-white mb-4">About Me</h2>
            <div className="h-1 w-20 bg-primary-500 rounded"></div>
          </div>

          <p className="text-base lg:text-lg mb-6">
            I am a student software engineer with a passion for finding
            solutions to a range of complex problems. I have experience working
            with JavaScript, React, Java, C, Python, StableBaselines, HTML, CSS,
            and Github. I endeavor to keep learning and developing my skillset,
            looking to expand my knowledge. I am a team player and I am excited
            to work with others to develop new projects.
          </p>

          <div className="flex flex-row justify-start mt-4 mb-2">
            <TabButton
              selectTab={() => handleTabChange("skills")}
              active={tab === "skills"}>
              Skills
            </TabButton>
            <TabButton
              selectTab={() => handleTabChange("education")}
              active={tab === "education"}>
              Education
            </TabButton>
            <TabButton
              selectTab={() => handleTabChange("certifications")}
              active={tab === "certifications"}>
              Certifications
            </TabButton>
          </div>

          <div className="mt-4 bg-[#1A1A1A] rounded-xl p-6 shadow-lg flex-grow">
            {TAB_DATA.find((t) => t.id === tab).content}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default AboutSection;
