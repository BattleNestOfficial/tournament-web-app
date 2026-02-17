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
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, TrendingUp, Ban, CheckCircle, AlertCircle, CreditCard, TicketPercent } from "lucide-react";
import { useState, useEffect } from "react";
import type { Transaction, Withdrawal } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type LoyaltyProfile = {
  tier: "bronze" | "silver" | "gold" | "vip";
  tierLabel: string;
  benefits: {
    platformFeePercent: number;
    prioritySupport: boolean;
    exclusiveTournaments: boolean;
  };
};

export default function WalletPage() {
  const { user, token, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addAmount, setAddAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [razorpayLoading, setRazorpayLoading] = useState(false);

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/my"],
    enabled: !!user,
  });

  const { data: withdrawals, isLoading: wdLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals/my"],
    enabled: !!user,
  });

  const { data: razorpayConfig } = useQuery<{ keyId: string | null }>({
    queryKey: ["/api/config/razorpay-key"],
  });
  const { data: loyalty } = useQuery<LoyaltyProfile>({
    queryKey: ["/api/users/loyalty"],
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
    onSuccess: (data: any) => {
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
    onSuccess: (data) => {
      if (data?.user) updateUser(data.user);
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

  const redeemCouponMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/redeem-coupon", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
      toast({ title: "Coupon redeemed", description: data.message || "Amount credited to wallet" });
      setCouponCode("");
      setCouponDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Coupon failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  if (!user) return null;

  const razorpayAvailable = !!razorpayConfig?.keyId;

  async function handleRazorpayPayment() {
    if (!user) return;
    const currentUser = user;
    const amount = Number(addAmount);
    if (!amount || amount <= 0) return;
    setRazorpayLoading(true);

    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount * 100 }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.message);

      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BATTLE NEST",
        description: "Wallet Top-up",
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.message);

            if (verifyData.user) updateUser(verifyData.user);
            queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
            toast({ title: "Payment Successful!", description: `\u20B9${amount} added to wallet` });
            setAddAmount("");
            setAddDialogOpen(false);
          } catch (err: any) {
            toast({ title: "Verification failed", description: err.message, variant: "destructive" });
          }
        },
        prefill: {
          email: currentUser.email,
          name: currentUser.username,
        },
        theme: {
          color: "#7c3aed",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setRazorpayLoading(false);
    }
  }

  const deposits = transactions?.filter(t => ["deposit", "admin_credit", "winning", "razorpay"].includes(t.type)) || [];
  const expenses = transactions?.filter(t => ["entry_fee", "withdrawal", "admin_debit"].includes(t.type)) || [];
  const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);
  const totalWinnings = transactions?.filter(t => t.type === "winning").reduce((s, t) => s + t.amount, 0) || 0;
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const mainWalletBalance = user.mainWalletBalance || 0;
  const bonusWalletBalance = user.bonusWalletBalance || 0;
  const totalWalletBalance = user.walletBalance || mainWalletBalance + bonusWalletBalance;
  const currentFeePercent = Number(loyalty?.benefits.platformFeePercent || 5);
  const withdrawalAmountPaisa = Math.max(0, Math.round(Number(withdrawAmount || 0) * 100));
  const estimatedFee = Math.max(0, Math.round((withdrawalAmountPaisa * currentFeePercent) / 100));
  const estimatedNet = Math.max(0, withdrawalAmountPaisa - estimatedFee);

  const txTypeIcons: Record<string, any> = {
    deposit: { icon: ArrowDownLeft, color: "text-chart-3", label: "Deposit" },
    razorpay: { icon: CreditCard, color: "text-chart-3", label: "Razorpay" },
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
    const isCredit = ["deposit", "winning", "admin_credit", "razorpay"].includes(tx.type);
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0" data-testid={`tx-${tx.id}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-md bg-muted ${config.color}`}>
            <config.icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{tx.description || config.label}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {tx.walletType && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
                  {tx.walletType}
                </Badge>
              )}
            </div>
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
                  {"\u20B9"}{(totalWalletBalance / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Main: {"\u20B9"}{(mainWalletBalance / 100).toFixed(2)} | Bonus: {"\u20B9"}{(bonusWalletBalance / 100).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-md">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
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
                    {razorpayAvailable ? (
                      <Button
                        className="w-full gap-2"
                        disabled={!addAmount || Number(addAmount) <= 0 || razorpayLoading}
                        onClick={handleRazorpayPayment}
                        data-testid="button-pay-razorpay"
                      >
                        <CreditCard className="w-4 h-4" />
                        {razorpayLoading ? "Processing..." : `Pay \u20B9${addAmount || "0"} via Razorpay`}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={!addAmount || Number(addAmount) <= 0 || addMoneyMutation.isPending}
                        onClick={() => addMoneyMutation.mutate()}
                        data-testid="button-confirm-add"
                      >
                        {addMoneyMutation.isPending ? "Adding..." : `Add \u20B9${addAmount || "0"}`}
                      </Button>
                    )}
                    {!razorpayAvailable && (
                      <p className="text-xs text-muted-foreground text-center">
                        Razorpay payment gateway will be enabled when API keys are configured.
                      </p>
                    )}
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
                    <p className="text-xs text-muted-foreground">
                      Withdrawals are processed from Main Wallet only. Daily limit applies.
                    </p>
                    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                      <p className="font-medium">
                        Tier: {loyalty?.tierLabel || "Bronze"} ({currentFeePercent}% fee)
                      </p>
                      <p className="text-muted-foreground">
                        Estimated fee: {"\u20B9"}{(estimatedFee / 100).toFixed(2)} | Estimated payout: {"\u20B9"}{(estimatedNet / 100).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!withdrawAmount || Number(withdrawAmount) < 50 || !upiId || withdrawMutation.isPending || mainWalletBalance < Number(withdrawAmount) * 100}
                      onClick={() => withdrawMutation.mutate()}
                      data-testid="button-confirm-withdraw"
                    >
                      {withdrawMutation.isPending ? "Submitting..." : `Withdraw \u20B9${withdrawAmount || "0"}`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 flex-1 min-w-[160px]" data-testid="button-redeem-coupon">
                    <TicketPercent className="w-4 h-4" /> Redeem Coupon
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Redeem Coupon Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Coupon Code</Label>
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        data-testid="input-coupon-code"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!couponCode.trim() || redeemCouponMutation.isPending}
                      onClick={() => redeemCouponMutation.mutate()}
                      data-testid="button-confirm-redeem-coupon"
                    >
                      {redeemCouponMutation.isPending ? "Redeeming..." : "Redeem Coupon"}
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
                            {typeof wd.netAmount === "number" && typeof wd.platformFee === "number" && (
                              <p className="text-xs text-muted-foreground">
                                Net: {"\u20B9"}{(wd.netAmount / 100).toFixed(2)} | Fee: {"\u20B9"}{(wd.platformFee / 100).toFixed(2)} ({wd.feePercent || 0}%)
                              </p>
                            )}
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
