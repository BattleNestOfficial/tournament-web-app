import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: February 17, 2026</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data We Collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>We collect account details, tournament activity, wallet transactions, and support submissions.</p>
          <p>For support tickets, screenshots and text details are stored for verification and resolution.</p>
          <p>Basic device/session data may be used for security, abuse prevention, and service stability.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How We Use Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Data is used to run tournaments, publish results, process wallet actions, and detect fraud.</p>
          <p>Admin operations and moderation actions are logged for audit and operational safety.</p>
          <p>Notifications may be sent for match updates, room details, and account activity.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>We use reasonable technical controls to protect account and transaction data.</p>
          <p>Only authorized admins can access protected panel functions and support queues.</p>
          <p>You can contact support to request correction of inaccurate profile data.</p>
        </CardContent>
      </Card>
    </div>
  );
}

