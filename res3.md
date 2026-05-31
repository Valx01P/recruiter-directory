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
\titlespacing*{\section}{0pt}{10pt}{5pt}

\setlist[itemize]{leftmargin=1.6em, itemsep=2pt, topsep=1.5pt, parsep=0pt, after=\vspace{2pt}}

\newcommand{\entry}[3]{%
  \vspace{4pt}\needspace{4\baselineskip}
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
\fontsize{10.5}{13.2}\selectfont

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
  \item Led the testing strategy for NVIDIA GPU Cloud (NGC) web apps in Next.js and TypeScript so new releases stayed reliable for users.
  \item Created component tests for the dashboards and inventory pages with Vitest and React Testing Library, end-to-end app-flow tests with Playwright, and integration tests confirming the frontend worked with NGC's REST API.
  \item Built a reusable project template with CI/CD built in so any team could launch a new NGC app quickly.
\end{itemize}

\entry{Software \& AI Contributor}{ at CodeCrunch, Remote}{Sept. 2025 to Present}
\begin{itemize}
  \item Redesigned an education platform's website, migrating a messy HTML, CSS, and JavaScript codebase to Next.js and merging 8 projects into one so it was easier to maintain and scale.
  \item Built the education platform's backend in Node.js and Express to serve the data and APIs the site runs on, so its features worked reliably for users.
  \item Built the GitHub Actions CI/CD pipelines that test and deploy the code so releases went out safely with fewer errors.
  \item Created AI tools using OpenAI models to automate client research and marketing so non-technical clients could re-run them anytime.
  \item Led full-stack development with the founder, turning their ideas into working features quickly.
\end{itemize}

\entry{Software Engineer Intern}{ at NVIDIA, Santa Clara, CA}{May 2025 to Aug. 2025}
\begin{itemize}
  \item Built Bash and Terraform automation that set up each app's environment automatically, so engineers could run any of the 14+ apps locally with one command instead of by hand.
  \item Created preview environments for every app on Kubernetes with the infrastructure team, so engineers could test their changes on a real URL before launch.
  \item Developed shared Docker and CI/CD environments on AWS so the team built and tested on the same setup, coordinating in daily standups to hit weekly deliverables.
\end{itemize}

\entry{Tech Fellow}{ at CodePath, Miami, FL}{May 2024 to Apr. 2025}
\begin{itemize}
  \item Led a team of 3 to build Errorly, a React, Node.js, and Railway app where developers get help from other developers, managing the GitHub issues, branches, and code reviews so the team merged code safely.
  \item Completed 30 weeks of training in data structures, algorithms, and full-stack development, then mentored students for technical interviews.
\end{itemize}

\entry{Advanced Web Dev Team Member}{ at INIT Build, Miami, FL}{Oct. 2024 to Dec. 2024}
\begin{itemize}
  \item Built sign-up and login with Google OAuth and email-code verification using FastAPI and a Supabase (Postgres) database so users could create accounts and log in safely.
  \item Developed Ducky Pics, a full-stack Next.js app, and deployed it to Vercel with a team of 4 in 9 weeks, working together through GitHub.
\end{itemize}

%---------- PROJECTS ----------
\section{Projects}

\entry{CentPoll}{ --- Political Polling Platform}{2026}
\begin{itemize}
  \item Built the survey builder and voter outreach over text, voice calls, and the web with Node.js and Twilio so campaigns could reach voters on any channel.
  \item Developed a live results dashboard with WebSockets, Postgres, and AWS, plus secure per-client logins and Stripe billing, so clients watched results in real time and paid only for completed responses.
  \item Built AI agents on OpenAI with ElevenLabs voice cloning to automate voice and text outreach so a small team could reach far more people through automated Agentic workflows for political polling.
  \item Improved the product through weekly pollster feedback and brought on the first customers before launch.
\end{itemize}

\entry{PokerXYZ.io}{ --- Multiplayer Web Poker}{2026}
\begin{itemize}
  \item Built the real-time backend in Node.js with WebSockets to handle live game state, chat, rooms, and AI bot opponents so 30+ players always had a table, even when short-handed.
  \item Created the responsive design in Next.js and Tailwind with custom SVG card and chip art so private games and tournaments worked on any device.
\end{itemize}

\entry{Poker Robot}{ --- Card-Dealing Machine}{2026}
\begin{itemize}
  \item Built a Python and Flask server on an NVIDIA Jetson that connected a Next.js app to an Arduino and used computer vision to track cards, so the robot shuffled and dealt accurately on its own.
  \item Created a physical robot that shuffled, sorted, and dealt real cards so everyone at the table could focus on the game with no human dealer.
\end{itemize}

\entry{Cozy Soul}{ --- Home Rental Site}{2025}
\begin{itemize}
  \item Built location-based listings, search, and posting forms in Next.js and TypeScript with the Google Maps API so travelers could find rentals by area.
  \item Created sign-up and login with Google OAuth, kept sessions safe with HTTP-only cookies, and added email through Resend so accounts and notifications worked reliably.
  \item Developed it with a teammate from weekly client feedback so the client could take bookings directly and avoid third-party platform fees.
\end{itemize}

\entry{Theoretical Stock Plays}{ --- Stock Simulation Tool}{2024}
\begin{itemize}
  \item Built a Next.js and TypeScript tool that modeled stock plays so users could weigh risk and reward before buying stock assets, made use of Zustand to manage changing simulation state and data.
  \item Created interactive charts from live Polygon.io API data so users could calculate the risk of a stock purchase with a simulation based on real-time stock prices, used for creating investment strategies.
\end{itemize}

\entry{General Planner}{ --- Full-Stack Planner}{2023}
\begin{itemize}
  \item Built and deployed a full-stack MERN planner with Redux and a REST API so users could plan, organize their tasks, and have them persist in our MongoDB NoSQL database for future access.
  \item Developed it with an MVC structure and role-based access control (RBAC) so each user's tasks stayed private.
\end{itemize}

\end{document}