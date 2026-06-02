// Shared data shapes for recruiter.json. Used by the UI, the embedding scripts,
// and the semantic-search route handler so the schema lives in exactly one place.

export interface Recruiter {
  name: string;
  title: string;
  linkedin_url: string;
  email: string;
  location: string;
  focus_area: string;
  connected: boolean;
  messaged: boolean;
  responded: boolean;
  date_contacted: string;
  notes: string;
}

export interface Company {
  id: string;
  name: string;
  category: string;
  sector: string;
  description: string;
  hq_location: string;
  priority: 1 | 2 | 3;
  size_estimate: string;
  company_url?: string;
  early_career_programs?: string;
  application_timeline?: string;
  visa_sponsorship?: string;
  recent_internship_signal?: string;
  opportunity_notes?: string;
  has_intern_program: boolean;
  linkedin_company_url: string;
  linkedin_url_verified: boolean;
  recruiter_search_url: string;
  careers_url: string;
  recruiters: Recruiter[];
}

export interface Meta {
  last_updated: string;
  total_companies: number;
  description?: string;
}

export interface JsonData {
  meta: Meta;
  companies: Company[];
}
