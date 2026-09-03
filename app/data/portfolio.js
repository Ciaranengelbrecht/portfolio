export const profile = {
  name: "Ciaran Engelbrecht",
  discipline: "ICT Support · Systems · Networks",
  location: "Perth, Western Australia",
  summary:
    "ICT professional and Computer Science graduate with 5+ years of hands-on experience across support, endpoint administration, networking, cyber security, data, and automation in education, managed services, and WA Government.",
  introduction: [
    "My background is grounded in practical ICT service: supporting people, devices, accounts, classrooms, networks, and the systems that keep day-to-day work moving.",
    "I also build scripts, reporting, and internal tools that remove repetitive work and make technical processes easier to operate, explain, and maintain.",
  ],
};

export const proofPoints = [
  { value: "5+ years", label: "hands-on ICT experience" },
  { value: "1,300 users", label: "largest supported environment" },
  { value: "50+ spaces", label: "classrooms and teaching areas" },
  { value: "~90%", label: "manual processing reduction" },
];

export const experience = [
  {
    period: "2026 — Present",
    role: "ICT Graduate — Data Analysis, Data Science & Application Development",
    organisation: "WA Health",
    overview: "Graduate placements across enterprise health data and internal application-platform delivery.",
    achievements: [
      "Validated Snowflake and SQL data across fact and dimension models, mappings, joins, source-to-target rules, and business logic.",
      "Developed and documented features for an internal governed data platform using FastAPI, React/TanStack, SQL, authentication, and role-based access.",
      "Supported SharePoint metadata design and large-list uploads to improve governance, discoverability, and structured information management.",
    ],
  },
  {
    period: "2025 — 2026",
    role: "ICT Graduate — Cyber Security",
    organisation: "Main Roads Western Australia",
    overview: "State government placement focused on identity, monitoring, governance, reporting, and automation.",
    achievements: [
      "Developed KQL queries in Microsoft Sentinel to investigate sign-ins, MFA issues, error codes, and success and failure trends alongside Defender XDR alerts.",
      "Reviewed privileged, guest, and group access to support least-privilege controls and stronger identity hygiene.",
      "Built Power BI security reporting and automated account audits and evidence collection with PowerShell and Microsoft Graph.",
    ],
  },
  {
    period: "2023 — 2025",
    role: "Junior IT Systems Engineer",
    organisation: "ITDynamics",
    overview: "Managed-services role progressing from remote service desk to embedded Level 2 support for approximately 1,300 users.",
    achievements: [
      "Owned Level 2 incidents across mixed endpoints, Microsoft 365, education systems, printing, Wi-Fi, classroom AV, telephony, and CCTV.",
      "Administered Microsoft 365, Active Directory, Group Policy, Jamf Pro, Jamf School, Apple School Manager, permissions, and device lifecycles.",
      "Diagnosed connectivity from cabling and link state through switch ports, VLANs, DHCP/DNS, wireless coverage, authentication, and endpoint configuration.",
      "Built Python and PowerShell PDF/OCR tooling that reduced manual processing by approximately 90%, alongside Power Automate workflows.",
    ],
  },
  {
    period: "2021 — 2023",
    role: "IT Support Technician",
    organisation: "Catholic Education WA / Irene McCormack Catholic College",
    overview: "Onsite Level 1/2 support for approximately 1,000 staff and students across a 1:1 device environment and 50+ teaching spaces.",
    achievements: [
      "Resolved account, endpoint, software, printing, Wi-Fi, and classroom-technology issues while explaining solutions clearly to non-technical users.",
      "Created accounts and supported device imaging, enrolment, deployment, repair, application profiles, and asset records across Windows, Mac, and iPad fleets.",
      "Provided time-critical AV and network support for lessons, assessments, meetings, and school events, escalating clear diagnostic evidence when required.",
    ],
  },
];

export const capabilityGroups = [
  {
    title: "ICT support & service delivery",
    description:
      "Level 1/2 onsite, remote, and walk-in support with practical triage, prioritisation, escalation, documentation, and clear user communication.",
    tools: "ConnectWise, IT Glue, Jira, ServiceNow familiarity, asset and knowledge management",
  },
  {
    title: "Microsoft, identity & endpoints",
    description:
      "Administration and troubleshooting across Microsoft services, accounts, permissions, security groups, mixed-device fleets, deployment, and lifecycle management.",
    tools: "Microsoft 365, Active Directory, Group Policy, Entra ID, Windows, macOS, iPadOS, Jamf, Intune familiarity",
  },
  {
    title: "Networks & infrastructure",
    description:
      "Physical-to-endpoint diagnosis covering addressing, switching, wireless, authentication, cabling, patching, port configuration, and infrastructure deployment.",
    tools: "Aruba Central, Aruba/HPE, Cisco, TCP/IP, DNS, DHCP, ARP, VLANs, Wi-Fi, VPN, Zabbix, Grafana",
  },
  {
    title: "Security & automation",
    description:
      "Security-aware operations, identity monitoring, access review, audit evidence, reporting, and repeatable automation for routine technical work.",
    tools: "Microsoft Sentinel, Defender XDR, KQL, Essential Eight, PowerShell, Microsoft Graph, Power Automate, Python, Bash",
  },
  {
    title: "Data & application development",
    description:
      "Applied development experience used to validate data, build internal tools and APIs, and deliver maintainable workflow improvements.",
    tools: "SQL, Snowflake, Power BI, FastAPI, Flask, React, TanStack, REST APIs, Git, CI/CD concepts",
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
    category: "Security & automation",
    description:
      "A practical triage utility for macro-enabled Office documents, combining heuristic analysis, Defender integration, and browser-based batch processing.",
    technologies: "JavaScript · Python · PowerShell · Microsoft Defender",
    repository: "https://github.com/Ciaranengelbrecht/macro-scanner",
  },
  {
    title: "OCR Table Detection",
    category: "Document automation",
    description:
      "A document-processing tool that detects tables in PDFs and images and converts repetitive manual handling into structured outputs.",
    technologies: "Python · OpenCV · Tesseract",
    repository: "https://github.com/Ciaranengelbrecht/OCR-Table-Detection-and-PDF-conversion-Project",
  },
  {
    title: "LiftLog",
    category: "Product development",
    description:
      "An offline-first training tracker with local data handling, guided setup, synchronisation, recovery workflows, and a mobile-focused interface.",
    technologies: "React · TypeScript · Vite · IndexedDB · PWA",
    repository: "https://github.com/Ciaranengelbrecht/portfolio",
    demo: "https://ciaranengelbrecht.com/progress",
  },
  {
    title: "TaskHub",
    category: "Full-stack application",
    description:
      "A collaborative task-management platform with authentication, team workflows, and a structured interface for shared work.",
    technologies: "Python · Flask · JavaScript · SQLite",
    repository: "https://github.com/Ciaranengelbrecht/CITS3403-TaskHub-Web-Project",
    demo: "https://taskhub.ciaranengelbrecht.com",
  },
  {
    title: "Network Server Engine",
    category: "Networking & systems",
    description:
      "A custom network-server project exploring TCP/IP concepts, socket programming, and concurrent connection handling.",
    technologies: "C · POSIX sockets · TCP/IP",
    repository: "https://github.com/Ciaranengelbrecht/Networking-Server-Project",
  },
  {
    title: "PDF Subject Splitter",
    category: "Workflow automation",
    description:
      "A focused utility that splits large PDF documents using subject markers to simplify recurring document-organisation work.",
    technologies: "Python · PyPDF2",
    repository: "https://github.com/Ciaranengelbrecht/subject-selection-splitter",
  },
];

export const archivedProjects = [
  { title: "Super Mario ML Speedrun", category: "Machine learning", repository: "https://github.com/Ciaranengelbrecht/Super-Mario-Bros-ML-AI-Speedrun" },
  { title: "Ontology Knowledge System", category: "Semantic web", repository: "https://github.com/Ciaranengelbrecht/CITS3005-Ontology-Project" },
  { title: "Document OCR Pipeline", category: "Computer vision", repository: "https://github.com/Ciaranengelbrecht/CITS3200-OCR-Project" },
  { title: "Systems Programming Suite", category: "Systems programming", repository: "https://github.com/Ciaranengelbrecht/Systems-Programming" },
  { title: "Data Structures & Algorithms", category: "Algorithms", repository: "https://github.com/Ciaranengelbrecht/Data-Structures-and-Algorithms" },
  { title: "AI Agents & Search", category: "Artificial intelligence", repository: "https://github.com/Ciaranengelbrecht/Algorithms-Agents-and-AI" },
  { title: "Car Park System", category: "Web application", repository: "https://github.com/Ciaranengelbrecht/Car-Park-System" },
  { title: "3D Graphics Engine", category: "Graphics", repository: "https://github.com/Ciaranengelbrecht/CITS3003_Project_Gaphics-and-Animation" },
  { title: "File Duplicate Detector", category: "Systems utility", repository: "https://github.com/Ciaranengelbrecht/C-File-Duplicate-Detector" },
  { title: "Java Akari Puzzle", category: "Algorithms", repository: "https://github.com/Ciaranengelbrecht/Java-Akari-Puzzle" },
];

export const contactLinks = [
  { label: "Email", value: "ciaran.engelbrecht@outlook.com", href: "mailto:ciaran.engelbrecht@outlook.com" },
  { label: "LinkedIn", value: "Professional profile", href: "https://www.linkedin.com/in/ciaran-engelbrecht-9a0914243" },
  { label: "GitHub", value: "Projects and source code", href: "https://github.com/Ciaranengelbrecht" },
];

export const resumeHref = "/images/Curriculum Vitae - Ciaran Engelbrecht website.pdf";
