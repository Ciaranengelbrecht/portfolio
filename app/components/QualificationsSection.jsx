import { certifications, clearances, education } from "../data/portfolio";

const QualificationsSection = () => (
  <section className="site-section bg-[#161714]" aria-labelledby="qualifications-heading">
    <div className="site-shell grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
      <div>
        <p className="section-label">Qualifications</p>
        <h2 id="qualifications-heading" className="section-title">Education and credentials.</h2>
        <div className="mt-10 border-b border-[#3a3934]">
          {education.map((item) => (
            <article key={item.qualification} className="border-t border-[#3a3934] py-6">
              <p className="text-xs font-semibold text-[#c69262]">{item.year}</p>
              <h3 className="mt-2 font-editorial text-xl text-[#eeeae2] sm:text-2xl">{item.qualification}</h3>
              <p className="mt-1 text-sm text-[#99968f]">{item.institution}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="lg:pt-10">
        <div className="border-t border-[#3a3934] py-7">
          <h3 className="font-editorial text-2xl text-[#eeeae2]">Certifications</h3>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {certifications.map((certification) => (
              <li key={certification} className="border-l border-[#76573e] pl-4 text-sm leading-6 text-[#b5b1a9]">
                {certification}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border-t border-[#3a3934] py-7">
          <h3 className="font-editorial text-2xl text-[#eeeae2]">Clearances and training</h3>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-[#aaa79f]">
            {clearances.map((clearance) => (
              <li key={clearance} className="grid grid-cols-[12px_1fr] gap-3">
                <span className="mt-[0.8rem] h-px w-3 bg-[#806044]" aria-hidden="true" />
                <span>{clearance}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default QualificationsSection;
