export const profile = {
  name: "Ciaran Engelbrecht",
  discipline: "ICT support, systems & networks",
  location: "Perth, Western Australia",
  summary:
    "I'm an ICT professional and Computer Science graduate with 5+ years of experience in education, managed services and WA Government.",
  detail:
    "My work spans day-to-day IT support, systems and networks, security, and building tools that cut down on repetitive work.",
};

export const experience = [
  {
    period: "2026 — Present",
    role: "ICT Graduate — Data Analysis, Data Science & Application Development",
    organisation: "WA Health",
    overview: "Working with health data and developing an internal data platform.",
    achievements: [
      "Validated health data in Snowflake and SQL, checking joins, mappings and business rules to identify data-quality and transformation issues.",
      "Developed and documented platform features with FastAPI, React/TanStack and SQL, including authentication, role-based access, APIs and dashboards.",
      "Worked with technical and business stakeholders to clarify requirements, investigate issues and document changes using Git-based workflows.",
      "Supported SharePoint metadata design and large-list uploads to make information easier to organise and find.",
    ],
  },
  {
    period: "2025 — 2026",
    role: "ICT Graduate — Cyber Security",
    organisation: "Main Roads Western Australia",
    overview: "A cyber security rotation focused on identity, investigations and repeatable audit work.",
    achievements: [
      "Investigated sign-in and MFA issues with KQL in Microsoft Sentinel, correlating identity and endpoint activity with Defender XDR alerts.",
      "Reviewed privileged and guest accounts and group memberships, and automated account audits and evidence collection with PowerShell and Microsoft Graph.",
      "Built Power BI security and compliance reports from scripted datasets.",
      "Contributed to Essential Eight work through VBA signing, timestamp validation, phishing analysis, macro controls and endpoint compliance checks.",
      "Wrote technical procedures, risk-assessment templates and governance documentation for repeatable reviews.",
    ],
  },
  {
    period: "2023 — 2025",
    role: "Junior IT Systems Engineer",
    organisation: "ITDynamics",
    overview: "Managed services and embedded Level 2 support for approximately 1,300 users.",
    achievements: [
      "Owned Level 2 incidents across Windows, macOS, iPadOS, Microsoft 365, school applications, printing, Wi-Fi and classroom technology.",
      "Administered Microsoft 365, Active Directory and Group Policy, covering onboarding, offboarding, permissions and application access. Managed Apple devices with Jamf and Apple School Manager.",
      "Troubleshot networks from cabling and switch ports through VLANs, DHCP/DNS and wireless authentication. Restored connectivity after switch failures and assisted with Aruba and Cisco deployments.",
      "Delivered annual staff and student device rollouts, from preparation and enrolment to testing and post-deployment support.",
      "Built Python and PowerShell PDF/OCR tools that reduced manual processing by approximately 90%, and automated recurring tasks with Power Automate.",
      "Used ConnectWise, IT Glue and Jira to track work and document fixes. Wrote user guides and technical procedures to improve self-service and escalation handovers.",
    ],
  },
  {
    period: "2021 — 2023",
    role: "IT Support Technician",
    organisation: "Catholic Education WA / Irene McCormack Catholic College",
    overview: "Onsite Level 1/2 support for approximately 1,000 staff and students.",
    achievements: [
      "Resolved account, device, software, printing and Wi-Fi issues, explaining fixes clearly and providing time-critical support for lessons, assessments and school events.",
      "Managed staff and student accounts in Active Directory, Microsoft 365 and SEQTA, including access, groups and new-starter onboarding.",
      "Prepared, deployed and repaired devices, including screen and battery replacements. Enrolled Apple devices through Jamf and maintained loan and asset records.",
      "Supported classroom AV, printing, Apple TV and Vivi across more than 50 teaching spaces, alongside first-line network troubleshooting.",
    ],
  },
];

export const capabilityGroups = [
  {
    title: "Support & ITSM",
    tools: "Onsite and remote Level 1/2 support, incident triage, escalation, documentation and asset management. ConnectWise, IT Glue and Jira; familiar with ServiceNow and Freshdesk.",
  },
  {
    title: "Microsoft & identity",
    tools: "Microsoft 365, Teams, SharePoint, OneDrive, Active Directory, Group Policy and Entra ID. Account administration, permissions, access reviews and MFA troubleshooting; working knowledge of Exchange Online.",
  },
  {
    title: "Endpoint management",
    tools: "Windows, macOS and iPadOS, with Jamf Pro, Jamf School and Apple School Manager. Imaging, enrolment, applications, profiles, compliance and device lifecycle management; familiar with Intune and SCCM.",
  },
  {
    title: "Networking & monitoring",
    tools: "Aruba/HPE and Cisco switches and access points, Aruba Central, Zabbix and Grafana. TCP/IP, DNS, DHCP, VLANs, Wi-Fi and VPN troubleshooting, from physical connections to endpoint configuration.",
  },
  {
    title: "Security & automation",
    tools: "Microsoft Sentinel, Defender XDR and KQL for investigations; Essential Eight, access reviews and audit evidence. Automation with PowerShell, Microsoft Graph, Power Automate, Python and Bash.",
  },
  {
    title: "Data & development",
    tools: "SQL, Snowflake, Power BI and Excel for data validation and reporting. FastAPI, Flask, React/TanStack and REST APIs for applications, with Git, GitHub and CI/CD workflows.",
  },
  {
    title: "Education & business systems",
    tools: "SEQTA, Edval, PaperCut, Adobe Admin Console, Fastvue and Oliver. Classroom AV and Vivi, telephony, CCTV, POS, and Microsoft Forms and Bookings.",
  },
];

export const education = [
  {
    year: "Expected 2027",
    qualification: "Certificate IV in Network and Cloud Security",
    institution: "North Metropolitan TAFE",
  },
  {
    year: "2025",
    qualification: "Bachelor of Science — Computer Science",
    institution: "University of Western Australia",
  },
  {
    year: "2020",
    qualification: "Bachelor of Science — Registered Nursing",
    institution: "Edith Cowan University",
  },
];

export const certifications = [
  "CompTIA Network+",
  "GitHub Foundations",
  "Snowflake Hands-on Essentials",
  "Cisco Introduction to Data Science",
];

export const clearances = [
  "Working with Children Check",
  "Current Australian Police Clearance",
  "CEWA mandatory reporting and child-protection training",
];

export const featuredProjects = [
  {
    title: "Macro Scanner",
    description: "Checks macro-enabled Office documents for suspicious patterns, with Microsoft Defender integration to support triage.",
    repository: "https://github.com/Ciaranengelbrecht/macro-scanner",
  },
  {
    title: "OCR Table Detection",
    description: "Finds tables in PDFs and images and turns their contents into structured data.",
    repository: "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
  },
  {
    title: "LiftLog",
    description: "A training tracker built for use on a phone, with offline logging, data synchronisation and recovery.",
    repository: "https://github.com/Ciaranengelbrecht/portfolio",
    demo: "https://ciaranengelbrecht.com/progress",
  },
  {
    title: "TaskHub",
    description: "A shared task manager with user accounts and team collaboration.",
    repository: "https://github.com/Ciaranengelbrecht/CITS3403-TaskHub-Web-Project",
    demo: "https://taskhub.ciaranengelbrecht.com",
  },
  {
    title: "Network Server Engine",
    description: "A networking project exploring TCP/IP, socket programming and handling concurrent connections.",
    repository: "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
  },
  {
    title: "PDF Subject Splitter",
    description: "Splits large PDF documents into smaller files using subject markers.",
    repository: "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
  },
];

export const contactLinks = [
  { label: "Email", href: "mailto:ciaran.engelbrecht@outlook.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243" },
  { label: "GitHub", href: "https://github.com/Ciaranengelbrecht" },
];

const basePath = process.env.DEPLOY_ENV === "CUSTOM_DOMAIN" ? "" : "/portfolio";
export const resumeHref = `${basePath}/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf`;
