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

      <div className="container mt-24 mx-auto px-4 md:px-12 py-4">
        <HeroSection />
        
        {/* Section Divider */}
        <div className="section-divider my-16" />
        
        <AboutSection />
        
        {/* Section Divider */}
        <div className="section-divider my-16" />
        
        <SkillsSection />
        
        {/* Section Divider */}
        <div className="section-divider my-16" />
        
        <ProjectsSection />
        
        {/* Section Divider */}
        <div className="section-divider my-16" />
        
        <ContactSection />
      </div>

      <Footer />
    </main>
  );
}
