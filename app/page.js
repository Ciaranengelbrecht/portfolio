import Image from "next/image";
import HeroSection from "./components/HeroSection";
import Navbar from "./components/Navbar";
import AboutSection from "./components/AboutSection";
import ProjectsSection from "./components/ProjectSection";
import SkillsSection from "./components/SkillsSection";
import ContactSection from "./components/ContactSection";
import CallToAction from "./components/CallToAction";
import Footer from "./components/Footer";
import React from "react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Navbar />

      <div className="container mt-24 mx-auto px-4 md:px-12 py-4">
        <HeroSection />
        <AboutSection />
        <SkillsSection />
        <ProjectsSection />
        <CallToAction />
        <ContactSection />
      </div>

      <Footer />
    </main>
  );
}
