import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, TrendingUp, Ban, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import type { Transaction, Withdrawal } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function WalletPage() {
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addAmount, setAddAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/my"],
    enabled: !!user,
  });

  const { data: withdrawals, isLoading: wdLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals/my"],
    enabled: !!user,
  });

  const addMoneyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/add", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(addAmount) * 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
      toast({ title: "Money added!", description: `\u20B9${addAmount} added to wallet` });
      setAddAmount("");
      setAddDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(withdrawAmount) * 100, upiId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
      toast({ title: "Request submitted", description: "Your withdrawal request is being reviewed" });
      setWithdrawAmount("");
      setUpiId("");
      setWithdrawDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  if (!user) return null;

  const deposits = transactions?.filter(t => ["deposit", "admin_credit", "winning"].includes(t.type)) || [];
  const expenses = transactions?.filter(t => ["entry_fee", "withdrawal", "admin_debit"].includes(t.type)) || [];
  const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);
  const totalWinnings = transactions?.filter(t => t.type === "winning").reduce((s, t) => s + t.amount, 0) || 0;
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);

  const txTypeIcons: Record<string, any> = {
    deposit: { icon: ArrowDownLeft, color: "text-chart-3", label: "Deposit" },
    winning: { icon: TrendingUp, color: "text-chart-3", label: "Winning" },
    admin_credit: { icon: Plus, color: "text-chart-3", label: "Credit" },
    entry_fee: { icon: ArrowUpRight, color: "text-destructive", label: "Entry Fee" },
    withdrawal: { icon: ArrowUpRight, color: "text-destructive", label: "Withdrawal" },
    admin_debit: { icon: Ban, color: "text-destructive", label: "Debit" },
  };

  const withdrawalStatusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-chart-4", label: "Pending" },
    approved: { icon: CheckCircle, color: "text-chart-3", label: "Approved" },
    rejected: { icon: Ban, color: "text-destructive", label: "Rejected" },
    paid: { icon: CheckCircle, color: "text-chart-2", label: "Paid" },
  };

  function TransactionRow({ tx }: { tx: Transaction }) {
    const config = txTypeIcons[tx.type] || { icon: AlertCircle, color: "text-muted-foreground", label: tx.type };
    const isCredit = ["deposit", "winning", "admin_credit"].includes(tx.type);
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0" data-testid={`tx-${tx.id}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-md bg-muted ${config.color}`}>
            <config.icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{tx.description || config.label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <span className={`text-sm font-semibold shrink-0 ${isCredit ? "text-chart-3" : "text-destructive"}`}>
          {isCredit ? "+" : "-"}{"\u20B9"}{(tx.amount / 100).toFixed(0)}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-3xl font-bold" data-testid="text-wallet-balance-main">
                  {"\u20B9"}{((user.walletBalance || 0) / 100).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-md">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 flex-1" data-testid="button-add-money">
                    <Plus className="w-4 h-4" /> Add Money
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Money to Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Amount ({"\u20B9"})</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        data-testid="input-add-amount"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[50, 100, 200, 500].map((amt) => (
                        <Button key={amt} variant="outline" size="sm" onClick={() => setAddAmount(amt.toString())} data-testid={`button-quick-add-${amt}`}>
                          {"\u20B9"}{amt}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      disabled={!addAmount || Number(addAmount) <= 0 || addMoneyMutation.isPending}
                      onClick={() => addMoneyMutation.mutate()}
                      data-testid="button-confirm-add"
                    >
                      {addMoneyMutation.isPending ? "Adding..." : `Add \u20B9${addAmount || "0"}`}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      In production, this would use Razorpay payment gateway.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 flex-1" data-testid="button-withdraw">
                    <ArrowUpRight className="w-4 h-4" /> Withdraw
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Withdraw Money</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Amount ({"\u20B9"}) (Min: {"\u20B9"}50)</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        data-testid="input-withdraw-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>UPI ID</Label>
                      <Input
                        placeholder="yourname@upi"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        data-testid="input-upi-id"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!withdrawAmount || Number(withdrawAmount) < 50 || !upiId || withdrawMutation.isPending}
                      onClick={() => withdrawMutation.mutate()}
                      data-testid="button-confirm-withdraw"
                    >
                      {withdrawMutation.isPending ? "Submitting..." : `Withdraw \u20B9${withdrawAmount || "0"}`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium">Quick Stats</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Deposits</span>
                <span className="font-medium text-chart-3">
                  {"\u20B9"}{(totalDeposits / 100).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Winnings</span>
                <span className="font-medium text-chart-3">
                  {"\u20B9"}{(totalWinnings / 100).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-medium text-destructive">
                  {"\u20B9"}{(totalSpent / 100).toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Pending Withdrawals</span>
                <span className="font-medium text-chart-4">
                  {withdrawals?.filter(w => w.status === "pending").length || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deposits" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="deposits" data-testid="tab-deposits">
            <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" /> Deposits
          </TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Withdrawals
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-transactions">
            <Wallet className="w-3.5 h-3.5 mr-1.5" /> All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposits">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Deposit History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              {txLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : deposits.length > 0 ? (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {deposits.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No deposits yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Withdrawal Requests</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              {wdLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : withdrawals && withdrawals.length > 0 ? (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {withdrawals.map((wd) => {
                    const config = withdrawalStatusConfig[wd.status] || { icon: Clock, color: "text-muted-foreground", label: wd.status };
                    return (
                      <div key={wd.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0" data-testid={`wd-${wd.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-md bg-muted ${config.color}`}>
                            <config.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{"\u20B9"}{(wd.amount / 100).toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">
                              UPI: {wd.upiId || "N/A"} | {new Date(wd.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No withdrawal requests
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Transactions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              {txLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No transactions yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
