import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy & Opt-Out — Tech Recruiter Directory",
  description:
    "How this directory uses publicly available recruiter information, and how to request removal of your name from the list.",
};

const CONTACT_EMAIL = "pablovaldes0925@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto w-full px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to directory
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Privacy &amp; Opt-Out Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated June 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">What this is</h2>
          <p>
            The Tech Recruiter Directory is a personal, non-commercial tool built to help with
            internship and early-career job outreach. It lists companies along with the names,
            job titles, and public LinkedIn profile links of recruiters and university/early-career
            staff who work there.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Where the information comes from</h2>
          <p>
            All recruiter information in this directory is collected from publicly available
            sources — primarily public LinkedIn profiles and public web searches — and curated by
            hand. No private, confidential, or contact details (such as personal email addresses or
            phone numbers) are stored or published here. The directory does not scrape private data
            and is not affiliated with, endorsed by, or sponsored by any company or by LinkedIn.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">How information is used</h2>
          <p>
            The listing exists solely to make it easier to find the right person to contact about
            internships and early-career roles. Connection-tracking checkboxes are stored in your
            own browser (and, if you sign in, in your private account) — that data is yours and is
            never shared or published.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100" id="opt-out">
            Opt out — remove your name
          </h2>
          <p>
            If you are listed in this directory and would like your name and details removed, you
            can opt out at any time, no questions asked. Email the address below and include the
            name and, if possible, the company or LinkedIn profile link as it appears in the
            directory so it can be located quickly.
          </p>
          <p>
            Removal requests are honored promptly — typically within a few days of receiving the
            request — and once removed, the entry will not be re-added.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Opt-out%20request%20%E2%80%94%20Tech%20Recruiter%20Directory`}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black px-4 h-10 text-sm font-medium hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            {CONTACT_EMAIL}
          </a>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Questions</h2>
          <p>
            For any privacy questions or other requests, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
