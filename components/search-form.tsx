"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const sources = [
  { label: "Reddit", value: "reddit" },
  { label: "YouTube", value: "youtube" },
  { label: "TikTok", value: "tiktok" },
  { label: "Facebook", value: "facebook" }
];

export function SearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("TSLA");
  const [category, setCategory] = useState("auto");
  const [timeRange, setTimeRange] = useState("7d");
  const [language, setLanguage] = useState("en");
  const [minMentions, setMinMentions] = useState(3);
  const [selectedSources, setSelectedSources] = useState<string[]>(sources.map((source) => source.value));
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
                onChange={(event) => setCategory(event.target.value)}
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
                    onClick={() => toggleSource(source.value)}
                    className={`rounded-full border px-3 py-1 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                  >
                    {source.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" disabled={isLoading || selectedSources.length === 0}>
            {isLoading ? "Analyzing..." : "Generate report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
