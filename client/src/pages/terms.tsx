import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 17, 2026</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>You must provide accurate account and in-game details when joining tournaments.</p>
          <p>Any cheating, impersonation, or fraudulent activity can result in account suspension.</p>
          <p>Battle Nest may update match formats, prize structures, and platform rules when needed.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments, Wallet & Withdrawals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Entry fees and wallet transactions are recorded in your account history.</p>
          <p>Withdrawals are subject to verification checks and admin approval flow.</p>
          <p>Platform fees, taxes, and payout timelines may vary based on tournament rules.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Rules & Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Admins may verify results using screenshots, manual checks, and platform records.</p>
          <p>Disputes or support tickets are processed through the support workflow.</p>
          <p>Final decisions on tournament eligibility, penalties, and payouts are made by admin.</p>
        </CardContent>
      </Card>
    </div>
  );
}

