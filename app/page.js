"use client";

import React from "react";
import HeroSection from "./components/HeroSection";
import Navbar from "./components/Navbar";
import AboutSection from "./components/AboutSection";
import ProjectsSection from "./components/ProjectSection";
import SkillsSection from "./components/SkillsSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-surface-900 noise">
      <Navbar />

      <HeroSection />
      <div className="ops-container"><div className="section-divider" /></div>
      <AboutSection />
      <div className="ops-container"><div className="section-divider" /></div>
      <SkillsSection />
      <div className="ops-container"><div className="section-divider" /></div>
      <ProjectsSection />
      <div className="ops-container"><div className="section-divider" /></div>
      <ContactSection />

      <Footer />
    </main>
  );
}
