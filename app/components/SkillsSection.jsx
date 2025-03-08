// app/components/SkillsSection.jsx
"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const skills = [
  {
    name: "Python",
    icon: "/images/skills/python.svg",
    level: 90,
    category: "languages",
  },
  {
    name: "JavaScript",
    icon: "/images/skills/javascript.svg",
    level: 85,
    category: "languages",
  },
  {
    name: "Java",
    icon: "/images/skills/java.svg",
    level: 80,
    category: "languages",
  },
  { name: "C", icon: "/images/skills/c.svg", level: 85, category: "languages" },
  {
    name: "SQL",
    icon: "/images/skills/sql.svg",
    level: 75,
    category: "languages",
  },
  {
    name: "HTML",
    icon: "/images/skills/html.svg",
    level: 90,
    category: "frontend",
  },
  {
    name: "CSS",
    icon: "/images/skills/css.svg",
    level: 70,
    category: "frontend",
  },
  {
    name: "React",
    icon: "/images/skills/react.svg",
    level: 75,
    category: "frontend",
  },
  {
    name: "Tailwind CSS",
    icon: "/images/skills/tailwind.svg",
    level: 80,
    category: "frontend",
  },
  {
    name: "Next.js",
    icon: "/images/skills/nextjs.svg",
    level: 70,
    category: "frontend",
  },
  { name: "Git", icon: "/images/skills/git.svg", level: 85, category: "tools" },
  {
    name: "GitHub",
    icon: "/images/skills/github.svg",
    level: 85,
    category: "tools",
  },
];

const categories = [
  { id: "all", name: "All Skills" },
  { id: "languages", name: "Languages" },
  { id: "frontend", name: "Frontend" },
  { id: "tools", name: "Tools & Other" },
];

const SkillCard = ({ skill, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-[#111111] p-6 rounded-xl shadow-lg border border-gray-800 hover:border-primary-500/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-primary-900/30 p-3 rounded-lg mr-4">
            {/* Placeholder for skill icon */}
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500">
              {skill.name.charAt(0)}
            </div>
          </div>
          <h3 className="text-xl font-semibold text-white">{skill.name}</h3>
        </div>
        <span className="text-primary-400 font-semibold">{skill.level}%</span>
      </div>
      <div className="w-full bg-gray-700/30 rounded-full h-2.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${skill.level}%` }}
          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
          className="h-2.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-700"></motion.div>
      </div>
    </motion.div>
  );
};

const SkillsSection = () => {
  const [category, setCategory] = useState("all");
  const [filteredSkills, setFilteredSkills] = useState(skills);

  useEffect(() => {
    if (category === "all") {
      setFilteredSkills(skills);
    } else {
      setFilteredSkills(skills.filter((skill) => skill.category === category));
    }
  }, [category]);

  return (
    <section id="skills" className="py-20 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-40 right-0 w-96 h-96 bg-primary-900/10 rounded-full filter blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-primary-500/5 rounded-full filter blur-3xl"></div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">My Skills</h2>
          <div className="h-1 w-20 bg-primary-500 mx-auto rounded mb-6"></div>
          <p className="text-[#ADB7BE] max-w-lg mx-auto">
            I've worked with a variety of programming languages and
            technologies. Here's a snapshot of my technical expertise and
            proficiency.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-6 py-3 rounded-full transition-all duration-300 ${
                category === cat.id
                  ? "bg-primary-500 text-white"
                  : "bg-[#1A1A1A] text-[#ADB7BE] hover:text-white"
              }`}>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill, index) => (
            <SkillCard key={skill.name} skill={skill} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SkillsSection;
