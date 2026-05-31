%-------------------------
% Resume - Pablo Valdes
%------------------------
\documentclass[letterpaper]{article}

\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}
\usepackage[top=0.6in,bottom=0.6in,left=0.7in,right=0.7in]{geometry}
\usepackage{enumitem}
\usepackage{anyfontsize}
\usepackage[hidelinks]{hyperref}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{tabularx}
\usepackage{needspace}
\input{glyphtounicode}
\pdfgentounicode=1
\pagestyle{empty}
\raggedright
\setlength{\parindent}{0pt}

\titleformat{\section}{\fontsize{12}{14}\bfseries}{}{0em}{}[\vspace{2pt}\titlerule]
\titlespacing*{\section}{0pt}{9pt}{4pt}

\setlist[itemize]{leftmargin=1.6em, itemsep=1.5pt, topsep=1.5pt, parsep=0pt, after=\vspace{2pt}}

\newcommand{\entry}[3]{%
  \vspace{3pt}\needspace{4\baselineskip}
  \begin{tabular*}{\textwidth}{@{}l@{\extracolsep{\fill}}r@{}}
    \textbf{#1}#2 & \textit{#3} \\
  \end{tabular*}\par\vspace{1pt}}

\begin{document}

%---------- HEADER ----------
\begin{center}
  {\fontsize{18}{21}\selectfont\bfseries Pablo Valdes}\\[4pt]
  {\fontsize{10.5}{13}\selectfont 786-346-0791 ~$|$~ \href{mailto:pablovaldes0925@gmail.com}{pablovaldes0925@gmail.com} ~$|$~ \href{https://pablovaldes.com}{pablovaldes.com}}\\[3pt]
  {\fontsize{10.5}{13}\selectfont \href{https://github.com/Valx01P}{github.com/Valx01P} ~$|$~ \href{https://linkedin.com/in/pablovaldes01}{linkedin.com/in/pablovaldes01} ~$|$~ Miami, FL}
\end{center}

\vspace{6pt}
\fontsize{10.5}{12.6}\selectfont

%---------- EDUCATION ----------
\section{Education \& Certificates}
\begin{itemize}
  \item B.S. in Computer Science from Florida International University \hfill Expected Apr. 2027 \,\textbar\, GPA 3.76
  \item A.A. in Computer Science from Miami Dade College \hfill Graduated Dec. 2024 \,\textbar\, GPA 3.81
\end{itemize}

%---------- WORK HISTORY ----------
\section{Work History}

\entry{Software Engineer Intern}{ at NVIDIA, Santa Clara, CA}{May 2026 to Present}
\begin{itemize}
  \item Led the testing strategy across multiple Next.js and TypeScript NGC (NVIDIA GPU Cloud) repositories, writing unit, integration, end-to-end, and visual regression (VRT) suites with Vitest, React Testing Library, and Playwright that cover components, dashboards, layouts, hooks, and API routes, coordinating weekly with the CI/CD and cloud DevOps teams so changes ship without breaking the product.
  \item Developing a standardized project scaffold with CI/CD pipelines built in so any team can spin up a new NGC cloud app quickly on shared patterns and tooling.
  \item Tracked work in Jira and GitLab merge requests, fixing UI bugs and code regressions while aligning with the team to keep releases on schedule.
  \item Returned to NVIDIA's NGC platform, partnering with multiple dev teams again to make shipping new cloud apps faster and more reliable.
\end{itemize}

\entry{Software \& AI Contributor}{ at CodeCrunch, Remote}{Sept. 2025 to Present}
\begin{itemize}
  \item Redesigned an education platform's web and mobile features end to end across Next.js, Node.js/Express, and iOS, shipping from requirements through deploy on Vercel so the client ships without an in-house dev team.
  \item Revamped the platform's entire website, migrating a messy HTML, CSS, and JavaScript codebase into a scalable Next.js architecture and consolidating 8 separate projects into one, making it mobile-responsive, consistent in UI/UX, and far easier to maintain.
  \item Hardened the GitHub Actions CI/CD pipelines to be more robust so builds ship safely with fewer errors.
  \item Build agentic AI pipelines on OpenAI to automate client research and marketing, packaged as repeatable workflows non-technical clients re-run on demand.
  \item Led full-stack development in direct one-on-one collaboration with the founder, turning requirements into shipped features fast.
\end{itemize}

\entry{Software Engineer Intern}{ at NVIDIA, Santa Clara, CA}{May 2025 to Aug. 2025}
\begin{itemize}
  \item Shipped login UI and auth-flow across 14+ repositories in Next.js, TypeScript, and Tailwind so developers could securely sign in to the NGC platform, landing changes with engineers by sprint deadlines.
  \item Rolled out Flox and built the Docker images behind it, with matching GitLab CI/CD jobs and Kubernetes updates alongside the DevOps team, keeping local, pipeline, and deploy environments identical so builds stopped breaking from drift.
  \item Deployed a shared pre-staging ``dev'' environment on AWS for local and CI/CD use so the team could test against real services before production, speeding up debugging and testing and shortening commit-to-deploy.
  \item Coordinated in daily standups with infrastructure and backend contributors to land changes across the NGC platform on schedule.
\end{itemize}

\entry{Tech Fellow}{ at CodePath, Miami, FL}{May 2024 to Apr. 2025}
\begin{itemize}
  \item Led a team of 3 to ship Errorly, a React, Node.js, and Railway platform where developers debug apps and get bug help from other devs, managing the GitHub Issues workflow, branching strategy, and code reviews so the team merged safely.
  \item Completed 30 weeks of team-based training in data structures, algorithms, and full-stack web development, then stayed on to mentor students for technical interviews.
\end{itemize}

\entry{Advanced Web Dev Team Member}{ at INIT Build, Miami, FL}{Oct. 2024 to Dec. 2024}
\begin{itemize}
  \item Built Google OAuth and email-code verification end to end with secure FastAPI routes over a Supabase (Postgres) database and full error handling so users could sign up and log in safely.
  \item Shipped Ducky Pics, a full-stack Next.js app, to Vercel with a team of 4 in 9 weeks from spec to deploy, collaborating through GitHub in daily and weekly coding sessions.
\end{itemize}

%---------- PROJECTS ----------
\section{Projects}

\entry{CentPoll}{ --- Political Polling Platform (Co-founder)}{2026}
\begin{itemize}
  \item Built the survey builder, voter targeting, and outreach across text, phone, automated voice (IVR), and web on Node.js and Twilio so campaigns reach voters wherever they answer.
  \item Streamed live results to a real-time WebSocket dashboard on Postgres and AWS (S3, CloudFront), with secure JWT logins, a separate workspace per client, and Stripe billing per completed response, so clients track polling live and pay only for results.
  \item Built multi-agent AI workflows on OpenAI with ElevenLabs voice cloning to run mass polling that generates personalized voice and text outreach, assists poll creation, and flags issues in reports, so a small team can survey far more people with less manual work.
  \item Co-founded the platform, meeting weekly with pollsters to shape features around their real use cases.
\end{itemize}

\entry{PokerXYZ.io}{ --- Multiplayer Web Poker}{2026}
\begin{itemize}
  \item Built the real-time backend in Node.js with WebSockets driving live game state, chat, rooms, and AI bot opponents so 30+ players always have a live table to join, even short-handed.
  \item Designed a fully responsive UI in Next.js and Tailwind with custom SVG card and chip assets so private games and tournaments can run digitally and cleanly on any device.
\end{itemize}

\entry{Poker Robot}{ --- Card-Dealing Machine}{2026}
\begin{itemize}
  \item Ran a Flask server in Python on an NVIDIA Jetson Orin Nano bridging a Next.js frontend and Arduino over serial, using computer vision to track cards for controlled shuffles and per-player dealing so every hand is dealt accurately without manual handling.
  \item Built a physical robot that shuffles, sorts, and deals real playing cards so everyone at the table can focus on the game without needing a human dealer present.
\end{itemize}

\entry{Cozy Soul}{ --- Home Rental Site}{2025}
\begin{itemize}
  \item Built location-based listings, search, and multi-step posting forms in Next.js and TypeScript with the Google Maps API so hosts post rentals and travelers find them by area.
  \item Secured accounts with Google OAuth, JWT, and HTTP-only cookies and wired transactional email through Resend so sign-up and notifications worked reliably.
  \item Built the site with a teammate, meeting the client weekly to scope features, so they could take bookings directly and skip third-party platform fees.
\end{itemize}

\entry{Theoretical Stock Plays}{ --- Stock Simulation Tool}{2024}
\begin{itemize}
  \item Built a tool in Next.js and TypeScript that models stock plays from user-defined actions so users can weigh the risk and potential reward before committing real money.
  \item Pulled live price data from the Polygon.io API to render interactive charts that assist in risk assessment for real-time stock purchases.
\end{itemize}

\entry{General Planner}{ --- Full-Stack Planner}{2023}
\begin{itemize}
  \item Developed and deployed a full-stack planner on the MERN stack (MongoDB, Express, React, Node) with Redux, a RESTful API, and full CRUD support so users can plan and organize their tasks.
  \item Structured the app with MVC architecture and secured it with auth routes and role-based access control (RBAC) so each user's tasks stay private.
\end{itemize}

\end{document}