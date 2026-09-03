import { profile } from "../data/portfolio";

const principles = [
  "Calm, clear support for technical and non-technical users",
  "Structured troubleshooting from the physical layer through to the application",
  "Documentation and automation that make good outcomes repeatable",
];

const AboutSection = () => (
  <section id="about" className="site-section bg-[#161714]">
    <div className="site-shell grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
      <header>
        <p className="section-label">Profile</p>
        <h2 className="section-title">Practical ICT, thoughtfully delivered.</h2>
      </header>

      <div>
        <div className="max-w-2xl space-y-6 font-editorial text-[1.55rem] leading-[1.45] text-[#d7d3cb] sm:text-[1.85rem]">
          {profile.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-12 border-t border-[#3a3934] pt-7">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#99968f]">How I work</p>
          <ul className="grid gap-5 text-sm leading-7 text-[#bdb9b1] sm:grid-cols-3 sm:gap-7">
            {principles.map((principle) => (
              <li key={principle} className="border-l border-[#76573e] pl-4">
                {principle}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default AboutSection;
