import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const effectiveDate = "March 14, 2026";

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-r from-cyan-100 to-blue-100 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">SignalSentiment Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-700">Effective date: {effectiveDate}</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>1. What We Collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>SignalSentiment collects account data needed for login and analytics query history.</p>
          <p>
            We process public discussion content and metadata from configured sources (for example, Reddit, YouTube,
            TikTok, Facebook) for sentiment analysis.
          </p>
          <p>We may store search terms, aggregated sentiment results, and source-level metadata.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. How We Use Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>We use data to generate sentiment scores, trend reports, source comparisons, and historical analytics.</p>
          <p>We use authentication data to secure user-specific dashboards and saved reports.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Data Sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>We do not sell personal data.</p>
          <p>
            We use infrastructure providers (for example, Supabase) to store and process data as part of service
            delivery.
          </p>
          <p>We may disclose data when required by law or to protect the security and integrity of the service.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Search and report data is retained while your account is active or as needed for service operations.</p>
          <p>You can request deletion by following instructions at the data deletion page below.</p>
          <p>
            Data deletion instructions: <a className="text-primary underline" href="/data-deletion">/data-deletion</a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>We use reasonable administrative and technical safeguards to protect stored data.</p>
          <p>No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Your Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>You may request access, correction, or deletion of your account-associated data.</p>
          <p>
            Contact: <a className="text-primary underline" href="mailto:privacy@signalsentiment.app">privacy@signalsentiment.app</a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Policy Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>We may update this Privacy Policy periodically. Material updates will be reflected by a new effective date.</p>
        </CardContent>
      </Card>
    </div>
  );
}
