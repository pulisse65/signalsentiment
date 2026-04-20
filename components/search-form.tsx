"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const sources = [
  { label: "Reddit", value: "reddit", comingSoon: false },
  { label: "OpenRouter AI", value: "openrouter", comingSoon: false },
  { label: "News (RSS)", value: "news", comingSoon: false },
  { label: "YouTube", value: "youtube", comingSoon: true },
  { label: "TikTok", value: "tiktok", comingSoon: true },
  { label: "Facebook", value: "facebook", comingSoon: true }
];

interface SearchFormProps {
  initialQuery?: string;
  initialCategory?: "stock" | "sports" | "product" | "auto";
}

export function SearchForm({ initialQuery = "TSLA", initialCategory = "auto" }: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [timeRange, setTimeRange] = useState("7d");
  const [language, setLanguage] = useState("en");
  const [minMentions, setMinMentions] = useState(3);
  const [selectedSources, setSelectedSources] = useState<string[]>(["reddit", "openrouter", "news"]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSource = (source: string) => {
    setSelectedSources((current) => (current.includes(source) ? current.filter((item) => item !== source) : [...current, source]));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          category,
          timeRange,
          language,
          selectedSources,
          minMentions
        })
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to run analysis");
      }

      const payload = await response.json();
      router.push(`/report/${payload.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Sentiment Analysis</CardTitle>
        <CardDescription>Search stocks, sports, or products with multi-source sentiment scoring.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Keyword / Symbol / Phrase</label>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="TSLA, Detroit Lions, iPhone 17" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value as "auto" | "stock" | "sports" | "product")}
                options={[
                  { label: "Auto-detect", value: "auto" },
                  { label: "Stock", value: "stock" },
                  { label: "Sports", value: "sports" },
                  { label: "Product", value: "product" }
                ]}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Time Range</label>
              <Select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                options={[
                  { label: "24h", value: "24h" },
                  { label: "7d", value: "7d" },
                  { label: "30d", value: "30d" },
                  { label: "90d", value: "90d" }
                ]}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Language</label>
              <Input value={language} onChange={(event) => setLanguage(event.target.value)} maxLength={5} placeholder="en" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Min Mentions</label>
              <Input type="number" min={0} value={minMentions} onChange={(event) => setMinMentions(Number(event.target.value))} />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Sources</label>
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => {
                const active = selectedSources.includes(source.value);
                return (
                  <button
                    key={source.value}
                    type="button"
                    onClick={() => (source.comingSoon ? undefined : toggleSource(source.value))}
                    disabled={source.comingSoon}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      source.comingSoon
                        ? "cursor-not-allowed border-slate-500/50 bg-slate-500/20 text-slate-400"
                        : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                    }`}
                  >
                    <span>{source.label}</span>
                    {source.comingSoon ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Coming soon</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500"
                  style={{ animation: "search-progress-shimmer 1.2s ease-in-out infinite" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Pulling source data, scoring sentiment, and generating your report...
              </p>
            </div>
          ) : null}

          <Button type="submit" disabled={isLoading || selectedSources.length === 0}>
            {isLoading ? "Generating report..." : "Generate report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
