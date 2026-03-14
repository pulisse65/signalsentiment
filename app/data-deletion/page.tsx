import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataDeletionPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-r from-cyan-100 to-blue-100 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">SignalSentiment Data Deletion Instructions</h1>
        <p className="mt-2 text-sm text-slate-700">Last updated: March 14, 2026</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Request Deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            To request deletion of account-associated data, email
            <a className="ml-1 text-primary underline" href="mailto:privacy@signalsentiment.app?subject=Data%20Deletion%20Request">
              privacy@signalsentiment.app
            </a>
            with the subject line &quot;Data Deletion Request&quot;.
          </p>
          <p>Please include the email address used for your SignalSentiment account.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What We Delete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Upon verification, we delete your stored account profile and user-linked search/report history.</p>
          <p>Deletion requests are typically completed within 30 days.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            If you need help, contact
            <a className="ml-1 text-primary underline" href="mailto:support@signalsentiment.app">support@signalsentiment.app</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
