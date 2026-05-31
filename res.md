%-------------------------
% LaTeX Resume
% Author : Pablo Valdes
% License : MIT
%------------------------

\documentclass[letterpaper,9pt]{extarticle}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage[sfdefault]{FiraSans} % Use Fira Sans font
\usepackage{fontawesome5} % For icons
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins - tighter for more content
\addtolength{\oddsidemargin}{-0.6in}
\addtolength{\evensidemargin}{-0.6in}
\addtolength{\textwidth}{1.2in}
\addtolength{\topmargin}{-.75in}
\addtolength{\textheight}{1.6in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting - reduced spacing
\titleformat{\section}{
  \vspace{-10}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-7pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands - reduced spacing
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-3pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{0pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-8pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-8pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-8pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-5pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.12in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-6pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

%----------HEADING----------
\begin{center}
    \textbf{\huge Pablo Valdes} \\ \vspace{3pt}
    \small 786-346-0791 $|$ \href{mailto:pablovaldes0925@gmail.com}{\underline{pablovaldes0925@gmail.com}} $|$ \href{https://pablovaldes.com}{\underline{pablovaldes.com}} \\
    \vspace{2pt}
    \href{https://github.com/Valx01P}{\faGithub\ Valx01P} $|$ \href{https://linkedin.com/in/pablovaldes01}{\faLinkedin\ pablovaldes01} \\
    \vspace{3pt}
    \textit{\small Fullstack \& distributed systems engineer -- architecting cloud-native, large-scale software that ships rapidly and stays maintainable}
\end{center}

%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart

    \resumeSubheading
      {Florida International University}{Miami, FL}
      {Bachelor of Science in Computer Science, GPA: 3.76}{Jan. 2025 -- Apr. 2027}

    \resumeSubheading
      {Miami Dade College}{Miami, FL}
      {Associate of Arts in Computer Science, GPA: 3.81}{June 2023 -- Dec. 2024}

      \resumeItemListStart
        \resumeItem{Awards/Honors: ColorStack Vice President at FIU, INIT Exec Board, CodeIn MDC Founder, MLT Fellow, CodePath E3 Program, SharkByte Hackathon Web Lead, Google Developer Group Vice President at FIU}
        \resumeItem{Relevant Coursework: C++ Programming, Java Programming 2, Discrete Mathematics, Statistical Methods, Data Structures \& Algorithms, Programming Languages, Systems Programming, Computer Architecture, Deep Learning, Blockchain Technology}
      \resumeItemListEnd

  \resumeSubHeadingListEnd

%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {Software Engineer Intern (Returning)}{May 2026 -- Aug. 2026}
      {NVIDIA}{Santa Clara, CA}
      \resumeItemListStart
        \resumeItem{Owned testing strategy across multiple NGC cloud repos -- authored unit, integration, E2E, \newline and visual regression (VRT) suites to harden release confidence and cut regressions across our frontend surface}
        \resumeItem{Built a scalable, standardized scaffold for spinning up new NGC apps, \newline accelerating fullstack delivery across the team and enforcing shared patterns out of the box}
        \resumeItem{Drove a multi-repo effort spanning cloud infrastructure (AWS), backend services (Spring Boot), \newline and frontend (Next.js) to align tooling, CI gates, and deployment paths}
      \resumeItemListEnd

    \resumeSubheading
      {Software Engineer Intern}{May 2025 -- Aug. 2025}
      {NVIDIA}{Santa Clara, CA}
      \resumeItemListStart
        \resumeItem{Shipped frontend features across 14+ NGC repos in Next.js, TypeScript, and Tailwind, \newline partnering with infra and backend teams to land changes end-to-end}
        \resumeItem{Rolled out Flox across the frontend NGC repos alongside companion CI/CD jobs \newline and Kubernetes updates, keeping local, pipeline, and deploy environments in sync}
        \resumeItem{Designed and stood up a pre-staging 'dev' environment for local and CI/CD use within NGC, \newline unblocking iteration speed and tightening the path from commit to deploy}
      \resumeItemListEnd

    \resumeSubheading
      {Software \& AI Contributor}{Sept. 2025 -- Present}
      {CodeCrunch}{Remote}
      \resumeItemListStart
        \resumeItem{Lead fullstack development on CodeCrunch's new web applications (Next.js, Node.js/Express) and iOS mobile app, \newline partnering with Brian Bazurto (10K+ LinkedIn) on client engagements end-to-end for software consulting and development}
        \resumeItem{Architected agentic AI workflows for client research automation and marketing, productionizing repeatable pipelines}
      \resumeItemListEnd

    \resumeSubheading
      {CodePath Tech Fellow}{May 2024 -- Present}
      {CodePath}{Miami, FL}
      \resumeItemListStart
        \resumeItem{Completed 30 weeks of intensive team-based training in DSA \& full-stack web development}
        \resumeItem{Led peer sessions and mentored students through advanced DSA patterns and interview prep}
        \resumeItem{Led a team of 3 to ship Errorly, a full-stack app, owning GitHub Issues, branching strategy, and code reviews}
      \resumeItemListEnd

    \resumeSubheading
      {Advanced Web Dev Team Member}{Oct. 2024 -- Dec. 2024}
      {INIT Build Program}{Miami, FL}
      \resumeItemListStart
        \resumeItem{Shipped Ducky Pics, a full-stack app, with a team of 4 in 9 weeks from spec to deploy}
        \resumeItem{Built Google OAuth + email-code verification end-to-end and hardened the auth surface}
        \resumeItem{Owned frontend components and secure FastAPI backend routes with full error handling}
      \resumeItemListEnd

  \resumeSubHeadingListEnd

%-----------PROJECTS-----------
\section{Projects}
    \resumeSubHeadingListStart

      \resumeProjectHeading
          {\textbf{CentPoll} $|$ \emph{Next.js, Node.js, Postgres, WebSocket, AWS, OpenAI, Twilio, Vapi, Stripe}}{2026}
          \resumeItemListStart
            \resumeItem{Co-founded \href{https://centpoll.com}{CentPoll.com}, a political polling startup, with Lester Tellez (53K+ YouTube subs); \newline onboarding multiple pollsters waiting on the platform}
            \resumeItem{Architected a pay-per-completion polling pipeline: survey builder, voter targeting from an L2-style file, multi-channel delivery (SMS / voice / IVR / web), and a live WebSocket dashboard streaming completions}
            \resumeItem{Wired OpenAI, Twilio, Vapi + ElevenLabs, Stripe, Supabase pgvector (RAG), and AWS S3 + CloudFront; built multi-tenant workspaces, JWT sliding-refresh auth, and weighted analytics via iterative proportional fitting (raking)}
          \resumeItemListEnd

      \resumeProjectHeading
          {\textbf{PokerXYZ.io} $|$ \emph{Next.js, TypeScript, Tailwind CSS, Node.js, WebSockets}}{2026}
          \resumeItemListStart
            \resumeItem{Built a multiplayer web poker game at \href{https://pokerxyz.io}{pokerxyz.io} with public sprite sheets, custom SVG assets, and a fully responsive UI}
            \resumeItem{Owned the Node.js backend and WebSocket layer powering live game actions, chat, and rooms across Texas Hold'em rule sets}
          \resumeItemListEnd

      \resumeProjectHeading
          {\textbf{Poker Robot} $|$ \emph{Next.js, TypeScript, Flask, Arduino, CAD, Computer Vision}}{2026}
          \resumeItemListStart
            \resumeItem{Designed and built a custom poker robot capable of shuffling, rigging, and dealing physical cards}
            \resumeItem{Ran an NVIDIA Jetson Orin Nano as the on-device server bridging the frontend and Arduino serial control}
            \resumeItem{Implemented computer vision for rigged shuffles and per-player card dealing}
          \resumeItemListEnd

      \resumeProjectHeading
          {\textbf{SharkByte Hackathon} $|$ \emph{Next.js, TypeScript, Tailwind CSS}}{2025}
          \resumeItemListStart
            \resumeItem{Led full website development for SharkByte, a 300-person hackathon at Miami Dade College, owning frontend architecture and event branding}
            \resumeItem{Helped organize the event end-to-end alongside the MDC organizing team}
          \resumeItemListEnd

      \resumeProjectHeading
          {\textbf{Practical Synth Theme} $|$ \emph{VS Code Extension}}{2024}
          \resumeItemListStart
            \resumeItem{Authored and published a custom VS Code theme with \href{https://marketplace.visualstudio.com/items?itemName=PabloValdes019.practical-synth}{2000+ installs on the Marketplace}}
          \resumeItemListEnd

    \resumeSubHeadingListEnd

%-----------PROGRAMMING SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: JavaScript, TypeScript, Python, Java, C++, SQL} \\
     \textbf{Frameworks}{: Next.js, React.js, Express.js, Node.js, FastAPI, Java Spring Boot, Flask} \\
     \textbf{Libraries}{: Tailwind CSS, Shadcn, Bootstrap, Redux, Zustand, Prisma, GSAP} \\
     \textbf{Databases \& Storage}{: PostgreSQL, MongoDB, Redis, Supabase, pgvector, Vector Embeddings, AWS S3, AWS RDS, Railway} \\
     \textbf{AI \& Integrations}{: OpenAI, Agentic AI, MCPs, RAG, AI Image/Video Generation, LoRA Fine-tuning, ElevenLabs, Vapi, Twilio (SMS/Voice), Stripe, Resend} \\
     \textbf{DevOps \& Cloud}{: Docker, Kubernetes, Terraform, IaC, GitLab CI/CD, AWS (EC2, RDS, S3, CloudFront, Route 53, IAM, VPC), GCP (Agent Development Kit / ADK, persistent agentic AI systems), Vercel, VMs, Shell Scripting, Automations, DNS} \\
     \textbf{Testing \& Tools}{: Jest, Vitest, Playwright, Cypress, Visual Regression Testing (VRT), Postman, SonarQube, Git, Figma} \\
    }}
 \end{itemize}

\end{document}