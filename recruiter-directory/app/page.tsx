"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search, ExternalLink, Users, Calendar, Download,
  ArrowUpDown, X, ChevronDown, ChevronUp, Copy, Check, Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { gsap } from 'gsap';

import type { Company, JsonData } from '../lib/types';
import { SECTORS, sectorsForCompany } from '../lib/sectors';

// Load the data (bundled at build)
import rawData from '../data/recruiter.json';

const data = rawData as JsonData;
const allCompanies: Company[] = data.companies;
const meta = data.meta;

const PRIORITY_LABELS = {
  1: "Top Target",
  2: "Strong",
  3: "Stretch",
};

const CONNECTED_KEY = "rd-connected-v1";
const VIEW_KEY = "rd-view-v2";
const SIM_KEY = "rd-sim-threshold-v1";
const recKey = (companyId: string, idx: number) => `${companyId}#${idx}`;

type ConnectionFilter = "all" | "incomplete" | "complete" | "untouched";
type ViewMode = "cards" | "compact";

export default function RecruiterDirectory() {
  // `searchInput` is what the user types; `searchQuery` is the debounced value
  // that actually drives filtering, so we don't re-scan on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<Set<number>>(new Set([1, 2, 3]));
  const [sortMode, setSortMode] = useState<"recruiters" | "priority" | "name">("recruiters");
  const [sortReversed, setSortReversed] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>("all");
  const [hideConnected, setHideConnected] = useState(false);
  const [view, setView] = useState<ViewMode>("compact");
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "cards" || v === "compact") setView(v);
    } catch {}
  }, []);
  const changeView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  };

  // Connection tracking — set of `${companyId}#${idx}` keys, persisted locally.
  const [connected, setConnected] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONNECTED_KEY);
      if (raw) setConnected(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  const persist = (s: Set<string>) => {
    try { localStorage.setItem(CONNECTED_KEY, JSON.stringify([...s])); } catch {}
  };

  const toggleRecruiter = useCallback((key: string) => {
    setConnected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  // Clicking a recruiter's name/Message link opens their LinkedIn to connect, so
  // auto-mark them connected (idempotent — never un-marks). Stored locally.
  const markConnected = useCallback((key: string) => {
    setConnected(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      persist(next);
      return next;
    });
  }, []);

  // Debounce the search input (180ms). Clearing is applied immediately.
  useEffect(() => {
    if (searchInput === "") { setSearchQuery(""); return; }
    const t = setTimeout(() => setSearchQuery(searchInput), 180);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Pre-build a lowercased haystack per company once, aligned by index with
  // `allCompanies`. Filtering then collapses to a cheap substring scan instead
  // of re-lowercasing every field on every keystroke.
  const indexed = useMemo(
    () =>
      allCompanies.map((c) => {
        const sectors = sectorsForCompany(c);
        const parts = [c.name, c.category, c.hq_location || ""];
        for (const r of c.recruiters || []) {
          parts.push(r.name, r.title, r.location || "", r.focus_area || "", r.notes || "");
        }
        // Inject this company's sectors' aliases so industry-term searches
        // ("defence", "finance", "machine learning", "ecommerce"…) hit even
        // when the literal word isn't in the name/category/recruiter text.
        for (const s of SECTORS) {
          if (sectors.has(s.key)) parts.push(...s.aliases);
        }
        return { company: c, sectors, hay: parts.join(" ⁣ ").toLowerCase() };
      }),
    [],
  );

  // Per-company connection rollup: count, total, and a positional signature
  // string ("1010") so cards can read individual state without a Set.
  const connByCompany = useMemo(() => {
    const m = new Map<string, { count: number; total: number; sig: string }>();
    for (const c of allCompanies) {
      const total = c.recruiters?.length || 0;
      let count = 0;
      let sig = "";
      for (let i = 0; i < total; i++) {
        const on = connected.has(recKey(c.id, i));
        if (on) count++;
        sig += on ? "1" : "0";
      }
      m.set(c.id, { count, total, sig });
    }
    return m;
  }, [connected]);

  // Sector chips: count how many *populated* companies fall in each sector,
  // drop empty sectors, sort by count desc.
  const sectorChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { company, sectors } of indexed) {
      if (!(company.recruiters?.length)) continue;
      for (const k of sectors) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return SECTORS
      .map((s) => ({ ...s, count: counts.get(s.key) || 0 }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [indexed]);

  // Stats
  const totalRecruiters = useMemo(() =>
    allCompanies.reduce((sum, c) => sum + (c.recruiters?.length || 0), 0)
  , []);

  const companiesWithRecruiters = useMemo(() =>
    allCompanies.filter(c => (c.recruiters?.length || 0) > 0).length
  , []);

  const connectedCount = connected.size;

  // id → company, for resolving semantic-search matches back to full records.
  const companyById = useMemo(() => {
    const m = new Map<string, Company>();
    for (const c of allCompanies) m.set(c.id, c);
    return m;
  }, []);

  // Filtered + sorted companies
  const filteredCompanies = useMemo(() => {
    const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    let result = indexed
      .filter(({ company, hay, sectors }) => {
        if (!selectedPriorities.has(company.priority)) return false;

        const cc = connByCompany.get(company.id)!;
        const hasRecs = cc.total > 0;
        // Always restrict to companies that have recruiters.
        if (!hasRecs) return false;

        // Sector chips are OR'd: keep a company if it's in any selected sector.
        if (selectedSectors.size > 0 && ![...sectors].some((k) => selectedSectors.has(k))) {
          return false;
        }

        // Connection filters
        if (connectionFilter === "complete" && cc.count !== cc.total) return false;
        if (connectionFilter === "incomplete" && cc.count >= cc.total) return false;
        if (connectionFilter === "untouched" && cc.count !== 0) return false;

        // "Only unconnected people" — drop companies with nothing left to show
        if (hideConnected && cc.count >= cc.total) return false;

        if (tokens.length && !tokens.every((t) => hay.includes(t))) return false;

        return true;
      })
      .map(({ company }) => company);

    result = [...result].sort((a, b) => {
      if (sortMode === "recruiters") {
        const diff = (b.recruiters?.length || 0) - (a.recruiters?.length || 0);
        if (diff !== 0) return diff;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.localeCompare(b.name);
      }
      if (sortMode === "priority") {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.recruiters?.length || 0) - (a.recruiters?.length || 0);
      }
      return a.name.localeCompare(b.name);
    });

    if (sortReversed) result.reverse();

    return result;
  }, [indexed, connByCompany, searchQuery, selectedPriorities, sortMode, sortReversed, selectedSectors, connectionFilter, hideConnected]);

  // Cap how many cards render at once; "Show more" reveals additional pages.
  const PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => {
    setVisibleCount(PAGE);
  }, [searchQuery, selectedPriorities, sortMode, sortReversed, selectedSectors, connectionFilter, hideConnected]);

  const visibleCompanies = filteredCompanies.slice(0, visibleCount);
  const recruitersVisible = filteredCompanies.reduce((s, c) => s + (c.recruiters?.length || 0), 0);

  // --- Semantic fallback -----------------------------------------------------
  // When a typed query yields zero keyword/sector hits, ask gte-server for the
  // closest companies — "did you mean these?". Only fires on a real text query
  // with no results; results are resolved to full records via companyById.
  // `semanticError` distinguishes "server unreachable" from "found nothing".
  type Suggestion = { company: Company; similarity: number };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [semanticError, setSemanticError] = useState(false);
  const noKeywordResults = filteredCompanies.length === 0 && searchQuery.trim().length >= 2;

  // User-tunable similarity cutoff for the semantic results (persisted).
  const [simThreshold, setSimThreshold] = useState(0.74);
  useEffect(() => {
    try {
      const v = parseFloat(localStorage.getItem(SIM_KEY) || "");
      if (v >= 0.5 && v <= 0.95) setSimThreshold(v);
    } catch {}
  }, []);
  const changeSimThreshold = (v: number) => {
    setSimThreshold(v);
    try { localStorage.setItem(SIM_KEY, String(v)); } catch {}
  };

  useEffect(() => {
    if (!noKeywordResults) {
      setSuggestions([]);
      setSuggesting(false);
      setSemanticError(false);
      return;
    }
    let cancelled = false;
    setSuggesting(true);
    setSemanticError(false);
    // Ask gte-server for the full ranked set (threshold 0); the slider filters it locally.
    import("../lib/semantic-client")
      .then(({ semanticSearch }) => semanticSearch(searchQuery.trim(), 100))
      .then((matches) => {
        if (cancelled) return;
        const out: Suggestion[] = [];
        for (const m of matches) {
          const company = companyById.get(m.id);
          if (company && (company.recruiters?.length || 0) > 0) {
            out.push({ company, similarity: m.similarity });
          }
        }
        setSuggestions(out);
      })
      .catch(() => { if (!cancelled) { setSuggestions([]); setSemanticError(true); } })
      .finally(() => { if (!cancelled) setSuggesting(false); });
    return () => { cancelled = true; };
  }, [noKeywordResults, searchQuery, companyById]);

  // Slider-filtered view of the semantic matches.
  const shownSuggestions = useMemo(
    () => suggestions.filter((s) => s.similarity >= simThreshold),
    [suggestions, simThreshold],
  );

  const togglePriority = (p: number) => {
    const next = new Set(selectedPriorities);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    if (next.size === 0) next.add(1);
    setSelectedPriorities(next);
  };

  const toggleSector = (key: string) => {
    const next = new Set(selectedSectors);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSectors(next);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedPriorities(new Set([1, 2, 3]));
    setSelectedSectors(new Set());
    setSortMode("recruiters");
    setSortReversed(false);
    setExpandedCards(new Set());
    setConnectionFilter("all");
    setHideConnected(false);
  };

  const toggleCard = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`, { description: text.length > 60 ? text.slice(0, 60) + "..." : text });
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  const openNewTab = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // Export all current recruiters as CSV
  const exportCSV = () => {
    const rows: string[][] = [
      ["Company", "Company ID", "Priority", "Category", "HQ", "Recruiter Name", "Title", "LinkedIn URL", "Location", "Focus Area", "Connected", "Notes"]
    ];

    allCompanies.forEach(company => {
      if (!company.recruiters || company.recruiters.length === 0) return;
      company.recruiters.forEach((r, idx) => {
        rows.push([
          company.name,
          company.id,
          String(company.priority),
          company.category,
          company.hq_location || "",
          r.name,
          r.title,
          r.linkedin_url,
          r.location || "",
          r.focus_area || "",
          connected.has(recKey(company.id, idx)) ? "yes" : "",
          (r.notes || "").replace(/"/g, '""')
        ]);
      });
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recruiters-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${rows.length - 1} recruiters to CSV`);
  };

  // Two-step export: first click arms (green "Confirm"), second click downloads.
  const [exportArmed, setExportArmed] = useState(false);
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleExportClick = () => {
    if (!exportArmed) {
      setExportArmed(true);
      exportTimer.current = setTimeout(() => setExportArmed(false), 3500);
      return;
    }
    if (exportTimer.current) clearTimeout(exportTimer.current);
    setExportArmed(false);
    exportCSV();
  };
  useEffect(() => () => { if (exportTimer.current) clearTimeout(exportTimer.current); }, []);

  // GSAP — stagger the visible rows in on mount, on view switch, and whenever
  // more are revealed. Works for both the card and compact layouts.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".rd-row",
        { opacity: 0, y: view === "compact" ? 4 : 10 },
        {
          opacity: 1,
          y: 0,
          duration: view === "compact" ? 0.2 : 0.28,
          stagger: view === "compact" ? 0.005 : 0.012,
          ease: "power2.out",
          overwrite: "auto",
        },
      );
    }, listRef);
    return () => ctx.revert();
  }, [visibleCount, view]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tighter">Tech Recruiter Directory</h1>
                <p className="text-xs text-zinc-500 -mt-0.5">US Tech • Internship &amp; Early Career Outreach</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="hidden md:flex items-center gap-4 px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                <div><span className="font-semibold text-zinc-900 dark:text-white">{meta.total_companies.toLocaleString()}</span> companies</div>
                <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">{companiesWithRecruiters}</span> populated</div>
                <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                <div><span className="font-semibold text-blue-600 dark:text-blue-400">{totalRecruiters}</span> recruiters</div>
                <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">{connectedCount}</span> connected</div>
              </div>

              <button
                onClick={handleExportClick}
                disabled={totalRecruiters === 0}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium border transition-colors disabled:opacity-50 ${
                  exportArmed
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {exportArmed ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {exportArmed ? 'Confirm export' : 'Export CSV'}
              </button>

              <ThemeToggle />
            </div>
          </div>

          <div className="mt-3 text-[11px] text-zinc-500 flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            Data last updated {meta.last_updated} • {totalRecruiters} recruiters across {companiesWithRecruiters} companies
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-6 pb-4">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by company, recruiter, or industry — “insurance”, “defense”, “big tech”, “fintech”…"
              className="w-full pl-9 pr-9 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10"
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")} className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority pills */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs uppercase tracking-widest text-zinc-500 mr-1">Priority</span>
              {[1, 2, 3].map(p => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={`badge px-3 py-1 text-xs ${selectedPriorities.has(p) ? `priority-${p}` : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 line-through'}`}
                >
                  P{p} {PRIORITY_LABELS[p as 1 | 2 | 3]}
                </button>
              ))}
            </div>

            {/* Only unconnected people */}
            <button
              onClick={() => setHideConnected(!hideConnected)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium border ${hideConnected
                ? 'bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400'
                : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              Only unconnected people
            </button>

            {/* Connection filter */}
            <select
              value={connectionFilter}
              onChange={(e) => setConnectionFilter(e.target.value as ConnectionFilter)}
              className="h-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium"
            >
              <option value="all">Connection: all</option>
              <option value="incomplete">Not fully connected</option>
              <option value="complete">Fully connected</option>
              <option value="untouched">None connected</option>
            </select>

            {/* Sort */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              className="h-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium"
            >
              <option value="recruiters">Most recruiters</option>
              <option value="priority">Priority (top targets)</option>
              <option value="name">Company name</option>
            </select>

            {/* Reverse order */}
            <button
              onClick={() => setSortReversed(r => !r)}
              title={sortReversed ? "Reversed order — click to restore" : "Reverse the current order"}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium border ${sortReversed
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent'
                : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Reverse
            </button>

            {/* Clear */}
            <button
              onClick={clearFilters}
              className="ml-auto text-xs px-3 h-8 rounded-full border border-transparent text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Reset filters
            </button>
          </div>

          {/* Sector quick filters — fold 130+ raw categories into industries
              people actually search by. Multiple selections are OR'd. */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs uppercase tracking-widest text-zinc-500 mr-1">Industry</span>
            {sectorChips.map(s => (
              <button
                key={s.key}
                onClick={() => toggleSector(s.key)}
                title={`${s.count} companies`}
                className={`text-[10px] px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${selectedSectors.has(s.key)
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent'
                  : 'border-zinc-200 dark:border-zinc-800'}`}
              >
                {s.label}
                <span className={selectedSectors.has(s.key) ? 'opacity-70' : 'text-zinc-400'}>{s.count}</span>
              </button>
            ))}
            {selectedSectors.size > 0 && (
              <button onClick={() => setSelectedSectors(new Set())} className="text-[10px] px-2 py-0.5 text-zinc-500 hover:text-red-500">clear</button>
            )}
          </div>
        </div>

        {/* Results summary + view switcher */}
        <div className="mt-5 mb-3 flex items-center justify-between gap-3 text-sm">
          <div>
            Showing <span className="font-semibold">{filteredCompanies.length}</span> companies
            {searchQuery && <span className="text-zinc-500"> matching “{searchQuery}”</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-zinc-500">{recruitersVisible} recruiters visible</span>
            <div className="inline-flex rounded-full border border-zinc-200 dark:border-zinc-800 p-0.5 text-xs font-medium">
              <button
                onClick={() => changeView("cards")}
                className={`px-3 h-7 rounded-full transition-colors ${view === "cards" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-500"}`}
              >
                Cards
              </button>
              <button
                onClick={() => changeView("compact")}
                className={`px-3 h-7 rounded-full transition-colors ${view === "compact" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-500"}`}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Company List */}
      <main className="max-w-7xl mx-auto w-full px-6 pb-16 flex-1">
        {filteredCompanies.length === 0 && (
          <div className="py-12">
            {noKeywordResults ? (
              <div className="space-y-5">
                <div className="text-center text-zinc-500">
                  No exact matches for <span className="font-medium text-zinc-700 dark:text-zinc-300">“{searchQuery.trim()}”</span>.
                  {suggesting && <span className="ml-2 text-xs text-zinc-400">finding closest companies…</span>}
                </div>
                {suggestions.length > 0 && (
                  <div className="max-w-3xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="text-xs uppercase tracking-widest text-zinc-500">
                        Closest companies by meaning — <span className="text-zinc-700 dark:text-zinc-300">{shownSuggestions.length}</span> match{shownSuggestions.length === 1 ? "" : "es"}
                      </div>
                      {/* Similarity threshold slider — filters the ranked set locally */}
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="whitespace-nowrap">Min match</span>
                        <input
                          type="range"
                          min={50}
                          max={95}
                          step={1}
                          value={Math.round(simThreshold * 100)}
                          onChange={(e) => changeSimThreshold(Number(e.target.value) / 100)}
                          className="w-32 accent-zinc-900 dark:accent-white"
                          aria-label="Minimum similarity threshold"
                        />
                        <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300 w-9 text-right">{Math.round(simThreshold * 100)}%</span>
                      </label>
                    </div>
                    {shownSuggestions.length > 0 ? (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        {shownSuggestions.map(({ company, similarity }) => {
                          const cc = connByCompany.get(company.id)!;
                          return (
                            <div key={company.id} className="relative">
                              <span className="absolute right-3 top-2 z-10 text-[10px] font-mono tabular-nums text-zinc-400">
                                {Math.round(similarity * 100)}%
                              </span>
                              <CompactRow
                                company={company}
                                sig={cc.sig}
                                count={cc.count}
                                total={cc.total}
                                hideConnected={false}
                                onToggleRecruiter={toggleRecruiter}
                                onMarkConnected={markConnected}
                                onOpen={openNewTab}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-sm text-zinc-500 py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        Nothing above {Math.round(simThreshold * 100)}%. Lower the “Min match” slider to see looser matches.
                      </div>
                    )}
                  </div>
                )}
                {!suggesting && semanticError && (
                  <div className="max-w-md mx-auto text-center text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3">
                    Smart “did you mean” search is offline right now. Keyword &amp; industry search still work — try a company name, an industry (e.g. “fintech”), or <button onClick={clearFilters} className="underline">reset filters</button>.
                  </div>
                )}
                {!suggesting && !semanticError && suggestions.length === 0 && (
                  <div className="text-center text-sm text-zinc-500">
                    No close matches either. <button onClick={clearFilters} className="underline">Reset filters</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-zinc-500">
                No companies match your filters. <button onClick={clearFilters} className="underline">Clear filters</button>
              </div>
            )}
          </div>
        )}

        {filteredCompanies.length > 0 && (view === "compact" ? (
          <div ref={listRef} className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {visibleCompanies.map((company) => {
              const cc = connByCompany.get(company.id)!;
              return (
                <CompactRow
                  key={company.id}
                  company={company}
                  sig={cc.sig}
                  count={cc.count}
                  total={cc.total}
                  hideConnected={hideConnected}
                  onToggleRecruiter={toggleRecruiter}
                  onMarkConnected={markConnected}
                  onOpen={openNewTab}
                />
              );
            })}
          </div>
        ) : (
          <div ref={listRef} className="space-y-3">
            {visibleCompanies.map((company) => {
              const cc = connByCompany.get(company.id)!;
              return (
                <CompanyCard
                  key={company.id}
                  company={company}
                  sig={cc.sig}
                  count={cc.count}
                  total={cc.total}
                  isExpanded={expandedCards.has(company.id)}
                  hideConnected={hideConnected}
                  onToggleCard={toggleCard}
                  onToggleRecruiter={toggleRecruiter}
                  onMarkConnected={markConnected}
                  onCopy={copyToClipboard}
                  onOpen={openNewTab}
                />
              );
            })}
          </div>
        ))}

        {filteredCompanies.length > visibleCount && (
          <div className="text-center mt-8">
            <button
              onClick={() => setVisibleCount(c => c + PAGE)}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 px-5 h-10 text-sm font-medium"
            >
              Show {Math.min(PAGE, filteredCompanies.length - visibleCount)} more
              <span className="text-zinc-500">({filteredCompanies.length - visibleCount} hidden)</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-xs text-zinc-500 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div>
              Built for personal internship outreach. Data from public LinkedIn/web searches + manual curation.
              Always verify profiles are current before messaging. Respect recruiter preferences.
            </div>
            <div className="font-mono text-[10px] opacity-60">
              {meta.total_companies} companies • {totalRecruiters} recruiters • v2.1
            </div>
          </div>
          <div className="mt-3 text-[10px]">
            Tip: open each company’s “Find more recruiters” link while logged into LinkedIn and harvest 5–8 strong university/early-career profiles per target. Tick recruiters off as you connect — it saves to this browser.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- light/dark theme toggle ---------- */

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const flip = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("rd-theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };
  return (
    <button
      onClick={flip}
      aria-label="Toggle light/dark theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 w-8 h-8 text-zinc-600 dark:text-zinc-400"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/* ---------- tri-state checkbox (supports indeterminate) ---------- */

function ConnCheckbox({
  checked,
  indeterminate = false,
  onChange,
  title,
  size = 16,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  title: string;
  size?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      style={{ width: size, height: size, accentColor: "#16a34a" }}
      className="shrink-0 cursor-pointer"
    />
  );
}

/* ---------- company card (memoized) ---------- */

interface CardProps {
  company: Company;
  sig: string;
  count: number;
  total: number;
  isExpanded: boolean;
  hideConnected: boolean;
  onToggleCard: (id: string) => void;
  onToggleRecruiter: (key: string) => void;
  onMarkConnected: (key: string) => void;
  onCopy: (text: string, label: string) => void;
  onOpen: (url: string) => void;
}

const CompanyCard = React.memo(function CompanyCard({
  company, sig, count, total, isExpanded, hideConnected,
  onToggleCard, onToggleRecruiter, onMarkConnected, onCopy, onOpen,
}: CardProps) {
  const recCount = total;
  const allConnected = total > 0 && count === total;

  // Build the list of recruiters to show (respecting "only unconnected").
  const withIdx = (company.recruiters || []).map((r, i) => ({ r, i }));
  const baseList = hideConnected ? withIdx.filter(({ i }) => sig[i] !== "1") : withIdx;
  const displayRecs = isExpanded ? baseList : baseList.slice(0, 3);
  const moreCount = baseList.length - displayRecs.length;

  return (
    <div className="rd-row company-card border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Company Header */}
      <div className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg tracking-tight">{company.name}</span>
            <span className={`badge priority-${company.priority} ml-0.5`}>P{company.priority}</span>
            {company.id && <span className="text-[10px] font-mono text-zinc-400">{company.id}</span>}
            {recCount > 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                allConnected
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950'
                  : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
              }`}>
                <Users className="h-3 w-3" /> {count}/{recCount} connected
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{company.category}</span>
            {company.hq_location && <span>{company.hq_location}</span>}
            {company.size_estimate && <span>{company.size_estimate}</span>}
            {company.has_intern_program && <span className="text-emerald-600 dark:text-emerald-400">✓ Intern program</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onOpen(company.linkedin_company_url)} className="link-btn" title="Open company LinkedIn page">
            Company <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onOpen(company.recruiter_search_url)}
            className="link-btn bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300"
            title="Open LinkedIn People search for recruiters at this company"
          >
            Find more recruiters <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onToggleCard(company.id)} className="link-btn text-xs">
            {isExpanded ? "Collapse" : `Show all ${recCount}`}
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Recruiters */}
      {recCount > 0 && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
          {displayRecs.length === 0 && (
            <div className="px-5 py-3 text-xs text-zinc-500">All recruiters here are marked connected.</div>
          )}
          {displayRecs.map(({ r: rec, i: idx }) => {
            const key = recKey(company.id, idx);
            const on = sig[idx] === "1";
            return (
              <div
                key={idx}
                className="px-5 py-3 flex flex-col md:flex-row md:items-center gap-2"
                style={on ? { background: "color-mix(in srgb, #16a34a 7%, transparent)" } : undefined}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-0.5">
                    <ConnCheckbox checked={on} onChange={() => onToggleRecruiter(key)} title={on ? "Connected — click to undo" : "Mark connected"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={rec.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onMarkConnected(key)}
                        className="font-medium hover:underline flex items-center gap-1"
                      >
                        {rec.name}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                      <span className="text-zinc-400">•</span>
                      <span className="text-zinc-600 dark:text-zinc-400">{rec.title}</span>
                      {on && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5"><Check className="h-3 w-3" /> connected</span>}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {rec.location && <span>{rec.location}</span>}
                      {rec.focus_area && <span className="ml-2 text-emerald-600/80 dark:text-emerald-400/80">{rec.focus_area}</span>}
                    </div>
                    {rec.notes && <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{rec.notes}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onCopy(rec.linkedin_url, "LinkedIn URL")}
                    className="text-xs px-2.5 h-7 rounded border border-zinc-200 dark:border-zinc-800 inline-flex items-center gap-1"
                    title="Copy LinkedIn profile URL"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <a
                    href={rec.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onMarkConnected(key)}
                    className="text-xs px-3 h-7 rounded bg-black text-white dark:bg-white dark:text-black inline-flex items-center gap-1 hover:opacity-90"
                  >
                    Message <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}

          {!isExpanded && moreCount > 0 && (
            <button
              onClick={() => onToggleCard(company.id)}
              className="w-full py-2 text-xs text-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              + {moreCount} more {hideConnected ? "unconnected " : ""}recruiter{moreCount > 1 ? "s" : ""} (click to expand)
            </button>
          )}
        </div>
      )}
    </div>
  );
});

/* ---------- compact two-line row ---------- */

interface CompactProps {
  company: Company;
  sig: string;
  count: number;
  total: number;
  hideConnected: boolean;
  onToggleRecruiter: (key: string) => void;
  onMarkConnected: (key: string) => void;
  onOpen: (url: string) => void;
}

const CompactRow = React.memo(function CompactRow({
  company, sig, count, total, hideConnected, onToggleRecruiter, onMarkConnected, onOpen,
}: CompactProps) {
  const allConnected = total > 0 && count === total;

  const withIdx = (company.recruiters || []).map((r, i) => ({ r, i }));
  const recs = hideConnected ? withIdx.filter(({ i }) => sig[i] !== "1") : withIdx;

  return (
    <div className="rd-row px-3 py-1.5 bg-white dark:bg-zinc-900">
      {/* Line 1 — company */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`badge priority-${company.priority}`}>P{company.priority}</span>
        <button
          onClick={() => onOpen(company.linkedin_company_url)}
          className="font-semibold text-sm truncate hover:underline inline-flex items-center gap-1"
          title="Open company LinkedIn page"
        >
          {company.name}
          <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
        </button>
        <span className="text-[11px] text-zinc-400 shrink-0">{company.category}</span>
        <span className={`text-[10px] shrink-0 ${allConnected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
          {count}/{total}
        </span>
      </div>

      {/* Line 2 — recruiters inline */}
      {recs.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 pl-8 text-xs">
          {recs.map(({ r: rec, i: idx }) => {
            const on = sig[idx] === "1";
            return (
              <span key={idx} className="inline-flex items-center gap-1 min-w-0">
                <ConnCheckbox
                  checked={on}
                  onChange={() => onToggleRecruiter(recKey(company.id, idx))}
                  title={on ? "Connected — click to undo" : "Mark connected"}
                  size={13}
                />
                <a
                  href={rec.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onMarkConnected(recKey(company.id, idx))}
                  className={`inline-flex items-center gap-0.5 hover:underline truncate ${on ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}
                  title={`${rec.name} — ${rec.title}`}
                >
                  {rec.name}
                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                </a>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});
