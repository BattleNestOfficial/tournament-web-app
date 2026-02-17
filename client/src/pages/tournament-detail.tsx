import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams, useSearch } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Copy,
  Crown,
  FileText,
  Gamepad2,
  Lock,
  Medal,
  ScrollText,
  Shield,
  Swords,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

import type { Game, Registration, Result, Tournament } from "@shared/schema";

type Participant = Registration & {
  username?: string;
  displayName?: string;
  teamName?: string | null;
};

type PrizeRow = {
  position: number;
  prize: number;
};

function formatMoney(amount = 0) {
  return `INR ${(amount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(value: unknown): "hot" | "upcoming" | "live" | "completed" | "cancelled" {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "hot") return "hot";
  if (raw === "upcoming") return "upcoming";
  if (raw === "live") return "live";
  if (raw === "completed") return "completed";
  return "cancelled";
}

function getStatusBadgeClasses(status: ReturnType<typeof normalizeStatus>) {
  if (status === "hot") return "bg-amber-500/15 text-amber-300 border-amber-400/60";
  if (status === "upcoming") return "bg-indigo-500/15 text-indigo-300 border-indigo-400/60";
  if (status === "live") return "bg-red-500/15 text-red-300 border-red-500/60";
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/60";
  return "bg-slate-500/15 text-slate-300 border-slate-400/50";
}

function getTournamentImage(t: Tournament, g?: Game) {
  if (t?.imageUrl) return t.imageUrl;
  if (g?.imageUrl) return g.imageUrl;
  return "/tournament-placeholder.jpg";
}

function getIGNForGame(slug: string, user: any) {
  if (!user) return "";
  const normalizedSlug = String(slug || "").toLowerCase().trim();
  if (normalizedSlug.includes("bgmi")) return user.bgmiIgn || user.bgmiId || "";
  if (normalizedSlug.includes("free-fire") || normalizedSlug.includes("freefire") || normalizedSlug.includes("free_fire")) {
    return user.freeFireIgn || user.freeFireId || "";
  }
  if (normalizedSlug.includes("cod")) return user.codIgn || user.codMobileId || "";
  return "";
}

function getIgnProfileFieldForGame(slug: string): "bgmiIgn" | "freeFireIgn" | "codIgn" | null {
  const normalizedSlug = String(slug || "").toLowerCase().trim();
  if (normalizedSlug.includes("bgmi")) return "bgmiIgn";
  if (normalizedSlug.includes("free-fire") || normalizedSlug.includes("freefire") || normalizedSlug.includes("free_fire")) return "freeFireIgn";
  if (normalizedSlug.includes("cod")) return "codIgn";
  return null;
}

function parsePrizeDistribution(input: unknown): PrizeRow[] {
  if (Array.isArray(input)) {
    return input
      .map((item: any) => ({
        position: Number(item?.position),
        prize: Number(item?.prize),
      }))
      .filter((item) => Number.isFinite(item.position) && item.position > 0 && Number.isFinite(item.prize) && item.prize >= 0)
      .sort((a, b) => a.position - b.position);
  }

  if (typeof input === "string" && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      return parsePrizeDistribution(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function useCountdown(target: string | Date, status: ReturnType<typeof normalizeStatus>) {
  const [value, setValue] = useState("");

  useEffect(() => {
    function tick() {
      if (status === "completed") {
        setValue("Completed");
        return;
      }
      if (status === "live") {
        setValue("LIVE");
        return;
      }

      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setValue("LIVE");
        return;
      }

      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const seconds = Math.floor((ms / 1000) % 60);
      setValue(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, status]);

  return value;
}

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || text || `Request failed (${res.status})`);
  }

  return (data ?? {}) as T;
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = Number(id);
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const { user, token, updateUser } = useAuth();
  const { toast } = useToast();

  const [joinOpen, setJoinOpen] = useState(false);
  const [ign, setIgn] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [bannerImageFailed, setBannerImageFailed] = useState(false);
  const [copiedField, setCopiedField] = useState<"roomId" | "roomPassword" | null>(null);

  const tournamentQuery = useQuery<Tournament>({
    queryKey: ["/api/tournaments", tournamentId.toString()],
    enabled: Number.isInteger(tournamentId) && tournamentId > 0,
    queryFn: async () =>
      fetchJsonOrThrow<Tournament>(`/api/tournaments/${tournamentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
  });

  const gamesQuery = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const registrationsQuery = useQuery<Registration[]>({
    queryKey: ["/api/registrations/my"],
    enabled: !!user && !!token,
    queryFn: async () =>
      fetchJsonOrThrow<Registration[]>("/api/registrations/my", {
        headers: { Authorization: `Bearer ${token}` },
      }),
  });

  const teamsQuery = useQuery<any[]>({
    queryKey: ["/api/teams/my"],
    enabled: !!user && !!token,
    queryFn: async () =>
      fetchJsonOrThrow<any[]>("/api/teams/my", {
        headers: { Authorization: `Bearer ${token}` },
      }),
  });

  const participantsQuery = useQuery<Participant[]>({
    queryKey: ["/api/tournaments", tournamentId.toString(), "participants"],
    enabled: Number.isInteger(tournamentId) && tournamentId > 0,
    queryFn: async () => fetchJsonOrThrow<Participant[]>(`/api/tournaments/${tournamentId}/participants`),
  });

  const resultsQuery = useQuery<Result[]>({
    queryKey: ["/api/tournaments", tournamentId.toString(), "results"],
    enabled: Number.isInteger(tournamentId) && tournamentId > 0,
    queryFn: async () => fetchJsonOrThrow<Result[]>(`/api/tournaments/${tournamentId}/results`),
  });

  const tournament = tournamentQuery.data;
  const games = gamesQuery.data || [];
  const registrations = registrationsQuery.data || [];
  const teams = teamsQuery.data || [];
  const participants = participantsQuery.data || [];
  const results = resultsQuery.data || [];

  const game = useMemo(() => games.find((g) => g.id === tournament?.gameId), [games, tournament]);
  const normalizedStatus = normalizeStatus(tournament?.status);
  const countdown = useCountdown(tournament?.startTime || new Date(), normalizedStatus);
  const joined = registrations.some((r) => r.tournamentId === tournament?.id);
  const isSolo = tournament?.matchType === "solo";
  const isDuo = tournament?.matchType === "duo";
  const isSquad = tournament?.matchType === "squad";
  const canJoinTournament = normalizedStatus === "upcoming" || normalizedStatus === "hot";
  const walletInsufficient = !!user && !!tournament && tournament.entryFee > 0 && (user.walletBalance || 0) < tournament.entryFee;
  const currentWalletBalance = user?.walletBalance || 0;
  const walletAfterJoin = Math.max(0, currentWalletBalance - (tournament?.entryFee || 0));
  const prizeDistribution = useMemo(() => parsePrizeDistribution(tournament?.prizeDistribution), [tournament?.prizeDistribution]);
  const sortedResults = useMemo(() => [...results].sort((a, b) => a.position - b.position), [results]);
  const participantNameByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of participants) {
      map.set(p.userId, p.displayName || p.username || `Player #${p.userId}`);
    }
    return map;
  }, [participants]);

  const eligibleTeams = useMemo(() => {
    if (isDuo) return teams.filter((t) => t.members?.length === 2);
    if (isSquad) return teams.filter((t) => t.members?.length === 4);
    return [];
  }, [teams, isDuo, isSquad]);

  const slotsProgress = useMemo(() => {
    if (!tournament) return 0;
    return Math.min(100, (tournament.filledSlots / Math.max(tournament.maxSlots, 1)) * 100);
  }, [tournament]);

  async function copyToClipboard(value: string, field: "roomId" | "roomPassword") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1200);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  }

  async function refreshLatestUserProfile() {
    if (!token) return user;
    try {
      const data = await fetchJsonOrThrow<{ user: any }>("/api/users/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (data?.user && typeof updateUser === "function") {
        updateUser(data.user);
      }
      return data?.user || user;
    } catch {
      return user;
    }
  }

  async function openJoinModal() {
    if (!tournament) return;
    if (!user) {
      setLocation("/auth");
      return;
    }
    if (joined) {
      toast({ title: "Already registered" });
      return;
    }
    if (!canJoinTournament) {
      toast({ title: "Registration closed", description: "This match is no longer accepting entries.", variant: "destructive" });
      return;
    }
    if (walletInsufficient) {
      toast({
        title: "Insufficient wallet balance",
        description: `You need ${formatMoney(tournament.entryFee)} to join this tournament.`,
        variant: "destructive",
      });
      return;
    }

    const latestUser = await refreshLatestUserProfile();
    if (!latestUser) {
      setLocation("/auth");
      return;
    }

    if (isSolo && game?.slug) {
      setIgn(getIGNForGame(game.slug, latestUser));
      setTeamId(null);
    } else if (isDuo || isSquad) {
      if (eligibleTeams.length === 0) {
        toast({
          title: `No ${isDuo ? "duo" : "squad"} team found`,
          description: `Create a ${isDuo ? "duo" : "squad"} team first to join this match.`,
          variant: "destructive",
        });
        setLocation("/teams");
        return;
      }
      const ownedEligibleTeam = eligibleTeams.find((team: any) => Number(team.ownerId) === Number(user.id));
      const defaultTeam = ownedEligibleTeam || eligibleTeams[0];
      setTeamId(defaultTeam?.id ? Number(defaultTeam.id) : null);
    } else {
      setTeamId(null);
    }

    setJoinOpen(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("action") !== "join") return;
    if (!tournament || joinOpen || joined) return;
    void openJoinModal();
  }, [searchString, tournament, joinOpen, joined]);

  useEffect(() => {
    if (!joinOpen || !isSolo || !user || !game?.slug) return;
    if (ign.trim()) return;
    const profileIgn = getIGNForGame(game.slug, user);
    if (profileIgn) {
      setIgn(profileIgn);
    }
  }, [joinOpen, isSolo, user, game?.slug, ign]);

  useEffect(() => {
    if (!joinOpen || isSolo) return;
    if (teamId) return;
    if (eligibleTeams.length === 0) return;

    const ownedEligibleTeam = eligibleTeams.find((team: any) => Number(team.ownerId) === Number(user?.id));
    const defaultTeam = ownedEligibleTeam || eligibleTeams[0];
    if (defaultTeam?.id) {
      setTeamId(Number(defaultTeam.id));
    }
  }, [joinOpen, isSolo, teamId, eligibleTeams, user?.id]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Please login to join.");
      if (!tournament) throw new Error("Tournament not found");
      if (!canJoinTournament) throw new Error("Registration is closed for this match.");
      if (walletInsufficient) throw new Error("Insufficient wallet balance.");

      if (tournament.matchType === "solo" && !ign.trim()) {
        throw new Error("Please enter your in-game name.");
      }

      if (tournament.matchType !== "solo") {
        if (!teamId) throw new Error("Please select a team.");
        if (!eligibleTeams.some((t: any) => Number(t.id) === Number(teamId))) {
          throw new Error("Selected team is not eligible for this match type.");
        }
      }

      const payload = tournament.matchType === "solo" ? { inGameName: ign.trim() } : { teamId };
      const joinData = await fetchJsonOrThrow<any>(`/api/tournaments/${tournamentId}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let profileUser: any = null;
      if (tournament.matchType === "solo" && game?.slug) {
        const nextIgn = ign.trim();
        const currentIgn = getIGNForGame(game.slug, user);
        const ignField = getIgnProfileFieldForGame(game.slug);

        if (ignField && nextIgn && nextIgn !== currentIgn) {
          try {
            const profileUpdate = await fetchJsonOrThrow<{ user: any }>("/api/users/profile", {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ [ignField]: nextIgn }),
            });
            profileUser = profileUpdate?.user || null;
          } catch {
            profileUser = null;
          }
        }
      }

      return { joinData, profileUser };
    },
    onSuccess: async (data) => {
      const nextUser = data?.profileUser || data?.joinData?.user;
      if (nextUser && typeof updateUser === "function") {
        updateUser(nextUser);
      }
      toast({ title: "Successfully joined tournament" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId.toString()] }),
        queryClient.invalidateQueries({ queryKey: ["/api/registrations/my"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/tournaments", tournamentId.toString(), "participants"] }),
      ]);
      setJoinOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Join failed",
        description: err?.message || "Something went wrong while joining.",
        variant: "destructive",
      });
    },
  });

  if (tournamentQuery.isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (tournamentQuery.isError || !tournament) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-red-500/40 bg-black/40">
          <CardHeader>
            <CardTitle>Failed to load tournament</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {(tournamentQuery.error as any)?.message || "Tournament data is currently unavailable."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => tournamentQuery.refetch()}>Retry</Button>
              <Button onClick={() => setLocation("/tournaments")}>Back to tournaments</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Button variant="ghost" onClick={() => setLocation("/tournaments")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <Card className="overflow-hidden">
        <div className="relative h-[320px]">
          {!bannerImageFailed ? (
            <img
              src={getTournamentImage(tournament, game)}
              alt={tournament.title}
              className="w-full h-full object-cover"
              onError={() => setBannerImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-700/40 via-green-900/40 to-black flex items-center justify-center">
              <div className="text-center text-white/85">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Tournament Image Placeholder</p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute bottom-6 left-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-100 border border-emerald-400/60 font-semibold">
                {tournament.matchType.toUpperCase()}
              </Badge>
              <Badge variant="outline" className={getStatusBadgeClasses(normalizedStatus)}>
                {normalizedStatus.toUpperCase()}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{tournament.title}</h1>
            <p className="text-sm text-gray-300">{game?.name || "Unknown Game"}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-300" />
                Tournament Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-cyan-400/50 bg-cyan-500/10 text-cyan-100">{game?.name || "Unknown Game"}</Badge>
                <Badge variant="outline" className="capitalize border-indigo-400/60 bg-indigo-500/15 text-indigo-100">{tournament.matchType}</Badge>
                <Badge variant="outline" className={getStatusBadgeClasses(normalizedStatus)}>
                  {normalizedStatus.toUpperCase()}
                </Badge>
              </div>

              <Progress value={slotsProgress} />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Slots Filled</p>
                  <p className="font-semibold mt-1"><Users className="inline w-4 h-4 mr-1" />{tournament.filledSlots}/{tournament.maxSlots}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Entry Fee</p>
                  <p className="font-semibold mt-1"><Wallet className="inline w-4 h-4 mr-1" />{formatMoney(tournament.entryFee)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Prize Pool</p>
                  <p className="font-semibold mt-1"><Trophy className="inline w-4 h-4 mr-1" />{formatMoney(tournament.prizePool)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Start Time</p>
                  <p className="font-semibold mt-1"><Clock className="inline w-4 h-4 mr-1" />{formatDate(tournament.startTime)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Countdown</p>
                  <p className="font-semibold mt-1"><Swords className="inline w-4 h-4 mr-1" />{countdown}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-muted-foreground">Registration</p>
                  <p className="font-semibold mt-1">{canJoinTournament ? "Open" : "Closed"}</p>
                </div>
              </div>

              {walletInsufficient && canJoinTournament && (
                <p className="text-sm text-red-300">
                  Wallet balance is low. Required: {formatMoney(tournament.entryFee)}.
                </p>
              )}

              <Button
                disabled={joined || !canJoinTournament || joinMutation.isPending}
                onClick={openJoinModal}
              >
                {joined ? "Registered" : !canJoinTournament ? "Registration Closed" : "Join Tournament"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-300" /> Room ID & Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {normalizedStatus === "live" && tournament.roomId && tournament.roomPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-red-500/40 bg-red-500/10 p-3">
                    <span className="text-sm text-red-200">Room ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white">{tournament.roomId}</span>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(tournament.roomId!, "roomId")}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        {copiedField === "roomId" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-red-500/40 bg-red-500/10 p-3">
                    <span className="text-sm text-red-200">Password</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white">{tournament.roomPassword}</span>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(tournament.roomPassword!, "roomPassword")}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        {copiedField === "roomPassword" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {normalizedStatus === "live" && (!tournament.roomId || !tournament.roomPassword) && (
                <p className="text-sm text-muted-foreground">
                  Room credentials are protected. Join this tournament to unlock access.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-300" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-line text-sm leading-6">
              {tournament.description?.trim() || "No description added for this tournament yet."}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-violet-300" /> Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-line text-sm leading-6">
              {tournament.rules?.trim() || "Rules will be announced by admin soon."}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-300" />
                Participants ({participants.length}/{tournament.maxSlots})
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[360px] overflow-y-auto space-y-2">
              {participantsQuery.isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-9 w-full" />
                  ))}
                </div>
              )}

              {participantsQuery.isError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-300">Failed to load participants.</p>
                  <Button variant="outline" size="sm" onClick={() => participantsQuery.refetch()}>Retry</Button>
                </div>
              )}

              {!participantsQuery.isLoading && !participantsQuery.isError && participants.length === 0 && (
                <p className="text-sm text-muted-foreground">No participants yet.</p>
              )}

              {!participantsQuery.isLoading && !participantsQuery.isError && participants.length > 0 && participants.map((p, index) => (
                <div key={p.id} className="flex items-center gap-3 text-sm rounded-md border border-white/10 bg-black/25 px-3 py-2">
                  <span className="w-6 text-xs text-white/60 font-medium">{index + 1}.</span>
                  <div className="min-w-0">
                    <p className="truncate">{p.displayName || p.username || `Player #${p.userId}`}</p>
                    {p.teamName && (
                      <p className="text-xs text-white/60 truncate">Team: {p.teamName}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 self-start">
          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-300" /> Prize Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prizeDistribution.length === 0 && (
                <p className="text-sm text-muted-foreground">Prize split will be updated before match starts.</p>
              )}
              {prizeDistribution.map((p) => (
                <div key={p.position} className="flex items-center justify-between rounded-md border border-white/10 bg-black/25 px-3 py-2">
                  <span className="flex items-center gap-2">
                    {p.position === 1 && <Crown className="w-4 h-4 text-yellow-300" />}
                    {p.position === 2 && <Trophy className="w-4 h-4 text-slate-300" />}
                    {p.position === 3 && <Trophy className="w-4 h-4 text-amber-500" />}
                    #{p.position}
                  </span>
                  <span className="font-semibold">{formatMoney(p.prize)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/35">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-300" /> Winners
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {normalizedStatus !== "completed" && (
                <p className="text-sm text-muted-foreground">
                  Winners will appear here once the tournament is completed.
                </p>
              )}

              {normalizedStatus === "completed" && resultsQuery.isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {normalizedStatus === "completed" && resultsQuery.isError && (
                <div className="space-y-2">
                  <p className="text-sm text-red-300">Failed to load results.</p>
                  <Button variant="outline" size="sm" onClick={() => resultsQuery.refetch()}>Retry</Button>
                </div>
              )}

              {normalizedStatus === "completed" && !resultsQuery.isLoading && !resultsQuery.isError && sortedResults.length === 0 && (
                <p className="text-sm text-muted-foreground">Results will be updated soon.</p>
              )}

              {normalizedStatus === "completed" && !resultsQuery.isLoading && !resultsQuery.isError && sortedResults.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${r.position === 1 ? "border-yellow-400/60 bg-yellow-500/10" : "border-white/10 bg-black/25"}`}
                >
                  <div>
                    <p className="font-medium">Rank #{r.position}</p>
                    <p className="text-xs text-muted-foreground">
                      {participantNameByUserId.get(r.userId) || `Player #${r.userId}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(r.prize)}</p>
                    <p className="text-xs text-muted-foreground">Kills: {r.kills}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Tournament Join</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <p className="font-medium">{tournament.title}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                <p className="text-muted-foreground">Game: <span className="text-foreground">{game?.name || "Unknown"}</span></p>
                <p className="text-muted-foreground">Mode: <span className="text-foreground capitalize">{tournament.matchType}</span></p>
                <p className="text-muted-foreground">Slots: <span className="text-foreground">{tournament.filledSlots}/{tournament.maxSlots}</span></p>
                <p className="text-muted-foreground">Starts: <span className="text-foreground">{formatDate(tournament.startTime)}</span></p>
              </div>
            </div>

            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Wallet Balance</p>
                <p className="font-medium">{formatMoney(currentWalletBalance)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Entry Fee Deduction</p>
                <p className="font-medium">- {formatMoney(tournament.entryFee)}</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
                <p className="text-muted-foreground">Balance After Join</p>
                <p className={`font-semibold ${walletInsufficient ? "text-red-300" : "text-emerald-300"}`}>
                  {walletInsufficient ? "Insufficient" : formatMoney(walletAfterJoin)}
                </p>
              </div>
            </div>

            {isSolo && (
              <div className="space-y-1.5">
                <Label>In-Game Name / ID</Label>
                <Input value={ign} onChange={(e) => setIgn(e.target.value)} placeholder="Auto-filled from profile (if available)" />
              </div>
            )}

            {(isDuo || isSquad) && (
              <div className="space-y-1.5">
                <Label>Select Team</Label>
                <select
                  className="w-full border rounded px-3 py-2 bg-background"
                  value={teamId ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTeamId(value ? Number(value) : null);
                  }}
                >
                  <option value="">Select team</option>
                  {eligibleTeams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {eligibleTeams.length === 0 && (
                  <p className="text-xs text-red-300">
                    No eligible teams found for this match type. Create or update a team first.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={
                joinMutation.isPending ||
                walletInsufficient ||
                (isSolo && !ign.trim()) ||
                ((isDuo || isSquad) && !teamId)
              }
            >
              {joinMutation.isPending
                ? "Joining..."
                : tournament.entryFee > 0
                  ? `Confirm Join - Pay ${formatMoney(tournament.entryFee)}`
                  : "Confirm Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

