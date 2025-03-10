"use client"; // Add this line at the top

import React from "react";
import HeroSection from "./components/HeroSection";
import Navbar from "./components/Navbar";
import AboutSection from "./components/AboutSection";
import ProjectsSection from "./components/ProjectSection"; // Changed from ProjectsSection to ProjectSection
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Navbar />

      <div className="container mt-24 mx-auto px-4 md:px-12 py-4">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <ContactSection />
      </div>

      <Footer />
    </main>
  );
}
