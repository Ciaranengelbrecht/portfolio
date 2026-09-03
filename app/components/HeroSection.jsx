import Image from "next/image";
import Link from "next/link";
import { contactLinks, profile, resumeHref } from "../data/portfolio";

const basePath = process.env.DEPLOY_ENV === "CUSTOM_DOMAIN" ? "" : "/portfolio";

const HeroSection = () => (
  <section id="home" className="hero-section">
    <span id="about" className="anchor-target" aria-hidden="true" />
    <div className="site-shell hero-layout">
      <div className="hero-copy">
        <p className="role-label">{profile.discipline}</p>
        <h1>{profile.name}</h1>
        <p className="location-label">{profile.location}</p>
        <div className="hero-summary">
          <p>{profile.summary}</p>
          <p>{profile.detail}</p>
        </div>
        <div className="hero-links" aria-label="Profile links">
          <Link href={resumeHref} target="_blank" rel="noopener noreferrer">CV</Link>
          {contactLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="portrait-wrap">
        <Image
          src={`${basePath}/images/portrait.webp`}
          alt="Ciaran Engelbrecht"
          fill
          priority
          sizes="(max-width: 700px) 184px, 272px"
          className="portrait-image"
        />
      </div>
    </div>
  </section>
);

export default HeroSection;
