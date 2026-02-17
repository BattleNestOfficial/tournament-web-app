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
  BarChart3, TrendingUp, DollarSign, UserCheck, X, Upload, ImageIcon, Trash2, Award,
  TicketPercent, Flag,
} from "lucide-react";
import { couponTypeValues, type Game, type Tournament, type User, type Withdrawal, type Banner, type Coupon, type Dispute } from "@shared/schema";

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
  if (user === undefined) return; // still loading
  if (!user || user.role !== "admin") {
    setLocation("/");
  }
}, [user, setLocation]);
  if (user === undefined) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      Loading admin panel...
    </div>
  );
}



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
        <TabsList className="grid w-full grid-cols-7 max-w-4xl">
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
          <TabsTrigger value="support" data-testid="tab-admin-support">
            <Flag className="w-3.5 h-3.5 mr-1.5" /> Support
          </TabsTrigger>
          <TabsTrigger value="banners" data-testid="tab-admin-banners">
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Banners
          </TabsTrigger>
          <TabsTrigger value="coupons" data-testid="tab-admin-coupons">
            <TicketPercent className="w-3.5 h-3.5 mr-1.5" /> Coupons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments"><TournamentManager token={token} /></TabsContent>
        <TabsContent value="games"><GameManager token={token} /></TabsContent>
        <TabsContent value="users"><UserManager token={token} /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalManager token={token} /></TabsContent>
        <TabsContent value="support"><SupportTicketManager token={token} /></TabsContent>
        <TabsContent value="banners"><BannerManager token={token} /></TabsContent>
        <TabsContent value="coupons"><CouponManager token={token} /></TabsContent>
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [prizes, setPrizes] = useState<{ position: number; prize: string }[]>([]);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [resultsTournament, setResultsTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState({
    title: "", gameId: "", entryFee: "", prizePool: "", maxSlots: "100",
    matchType: "solo", startTime: "", roomId: "", roomPassword: "", rules: "", mapName: "", imageUrl: "",
    description: "",
  });

  const { data: tournaments, isLoading } = useQuery<Tournament[]>({ queryKey: ["/api/tournaments"] });
  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/games"] });

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForm((f) => ({ ...f, imageUrl: data.imageUrl }));
      setImagePreview(data.imageUrl);
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editId ? `/api/admin/tournaments/${editId}` : "/api/admin/tournaments";
      const method = editId ? "PATCH" : "POST";
      const prizeDistribution = prizes.length > 0
        ? prizes.map((p) => ({ position: p.position, prize: Math.round(Number(p.prize) * 100) }))
        : null;
      const body: any = {
        title: form.title,
        gameId: Number(form.gameId),
        entryFee: Number(form.entryFee) * 100,
        prizePool: Number(form.prizePool) * 100,
        maxSlots: Number(form.maxSlots),
        matchType: form.matchType,
        startTime: form.startTime,
        roomId: form.roomId || null,
        roomPassword: form.roomPassword || null,
        rules: form.rules || null,
        mapName: form.mapName || null,
        imageUrl: form.imageUrl || null,
        description: form.description || null,
        prizeDistribution,
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
  const deleteTournamentMutation = useMutation({
  mutationFn: async (id: number) => {
    const res = await fetch(`/api/admin/tournaments/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to delete tournament");
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
    toast({ title: "Tournament deleted successfully" });
  },
  onError: (err: Error) => {
    toast({
      title: "Delete failed",
      description: err.message,
      variant: "destructive",
    });
  },
});

  function resetForm() {
    setForm({ title: "", gameId: "", entryFee: "", prizePool: "", maxSlots: "100", matchType: "solo", startTime: "", roomId: "", roomPassword: "", rules: "", mapName: "", imageUrl: "", description: "" });
    setEditId(null);
    setImagePreview(null);
    setPrizes([]);
  }

function editTournament(t: Tournament) {
  setEditId(t.id);
  setForm({
    title: t.title,
    gameId: t.gameId.toString(),
    entryFee: (t.entryFee / 100).toString(),
    prizePool: (t.prizePool / 100).toString(),
    maxSlots: t.maxSlots.toString(),
    matchType: t.matchType,
    startTime: new Date(t.startTime).toISOString().slice(0, 16),
    roomId: t.roomId || "",
    roomPassword: t.roomPassword || "",
    rules: t.rules || "",
    mapName: t.mapName || "",
    imageUrl: t.imageUrl || "",
    description: (t as any).description || "",
  });

  setImagePreview(t.imageUrl || null);

  const pd = t.prizeDistribution as { position: number; prize: number }[] | null;
  if (pd && Array.isArray(pd) && pd.length > 0) {
    setPrizes(pd.map((p) => ({ position: p.position, prize: (p.prize / 100).toString() })));
  } else {
    setPrizes([]);
  }

  setDialogOpen(true);
}
   

  const statusColors: Record<string, string> = {
    hot: "text-orange-500",
    upcoming: "text-chart-2",
    live: "text-destructive",
    completed: "text-muted-foreground",
    cancelled: "text-muted-foreground",
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Prize Distribution</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setPrizes([...prizes, { position: prizes.length + 1, prize: "" }])}
                    data-testid="button-add-winner"
                  >
                    <Plus className="w-3 h-3" /> Add Winner
                  </Button>
                </div>
                {prizes.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No prize distribution set. Click "Add Winner" to define prizes for each position.</p>
                )}
                {prizes.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground w-16">
                      <span className="font-medium">#{p.position}</span>
                    </div>
                    <Input
                      type="number"
                      value={p.prize}
                      onChange={(e) => {
                        const updated = [...prizes];
                        updated[idx] = { ...updated[idx], prize: e.target.value };
                        setPrizes(updated);
                      }}
                      placeholder="Prize amount"
                      className="flex-1"
                      data-testid={`input-prize-${idx}`}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">{"\u20B9"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => {
                        const updated = prizes.filter((_, i) => i !== idx).map((pr, i) => ({ ...pr, position: i + 1 }));
                        setPrizes(updated);
                      }}
                      data-testid={`button-remove-prize-${idx}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {prizes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Total: {"\u20B9"}{prizes.reduce((sum, p) => sum + (Number(p.prize) || 0), 0).toFixed(0)}
                    {form.prizePool && ` / ${"\u20B9"}${form.prizePool} prize pool`}
                  </p>
                )}
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
                <Label>Description (optional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short tournament description..." rows={2} data-testid="input-tournament-description" />
              </div>
              <div className="space-y-1.5">
                <Label>Rules</Label>
                <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Tournament rules..." rows={4} data-testid="input-tournament-rules" />
              </div>
              <div className="space-y-1.5">
                <Label>Tournament Image (optional)</Label>
                <div className="flex items-start gap-3">
                  <div className="w-24 h-24 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Tournament" className="w-full h-full object-cover" data-testid="img-tournament-preview" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="cursor-pointer" data-testid="label-upload-image">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                          e.target.value = "";
                        }}
                        data-testid="input-upload-image"
                      />
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none" tabIndex={-1}>
                        <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Upload Image"}
                      </Button>
                    </label>
                    <p className="text-[11px] text-muted-foreground">JPG, PNG, GIF, WebP. Max 5MB.</p>
                    {imagePreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit gap-1 text-xs text-destructive"
                        onClick={() => { setImagePreview(null); setForm((f) => ({ ...f, imageUrl: "" })); }}
                        data-testid="button-remove-image"
                      >
                        <X className="w-3 h-3" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
             
              <Button className="w-full" disabled={saveMutation.isPending || uploading || !form.title || !form.gameId || !form.startTime} onClick={() => saveMutation.mutate()} data-testid="button-save-tournament">
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
                      <SelectItem value="hot">Hot</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => editTournament(t)} data-testid={`button-edit-tournament-${t.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setResultsTournament(t); setResultsDialogOpen(true); }} data-testid={`button-results-tournament-${t.id}`}>
                    <Award className="w-3.5 h-3.5" />
                  </Button>
                  <Button
  size="sm"
  variant="outline"
  className="text-destructive hover:bg-destructive/10"
  disabled={deleteTournamentMutation.isPending}
  onClick={() => {
    const confirmDelete = window.confirm(
      "Are you sure? This will permanently delete this tournament."
    );
    if (confirmDelete) {
      deleteTournamentMutation.mutate(t.id);
    }
  }}
  data-testid={`button-delete-tournament-${t.id}`}
>
  <Trash2 className="w-3.5 h-3.5" />
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

      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" /> Declare Winners - {resultsTournament?.title}
            </DialogTitle>
          </DialogHeader>
          {resultsTournament && (
            <ResultsForm
              tournament={resultsTournament}
              token={token}
              onClose={() => { setResultsDialogOpen(false); setResultsTournament(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
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

type AdminDisputeRow = Dispute & { username?: string; resolvedByUsername?: string };

function SupportTicketManager({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: disputes, isLoading } = useQuery<AdminDisputeRow[]>({
    queryKey: ["/api/admin/disputes"],
    enabled: !!token,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "open" | "in_review" | "resolved" }) => {
      const res = await fetch(`/api/admin/disputes/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update ticket");
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/disputes"] });
      toast({ title: "Ticket updated", description: `Ticket #${vars.id} moved to ${vars.status.replace("_", " ")}.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const normalized = (disputes || []).map((item) => {
    const status = item.status === "in_review" ? "in_review" : item.status === "resolved" ? "resolved" : "open";
    return { ...item, status };
  });
  const filtered = normalized.filter((item) => statusFilter === "all" || item.status === statusFilter);

  const statusClass: Record<string, string> = {
    open: "text-muted-foreground",
    in_review: "text-chart-4",
    resolved: "text-chart-3",
  };

  const counts = {
    open: normalized.filter((item) => item.status === "open").length,
    inReview: normalized.filter((item) => item.status === "in_review").length,
    resolved: normalized.filter((item) => item.status === "resolved").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Support Ticket Queue</h3>
          <p className="text-sm text-muted-foreground">Open, review, and resolve user tickets.</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-admin-support-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open</p><p className="text-xl font-bold">{counts.open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Review</p><p className="text-xl font-bold">{counts.inReview}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-xl font-bold">{counts.resolved}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filtered.map((item) => (
                <div key={item.id} className="rounded-md border p-3 space-y-2" data-testid={`admin-ticket-${item.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">Ticket #{item.id}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusClass[item.status] || "text-muted-foreground"}`}>
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.username || `User #${item.userId}`} | {new Date(item.createdAt).toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground">Accused Game Name: {item.accusedGameName || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">Tournament Name/ID: {item.tournamentRef || "N/A"}</p>
                  <p className="text-sm">{item.description}</p>
                  {item.screenshotUrl && (
                    <a href={item.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                      View screenshot evidence
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.status !== "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: item.id, status: "open" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-ticket-open-${item.id}`}
                      >
                        Move to Open
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: item.id, status: "in_review" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-ticket-review-${item.id}`}
                    >
                      In Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-chart-3"
                      onClick={() => updateStatusMutation.mutate({ id: item.id, status: "resolved" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-ticket-resolved-${item.id}`}
                    >
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No support tickets found for the selected filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BannerManager({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerLink, setBannerLink] = useState("");

  const { data: adminBanners, isLoading } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners"],
    enabled: !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      toast({ title: "Banner deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  async function handleBannerUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (bannerTitle) formData.append("title", bannerTitle);
      if (bannerLink) formData.append("linkUrl", bannerLink);
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banners"] });
      setBannerTitle("");
      setBannerLink("");
      toast({ title: "Banner uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const bannerCount = adminBanners?.length || 0;
  const canAdd = bannerCount < 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Promotional Home Carousel</h3>
          <p className="text-sm text-muted-foreground">
            {bannerCount}/5 banners uploaded. Add promotional ads, sponsor creatives, or featured-match banners. Home rotates these automatically every 5 seconds.
          </p>
        </div>
      </div>

      {canAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Add New Promo Banner</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title (optional)</Label>
                <Input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Banner title" data-testid="input-banner-title" />
              </div>
              <div className="space-y-1.5">
                <Label>Link URL (optional)</Label>
                <Input value={bannerLink} onChange={(e) => setBannerLink(e.target.value)} placeholder="/tournaments or https://..." data-testid="input-banner-link" />
              </div>
            </div>
            <label className="cursor-pointer inline-block" data-testid="label-upload-banner">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerUpload(file);
                  e.target.value = "";
                }}
                data-testid="input-upload-banner"
              />
              <Button type="button" variant="outline" className="gap-1.5 pointer-events-none" tabIndex={-1} disabled={uploading}>
                <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading..." : "Upload Promo Image"}
              </Button>
            </label>
            <p className="text-[11px] text-muted-foreground">Recommended: 1200x400px or wider. JPG, PNG, GIF, WebP. Max 5MB.</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : adminBanners && adminBanners.length > 0 ? (
        <div className="space-y-3">
          {adminBanners.map((banner, idx) => (
            <Card key={banner.id} data-testid={`admin-banner-${banner.id}`}>
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-32 h-20 rounded-md overflow-hidden shrink-0 bg-muted">
                  <img src={banner.imageUrl} alt={banner.title || `Banner ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-banner-${banner.id}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-sm truncate">{banner.title || `Banner ${idx + 1}`}</p>
                  {banner.linkUrl && <p className="text-xs text-muted-foreground truncate">{banner.linkUrl}</p>}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${banner.enabled ? "text-chart-2" : "text-muted-foreground"}`}>
                      {banner.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={banner.enabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: banner.id, enabled: checked })}
                      data-testid={`switch-banner-${banner.id}`}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(banner.id)}
                    data-testid={`button-delete-banner-${banner.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No banners uploaded yet. Add up to 5 promo banners for the home page carousel.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CouponManager({ token }: { token: string | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    code: "",
    couponType: "bonus_credit" as (typeof couponTypeValues)[number],
    value: "",
    enabled: true,
    globalUsageLimit: "",
    perUserLimit: "1",
    expiresAt: "",
    minEntryFee: "",
    fraudHookEnabled: false,
  });

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
    enabled: !!token,
  });

  const { data: analytics = [] } = useQuery<Array<{
    couponId: number;
    totalUsage: number;
    uniqueUsers: number;
    totalDiscountAmount: number;
    totalBonusAmount: number;
    lastRedeemedAt: string | Date | null;
  }>>({
    queryKey: ["/api/admin/coupons/analytics"],
    enabled: !!token,
  });

  const analyticsByCouponId = new Map(analytics.map((row) => [Number(row.couponId), row]));
  const tournamentCouponTypes = new Set(["flat_discount", "free_entry"]);
  const valueOptional = form.couponType === "free_entry";

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = form.value === "" ? 0 : Number(form.value);
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          couponType: form.couponType,
          value,
          enabled: form.enabled,
          globalUsageLimit: form.globalUsageLimit ? Number(form.globalUsageLimit) : null,
          perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          minEntryFee: tournamentCouponTypes.has(form.couponType) && form.minEntryFee ? Number(form.minEntryFee) : null,
          fraudHookEnabled: form.fraudHookEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons/analytics"] });
      toast({ title: "Coupon created" });
      setForm({
        code: "",
        couponType: "bonus_credit",
        value: "",
        enabled: true,
        globalUsageLimit: "",
        perUserLimit: "1",
        expiresAt: "",
        minEntryFee: "",
        fraudHookEnabled: false,
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons/analytics"] });
      toast({ title: "Coupon deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const couponTypeLabel: Record<(typeof couponTypeValues)[number], string> = {
    flat_discount: "Flat Discount",
    free_entry: "Free Entry",
    bonus_credit: "Bonus Credit",
  };

  function formatCouponValue(coupon: Coupon) {
    const type = String(coupon.couponType || "bonus_credit");
    const value = Number(coupon.value ?? coupon.amount ?? 0);
    if (type === "free_entry") return "Free Entry";
    return `\u20B9${(value / 100).toFixed(0)}`;
  }

  const valueLabel = "Value (\u20B9)";
  const canCreate =
    !!form.code.trim() &&
    (valueOptional || (!!form.value && Number(form.value) > 0)) &&
    !createMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Coupon Engine</h3>
        <p className="text-sm text-muted-foreground">
          Create flat discount, free entry, and bonus credit coupons.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Create Coupon</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Coupon Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. JOIN50"
                data-testid="input-coupon-code-admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coupon Type</Label>
              <Select value={form.couponType} onValueChange={(value) => setForm((prev) => ({ ...prev, couponType: value as (typeof couponTypeValues)[number] }))}>
                <SelectTrigger data-testid="select-coupon-type-admin">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {couponTypeValues.map((type) => (
                    <SelectItem key={type} value={type}>{couponTypeLabel[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{valueLabel}</Label>
              <Input
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={form.couponType === "free_entry" ? "Optional for free entry" : "e.g. 50"}
                data-testid="input-coupon-value-admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Global Usage Limit</Label>
              <Input
                type="number"
                min="1"
                value={form.globalUsageLimit}
                onChange={(e) => setForm((prev) => ({ ...prev, globalUsageLimit: e.target.value }))}
                placeholder="Leave empty for unlimited"
                data-testid="input-coupon-global-limit-admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Per-User Limit</Label>
              <Input
                type="number"
                min="1"
                value={form.perUserLimit}
                onChange={(e) => setForm((prev) => ({ ...prev, perUserLimit: e.target.value }))}
                data-testid="input-coupon-user-limit-admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                data-testid="input-coupon-expiry-admin"
              />
            </div>
            {tournamentCouponTypes.has(form.couponType) && (
              <div className="space-y-1.5">
                <Label>Min Entry Fee (\u20B9)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minEntryFee}
                  onChange={(e) => setForm((prev) => ({ ...prev, minEntryFee: e.target.value }))}
                  placeholder="Optional"
                  data-testid="input-coupon-min-entry-admin"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))} />
              <Label>Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.fraudHookEnabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, fraudHookEnabled: checked }))} />
              <Label>Fraud Hook</Label>
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canCreate}
            data-testid="button-create-coupon-admin"
          >
            {createMutation.isPending ? "Creating..." : "Create Coupon"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : coupons && coupons.length > 0 ? (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} data-testid={`admin-coupon-${coupon.id}`}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold tracking-wide">{coupon.code}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">
                      {couponTypeLabel[(String(coupon.couponType || "bonus_credit") as (typeof couponTypeValues)[number])] || coupon.couponType}
                    </Badge>
                    <span className="text-muted-foreground">Value: {formatCouponValue(coupon)}</span>
                    <span className="text-muted-foreground">Per-user: {coupon.perUserLimit || 1}</span>
                    <span className="text-muted-foreground">Global: {coupon.globalUsageLimit ?? "Unlimited"}</span>
                    <span className="text-muted-foreground">Used: {analyticsByCouponId.get(coupon.id)?.totalUsage ?? coupon.totalUsageCount ?? 0}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Users: {analyticsByCouponId.get(coupon.id)?.uniqueUsers ?? 0}</span>
                    {!!analyticsByCouponId.get(coupon.id)?.totalDiscountAmount && (
                      <span>Discount: \u20B9{((analyticsByCouponId.get(coupon.id)?.totalDiscountAmount || 0) / 100).toFixed(0)}</span>
                    )}
                    {!!analyticsByCouponId.get(coupon.id)?.totalBonusAmount && (
                      <span>Bonus: \u20B9{((analyticsByCouponId.get(coupon.id)?.totalBonusAmount || 0) / 100).toFixed(0)}</span>
                    )}
                    {coupon.expiresAt && <span>Expires: {new Date(coupon.expiresAt).toLocaleString()}</span>}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate(coupon.id)}
                  data-testid={`button-delete-coupon-${coupon.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <TicketPercent className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No coupon codes created yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type ParticipantData = { id: number; userId: number; username?: string; displayName?: string; inGameName?: string };

function ResultsForm({ tournament, token, onClose }: { tournament: Tournament; token: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const [winners, setWinners] = useState<{ userId: string; position: number; kills: string; prize: string }[]>([
    { userId: "", position: 1, kills: "0", prize: "" },
  ]);

  const { data: participants } = useQuery<ParticipantData[]>({
    queryKey: ["/api/tournaments", tournament.id.toString(), "participants"],
  });

  const declareMutation = useMutation({
    mutationFn: async () => {
      const resultData = winners
        .filter(w => w.userId)
        .map(w => ({
          userId: Number(w.userId),
          position: w.position,
          kills: Number(w.kills) || 0,
          prize: Math.round(Number(w.prize || 0) * 100),
        }));
      if (resultData.length === 0) throw new Error("Add at least one winner");
      const res = await fetch(`/api/admin/tournaments/${tournament.id}/results`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ results: resultData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournament.id.toString(), "results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournament.id.toString(), "participants"] });
      toast({ title: "Winners declared and prizes distributed!" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function addWinner() {
    setWinners(prev => [...prev, { userId: "", position: prev.length + 1, kills: "0", prize: "" }]);
  }

  function removeWinner(i: number) {
    setWinners(prev => prev.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, position: idx + 1 })));
  }

  function updateWinner(i: number, field: string, value: string) {
    setWinners(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: value } : w));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select winners from the participant list. Prizes are in Rupees and will be credited to winner wallets.
      </p>

      <div className="space-y-3">
        {winners.map((w, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs">#{w.position}</Badge>
                {winners.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removeWinner(i)} data-testid={`button-remove-winner-${i}`}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Participant</Label>
                <Select value={w.userId} onValueChange={(v) => updateWinner(i, "userId", v)}>
                  <SelectTrigger className="text-xs" data-testid={`select-winner-${i}`}>
                    <SelectValue placeholder="Select participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants?.map(p => (
                      <SelectItem key={p.userId} value={p.userId.toString()}>
                        {p.displayName || p.username || `Player #${p.userId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Kills</Label>
                  <Input
                    type="number"
                    min="0"
                    value={w.kills}
                    onChange={(e) => updateWinner(i, "kills", e.target.value)}
                    data-testid={`input-winner-kills-${i}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prize ({"\u20B9"})</Label>
                  <Input
                    type="number"
                    min="0"
                    value={w.prize}
                    onChange={(e) => updateWinner(i, "prize", e.target.value)}
                    placeholder="0"
                    data-testid={`input-winner-prize-${i}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={addWinner} data-testid="button-add-winner">
        <Plus className="w-4 h-4" /> Add Winner Position
      </Button>

      <Button
        className="w-full"
        disabled={declareMutation.isPending || winners.every(w => !w.userId)}
        onClick={() => declareMutation.mutate()}
        data-testid="button-declare-winners"
      >
        {declareMutation.isPending ? "Declaring..." : "Declare Winners & Distribute Prizes"}
      </Button>
    </div>
  );
}


