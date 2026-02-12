import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Trophy, Users, Gamepad2, Wallet, Shield, Plus, Edit, Ban, CheckCircle, Clock,
  BarChart3, TrendingUp, DollarSign, UserCheck, X,
} from "lucide-react";
import type { Game, Tournament, User, Withdrawal } from "@shared/schema";

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || user.role !== "admin") setLocation("/");
  }, [user, setLocation]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-md">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage games, tournaments, users and withdrawals</p>
        </div>
      </div>

      <AdminStats token={token} />

      <Tabs defaultValue="tournaments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="tournaments" data-testid="tab-admin-tournaments">
            <Trophy className="w-3.5 h-3.5 mr-1.5" /> Tournaments
          </TabsTrigger>
          <TabsTrigger value="games" data-testid="tab-admin-games">
            <Gamepad2 className="w-3.5 h-3.5 mr-1.5" /> Games
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-admin-users">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-admin-withdrawals">
            <Wallet className="w-3.5 h-3.5 mr-1.5" /> Withdrawals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments"><TournamentManager token={token} /></TabsContent>
        <TabsContent value="games"><GameManager token={token} /></TabsContent>
        <TabsContent value="users"><UserManager token={token} /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalManager token={token} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminStats({ token }: { token: string | null }) {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}
      </div>
    );
  }

  const items = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-chart-2" },
    { label: "Total Revenue", value: `\u20B9${((stats?.totalRevenue || 0) / 100).toFixed(0)}`, icon: DollarSign, color: "text-chart-3" },
    { label: "Active Tournaments", value: stats?.activeTournaments || 0, icon: Trophy, color: "text-chart-4" },
    { label: "Total Payouts", value: `\u20B9${((stats?.totalPayouts || 0) / 100).toFixed(0)}`, icon: TrendingUp, color: "text-chart-1" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 bg-muted rounded-md ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold" data-testid={`text-admin-${item.label.toLowerCase().replace(/\s/g, "-")}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TournamentManager({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", gameId: "", entryFee: "", prizePool: "", maxSlots: "100",
    matchType: "solo", startTime: "", roomId: "", roomPassword: "", rules: "", mapName: "",
  });

  const { data: tournaments, isLoading } = useQuery<Tournament[]>({ queryKey: ["/api/tournaments"] });
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/admin/tournaments/${editId}` : "/api/admin/tournaments";
      const method = editId ? "PATCH" : "POST";
      const body = {
        title: form.title,
        gameId: Number(form.gameId),
        entryFee: Number(form.entryFee) * 100,
        prizePool: Number(form.prizePool) * 100,
        maxSlots: Number(form.maxSlots),
        matchType: form.matchType,
        startTime: new Date(form.startTime).toISOString(),
        roomId: form.roomId || null,
        roomPassword: form.roomPassword || null,
        rules: form.rules || null,
        mapName: form.mapName || null,
      };
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      toast({ title: editId ? "Tournament updated" : "Tournament created" });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/tournaments/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ title: "", gameId: "", entryFee: "", prizePool: "", maxSlots: "100", matchType: "solo", startTime: "", roomId: "", roomPassword: "", rules: "", mapName: "" });
    setEditId(null);
  }

  function editTournament(t: Tournament) {
    setEditId(t.id);
    setForm({
      title: t.title, gameId: t.gameId.toString(), entryFee: (t.entryFee / 100).toString(),
      prizePool: (t.prizePool / 100).toString(), maxSlots: t.maxSlots.toString(),
      matchType: t.matchType, startTime: new Date(t.startTime).toISOString().slice(0, 16),
      roomId: t.roomId || "", roomPassword: t.roomPassword || "", rules: t.rules || "", mapName: t.mapName || "",
    });
    setDialogOpen(true);
  }

  const statusColors: Record<string, string> = {
    upcoming: "text-chart-2", live: "text-destructive", completed: "text-muted-foreground", cancelled: "text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">Manage Tournaments</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-tournament"><Plus className="w-4 h-4" /> Create Tournament</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Tournament" : "Create Tournament"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tournament title" data-testid="input-tournament-title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Game</Label>
                  <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
                    <SelectTrigger data-testid="select-tournament-game"><SelectValue placeholder="Select game" /></SelectTrigger>
                    <SelectContent>
                      {games?.filter((g) => g.enabled).map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Match Type</Label>
                  <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v })}>
                    <SelectTrigger data-testid="select-tournament-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Solo</SelectItem>
                      <SelectItem value="duo">Duo</SelectItem>
                      <SelectItem value="squad">Squad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Entry Fee ({"\u20B9"})</Label>
                  <Input type="number" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: e.target.value })} placeholder="0" data-testid="input-tournament-fee" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prize Pool ({"\u20B9"})</Label>
                  <Input type="number" value={form.prizePool} onChange={(e) => setForm({ ...form, prizePool: e.target.value })} placeholder="1000" data-testid="input-tournament-prize" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Slots</Label>
                  <Input type="number" value={form.maxSlots} onChange={(e) => setForm({ ...form, maxSlots: e.target.value })} placeholder="100" data-testid="input-tournament-slots" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} data-testid="input-tournament-time" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Room ID (optional)</Label>
                  <Input value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} placeholder="Room ID" data-testid="input-tournament-roomid" />
                </div>
                <div className="space-y-1.5">
                  <Label>Room Password (optional)</Label>
                  <Input value={form.roomPassword} onChange={(e) => setForm({ ...form, roomPassword: e.target.value })} placeholder="Password" data-testid="input-tournament-roompw" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Map Name (optional)</Label>
                <Input value={form.mapName} onChange={(e) => setForm({ ...form, mapName: e.target.value })} placeholder="e.g. Erangel, Bermuda" data-testid="input-tournament-map" />
              </div>
              <div className="space-y-1.5">
                <Label>Rules (optional)</Label>
                <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Tournament rules..." rows={3} data-testid="input-tournament-rules" />
              </div>
              <Button className="w-full" disabled={saveMutation.isPending || !form.title || !form.gameId || !form.startTime} onClick={() => saveMutation.mutate()} data-testid="button-save-tournament">
                {saveMutation.isPending ? "Saving..." : editId ? "Update Tournament" : "Create Tournament"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {tournaments?.map((t) => (
            <Card key={t.id} data-testid={`admin-tournament-${t.id}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-muted rounded-md"><Trophy className="w-4 h-4 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{games?.find((g) => g.id === t.gameId)?.name}</span>
                      <span>{"\u20B9"}{(t.prizePool / 100).toFixed(0)} prize</span>
                      <span>{t.filledSlots}/{t.maxSlots} slots</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${statusColors[t.status]}`}>{t.status}</Badge>
                  <Select
                    value={t.status}
                    onValueChange={(v) => statusMutation.mutate({ id: t.id, status: v })}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => editTournament(t)} data-testid={`button-edit-tournament-${t.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!tournaments || tournaments.length === 0) && (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No tournaments yet. Create one!</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}

function GameManager({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const { data: games, isLoading } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-"), enabled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game added!" });
      setName(""); setSlug(""); setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/admin/games/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/games"] }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">Manage Games</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-game"><Plus className="w-4 h-4" /> Add Game</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Game</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Game Name</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }} placeholder="e.g. Fortnite" data-testid="input-game-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. fortnite" data-testid="input-game-slug" />
              </div>
              <Button className="w-full" disabled={!name || createMutation.isPending} onClick={() => createMutation.mutate()} data-testid="button-save-game">
                {createMutation.isPending ? "Adding..." : "Add Game"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {games?.map((g) => (
            <Card key={g.id} data-testid={`admin-game-${g.id}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-md"><Gamepad2 className="w-4 h-4 text-primary" /></div>
                  <div>
                    <p className="font-semibold text-sm">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`text-[10px] ${g.enabled ? "text-chart-3" : "text-muted-foreground"}`}>
                    {g.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Switch
                    checked={g.enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: g.id, enabled: checked })}
                    data-testid={`switch-game-${g.id}`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UserManager({ token }: { token: string | null }) {
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!token,
  });

  const banMutation = useMutation({
    mutationFn: async ({ id, banned }: { id: number; banned: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}/ban`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Manage Users</h2>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {users?.map((u) => (
            <Card key={u.id} data-testid={`admin-user-${u.id}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-muted rounded-md"><Users className="w-4 h-4 text-primary" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{u.username}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge>
                      {u.banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span>{u.email}</span>
                      <span>Wallet: {"\u20B9"}{((u.walletBalance || 0) / 100).toFixed(0)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.role !== "admin" && (
                    <Button
                      size="sm"
                      variant={u.banned ? "outline" : "destructive"}
                      onClick={() => banMutation.mutate({ id: u.id, banned: !u.banned })}
                      data-testid={`button-ban-user-${u.id}`}
                    >
                      {u.banned ? <><CheckCircle className="w-3.5 h-3.5 mr-1" /> Unban</> : <><Ban className="w-3.5 h-3.5 mr-1" /> Ban</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!users || users.length === 0) && (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No users found</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}

function WithdrawalManager({ token }: { token: string | null }) {
  const { toast } = useToast();

  const { data: withdrawals, isLoading } = useQuery<(Withdrawal & { username?: string })[]>({
    queryKey: ["/api/admin/withdrawals"],
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      toast({ title: "Withdrawal updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusIcons: Record<string, any> = {
    pending: { icon: Clock, color: "text-chart-4" },
    approved: { icon: CheckCircle, color: "text-chart-3" },
    rejected: { icon: X, color: "text-destructive" },
    paid: { icon: CheckCircle, color: "text-chart-2" },
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Withdrawal Requests</h2>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {withdrawals?.map((wd) => {
            const config = statusIcons[wd.status] || { icon: Clock, color: "text-muted-foreground" };
            return (
              <Card key={wd.id} data-testid={`admin-withdrawal-${wd.id}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 bg-muted rounded-md ${config.color}`}>
                      <config.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">
                        {"\u20B9"}{(wd.amount / 100).toFixed(0)} - {wd.username || `User #${wd.userId}`}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>UPI: {wd.upiId || "N/A"}</span>
                        <span>{new Date(wd.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>{wd.status}</Badge>
                    {wd.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-chart-3" onClick={() => updateMutation.mutate({ id: wd.id, status: "approved" })} data-testid={`button-approve-wd-${wd.id}`}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateMutation.mutate({ id: wd.id, status: "rejected" })} data-testid={`button-reject-wd-${wd.id}`}>
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {wd.status === "approved" && (
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: wd.id, status: "paid" })} data-testid={`button-paid-wd-${wd.id}`}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!withdrawals || withdrawals.length === 0) && (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No withdrawal requests</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
