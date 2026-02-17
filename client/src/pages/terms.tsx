import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 17, 2026</p>
        <p className="mt-2 text-sm text-muted-foreground">
          By using Battle Nest, you agree to these terms. Please read them carefully before joining tournaments,
          making wallet transactions, or submitting host/support requests.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility & Account Responsibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>You must provide accurate account details, in-game names, and contact information.</p>
          <p>You are responsible for all activity under your account, including wallet and tournament actions.</p>
          <p>
            Sharing accounts, impersonation, bot activity, and bypassing platform restrictions are prohibited and may
            result in suspension.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fair Play & Conduct</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Cheating, hacks, collusion, smurfing, and match-fixing are strictly prohibited.</p>
          <p>Abusive behavior toward players, hosts, moderators, or admins can lead to warnings or bans.</p>
          <p>
            Admin decisions on misconduct are based on available evidence such as match logs, screenshots, and support
            tickets.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments, Wallet, Refunds & Withdrawals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Entry fees, bonus credits, deposits, winnings, and wallet adjustments are recorded in your account.</p>
          <p>Withdrawals are subject to verification checks, limits, fee rules, and admin approval.</p>
          <p>
            Refunds may be issued for cancelled tournaments according to platform logic and admin review. Fraudulent
            payments or chargebacks can lead to account restriction.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tournaments, Results & Prize Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Tournament formats, slot limits, schedules, and prize pools can vary by event.</p>
          <p>
            Results can be updated through verified admin workflows (including screenshot/manual validations where
            needed).
          </p>
          <p>
            Admin decisions on eligibility, tie-breaks, penalties, and final payout calculations are binding for the
            event.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Host/Youtuber Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Host access is granted only after approval of host application details.</p>
          <p>Host permissions can be limited, suspended, or removed at admin discretion for policy violations.</p>
          <p>Host earnings/wallet credits are subject to admin verification and manual settlement controls.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Availability, Changes & Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Features may change, pause, or be discontinued to maintain security, compliance, or platform stability.
          </p>
          <p>
            Battle Nest may update these terms periodically. Continued use after updates means you accept the revised
            terms.
          </p>
          <p>
            For policy or account questions, use the in-app <strong>Support</strong> page and open a ticket.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
