import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTrendingStocks } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { formatLocalTimestamp } from "@/lib/utils/format";

function directionStyle(direction: "accelerating" | "stable" | "cooling") {
  if (direction === "accelerating") return "bg-emerald-500/20 text-emerald-300";
  if (direction === "cooling") return "bg-rose-500/20 text-rose-300";
  return "bg-slate-500/20 text-slate-300";
}

export default async function StocksPage() {
  const userId = await getCurrentUserId();
  const stocks = await getTrendingStocks(userId, 30, 15);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trending Stocks (30d)</CardTitle>
          <CardDescription>
            Living sentiment leaderboard based on score delta, mention growth, and momentum over the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stock reports yet. Run a stock analysis to start building your momentum board.
            </p>
          ) : null}

          <div className="grid gap-3">
            {stocks.map((stock, index) => (
              <div key={stock.symbol} className="rounded-lg border bg-card/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">#{index + 1}</span>
                    <p className="text-lg font-semibold">{stock.symbol}</p>
                    <Badge className={directionStyle(stock.direction)}>{stock.direction}</Badge>
                    {stock.reportCount < 2 ? <Badge className="bg-slate-500/20 text-slate-200">initial snapshot</Badge> : null}
                  </div>
                  <Badge>Momentum {stock.sentimentMomentumScore}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
                  <span>Score: {stock.latestScore}</span>
                  <span>Score Δ: {stock.scoreDelta > 0 ? `+${stock.scoreDelta}` : stock.scoreDelta}</span>
                  <span>Mentions: {stock.latestMentions}</span>
                  <span>Mentions Δ: {stock.mentionGrowthPct > 0 ? `+${stock.mentionGrowthPct}` : stock.mentionGrowthPct}%</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Window: {formatLocalTimestamp(stock.windowStart)} {"->"} {formatLocalTimestamp(stock.windowEnd)} • {stock.reportCount} reports
                </p>
                <div className="mt-2">
                  <Link
                    href={`/?query=${encodeURIComponent(stock.symbol)}&category=stock`}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    Run fresh analysis
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
