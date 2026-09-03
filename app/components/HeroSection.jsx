import Link from "next/link";
import Image from "next/image";
import { profile, proofPoints, resumeHref } from "../data/portfolio";

const basePath = process.env.DEPLOY_ENV === "CUSTOM_DOMAIN" ? "" : "/portfolio";

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const HeroSection = () => (
  <section id="home" className="relative overflow-hidden border-b border-[#302f2b] bg-[#10110f] pt-20 sm:pt-24">
    <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1240px] items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-10 lg:py-24">
      <div className="hero-intro relative z-10 max-w-3xl">
        <p className="mb-7 text-xs font-semibold uppercase tracking-[0.22em] text-[#c69262] sm:text-sm">
          {profile.discipline}
        </p>
        <h1 className="font-editorial text-[clamp(3.3rem,8vw,7rem)] leading-[0.9] tracking-[-0.045em] text-[#f1eee7]">
          Ciaran
          <span className="block italic text-[#c9c5bd]">Engelbrecht</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-[#c9c5bd] sm:text-xl sm:leading-9">
          {profile.summary}
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="#experience" className="editorial-button editorial-button-primary">
            View experience
            <ArrowIcon />
          </Link>
          <Link href={resumeHref} target="_blank" rel="noopener noreferrer" className="editorial-button">
            Download CV
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#302f2b] pt-5 text-sm text-[#99968f]">
          <span>{profile.location}</span>
          <a href="mailto:ciaran.engelbrecht@outlook.com" className="text-link">
            ciaran.engelbrecht@outlook.com
          </a>
        </div>
      </div>

      <div className="hero-portrait relative mx-auto w-full max-w-[530px] lg:mx-0 lg:justify-self-end">
        <div className="absolute -left-5 -top-5 h-24 w-px bg-[#c69262] sm:-left-7 sm:-top-7" />
        <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe8e1]">
          <Image
            src={`${basePath}/images/portrait.webp`}
            alt="Ciaran Engelbrecht"
            fill
            priority
            sizes="(max-width: 1024px) 90vw, 42vw"
            className="object-cover object-[center_18%] transition-transform duration-700 ease-out hover:scale-[1.015]"
          />
        </div>
        <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full border border-[#4b4036] sm:-bottom-6 sm:-right-6" />
      </div>
    </div>

    <div className="mx-auto grid max-w-[1240px] grid-cols-2 border-x border-t border-[#302f2b] md:grid-cols-4">
      {proofPoints.map((point, index) => (
        <div
          key={point.label}
          className={`border-b border-[#302f2b] px-5 py-6 sm:px-7 sm:py-7 md:border-b-0 md:border-r md:last:border-r-0 ${index % 2 === 0 ? "border-r" : ""}`}
        >
          <p className="font-editorial text-2xl text-[#f1eee7] sm:text-3xl">{point.value}</p>
          <p className="mt-1 text-xs leading-5 text-[#99968f] sm:text-sm">{point.label}</p>
        </div>
      ))}
    </div>
  </section>
);

export default HeroSection;
