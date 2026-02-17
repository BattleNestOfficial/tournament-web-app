import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 17, 2026</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This policy explains what data we collect, how we use it, and your controls while using Battle Nest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data We Collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We collect account details (username, email, auth identifiers), tournament activity, team participation,
            wallet transactions, and support submissions.
          </p>
          <p>
            Support tickets can include accused game name, tournament reference, description text, and screenshot
            evidence.
          </p>
          <p>
            Technical logs such as IP/session metadata may be processed for abuse prevention, fraud checks, and
            reliability.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How We Use Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Data is used to operate tournaments, publish rooms/results, process wallet actions, and prevent fraud.</p>
          <p>Admin and moderation actions are logged for operational integrity and audit traceability.</p>
          <p>
            We may send service notifications such as match start reminders, room publication, result updates, and
            account-related alerts.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Sharing & Third-Party Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We may use third-party providers for authentication, payments, cloud hosting, and operational monitoring.
          </p>
          <p>
            Data is shared with providers only as needed to deliver platform functions, comply with law, or prevent
            abuse.
          </p>
          <p>We do not sell your personal data as part of normal platform operation.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention, Security & User Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We retain data for as long as needed to run the service, resolve disputes, meet legal obligations, and
            enforce platform rules.
          </p>
          <p>
            We use reasonable technical and organizational safeguards, including role-based admin access and activity
            logging.
          </p>
          <p>
            You can request profile corrections through Support. Certain records (such as transaction logs) may be kept
            for compliance and fraud-control purposes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cookies, Policy Updates & Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We may use cookies/local storage for session management, theme preferences, and secure app performance.
          </p>
          <p>
            This policy may be updated as product, security, or regulatory requirements evolve. The latest version is
            always shown on this page.
          </p>
          <p>
            For privacy questions, use the in-app <strong>Support</strong> page and open a ticket.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
