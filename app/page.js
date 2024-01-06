import Image from 'next/image'
import HeroSection from './components/HeroSection'
import Navbar from './components/Navbar'
import AboutSection from './components/AboutSection'
import Footer from './components/Footer'
import EmailSection from './components/EmailSection'
import React from 'react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Navbar />

      <div className="container mt-24 mx-auto px-12 py-4">
        <HeroSection/>
        <AboutSection/>
        <EmailSection/>
      </div>

      {/* Contact Buttons */}
      <div id="contact-buttons" style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <a href="https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243" target="_blank" className="contact-button">
          <img
            src="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/linkedin.png"
            width="30"
            height="30"
            alt="LinkedIn"
          />
        </a>
        <a href="https://github.com/Ciaranengelbrecht" target="_blank" className="contact-button">
          <img
            src="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/github.png"
            width="30"
            height="30"
            alt="GitHub"
          />
        </a>
      </div>

      <Footer />
    </main>
  )
}
