import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpDown,
  CalendarClock,
  Copy,
  Eye,
  Filter,
  Flame,
  Gamepad2,
  LogIn,
  Radio,
  RotateCcw,
  Search,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

import type { Game, Registration, Result, Tournament } from "@shared/schema";

type ParticipantLite = {
  userId: number;
  username?: string;
  displayName?: string;
};

type WinnerRow = Result & {
  playerName: string;
};

type ShowcaseStatus = "hot" | "upcoming" | "live" | "completed";
type SortBy = "start_asc" | "start_desc" | "prize_desc" | "slots_desc";

const SHOWCASE_THEME: Record<ShowcaseStatus, { edge: string; chip: string; glow: string; label: string }> = {
  hot: {
    edge: "border-amber-400/60",
    chip: "bg-amber-500/15 text-amber-300 border-amber-400/60",
    glow: "shadow-[0_0_28px_rgba(251,191,36,0.25)]",
    label: "HOT",
  },
  upcoming: {
    edge: "border-indigo-400/60",
    chip: "bg-indigo-500/15 text-indigo-300 border-indigo-400/60",
    glow: "shadow-[0_0_24px_rgba(99,102,241,0.25)]",
    label: "UPCOMING",
  },
  live: {
    edge: "border-red-500/60",
    chip: "bg-red-500/15 text-red-300 border-red-500/60",
    glow: "shadow-[0_0_28px_rgba(239,68,68,0.3)]",
    label: "LIVE",
  },
  completed: {
    edge: "border-slate-400/45",
    chip: "bg-slate-500/15 text-slate-300 border-slate-400/45",
    glow: "shadow-[0_0_18px_rgba(148,163,184,0.18)]",
    label: "COMPLETED",
  },
};

const PLACEHOLDER_GRADIENT: Record<ShowcaseStatus, string> = {
  hot: "from-amber-700/60 via-orange-700/45 to-black",
  upcoming: "from-indigo-700/60 via-violet-700/45 to-black",
  live: "from-red-700/60 via-rose-700/45 to-black",
  completed: "from-slate-700/60 via-slate-800/45 to-black",
};

function normalizeStatus(value: unknown): ShowcaseStatus {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "hot") return "hot";
  if (raw === "upcoming") return "upcoming";
  if (raw === "live") return "live";
  return "completed";
}

function formatMoney(value: number) {
  return `INR ${(value / 100).toLocaleString("en-IN")}`;
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortTournaments(items: Tournament[], sortBy: SortBy) {
  const list = [...items];
  list.sort((a, b) => {
    switch (sortBy) {
      case "start_desc":
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      case "prize_desc":
        return (b.prizePool || 0) - (a.prizePool || 0);
      case "slots_desc":
        return (b.filledSlots || 0) - (a.filledSlots || 0);
      case "start_asc":
      default:
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    }
  });
  return list;
}

function useCountdown(target: string | Date) {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      const ms = new Date(target).getTime() - Date.now();
      if (ms <= 0) {
        setTime("LIVE");
        return;
      }
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const seconds = Math.floor((ms / 1000) % 60);
      setTime(`${hours}h ${minutes}m ${seconds}s`);
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return time;
}

function HoloCard({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function TournamentMatchCard({
  tournament,
  gameName,
  index,
  joined,
  token,
  onShowRoom,
  onShowWinners,
  onOpenDetails,
}: {
  tournament: Tournament;
  gameName: string;
  index: number;
  joined: boolean;
  token: string | null;
  onShowRoom: (tournament: Tournament) => void;
  onShowWinners: (tournament: Tournament) => void;
  onOpenDetails: (tournamentId: number) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const status = normalizeStatus(tournament.status);
  const countdown = useCountdown(tournament.startTime);
  const theme = SHOWCASE_THEME[status];
  const progress = Math.min(100, (tournament.filledSlots / Math.max(tournament.maxSlots, 1)) * 100);
  const rightMeta = status === "completed" ? "Completed" : countdown;
  const canJoin = status === "upcoming" || status === "hot";
  const liveStreamUrl = (tournament.liveStreamUrl || "").trim();
  const canWatchLive = status === "live" && liveStreamUrl.length > 0;
  const joinHref = token ? `/tournaments/${tournament.id}?action=join` : "/auth";
  const interactiveSelector = "a,button,input,select,textarea,[role='button']";

  function handleCardOpen(event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest(interactiveSelector)) {
      return;
    }
    onOpenDetails(Number(tournament.id));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.45 }}
    >
      <HoloCard>
        <Card
          role="button"
          tabIndex={0}
          onClick={handleCardOpen}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleCardOpen(event);
          }}
          className={`esports-card-surface group overflow-hidden border ${theme.edge} ${theme.glow} bg-gradient-to-br from-black/80 to-slate-950/80 backdrop-blur-xl transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70`}
        >
            <div className="relative h-44 overflow-hidden">
              {tournament.imageUrl && !imgFailed ? (
                <img
                  src={tournament.imageUrl}
                  alt={tournament.title}
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={`esports-card-placeholder h-full w-full bg-gradient-to-br ${PLACEHOLDER_GRADIENT[status]} flex items-center justify-center`}>
                  <div className="text-center">
                    <Shield className="w-9 h-9 mx-auto opacity-60" />
                    <p className="text-xs mt-2 text-white/85">{gameName}</p>
                  </div>
                </div>
              )}
              <div className="esports-card-image-overlay absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute top-3 right-3">
                <Badge className={`text-[10px] tracking-wide uppercase ${theme.chip}`}>{theme.label}</Badge>
              </div>
              <div className="absolute bottom-3 left-3">
                <p className="text-sm text-white/80">{gameName}</p>
                <h3 className="text-lg font-bold leading-tight max-w-[85%] line-clamp-1">{tournament.title}</h3>
              </div>
            </div>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" /> {formatDateTime(tournament.startTime)}
                </span>
                <span className="font-semibold">{rightMeta}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Prize</p>
                  <p className="font-semibold text-yellow-300">{formatMoney(tournament.prizePool)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Entry</p>
                  <p className="font-semibold text-emerald-300">{tournament.entryFee > 0 ? formatMoney(tournament.entryFee) : "FREE"}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Slots</p>
                  <p className="font-semibold text-blue-300">{tournament.filledSlots}/{tournament.maxSlots}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/35 p-2">
                  <p className="text-white/60">Mode</p>
                  <p className="font-semibold capitalize text-fuchsia-300">{tournament.matchType}</p>
                </div>
              </div>

              <Progress value={progress} className="h-2" />
              <p className="text-[11px] text-right text-white/60">{Math.round(progress)}% filled</p>

              <div className={`grid gap-2 pt-1 ${canWatchLive ? "grid-cols-3" : "grid-cols-2"}`}>
                {status === "live" ? (
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => onShowRoom(tournament)}>
                    Show ID/Password
                  </Button>
                ) : status === "completed" ? (
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => onShowWinners(tournament)}>
                    View Winners
                  </Button>
                ) : joined ? (
                  <Button size="sm" disabled className="w-full">
                    Registered
                  </Button>
                ) : canJoin ? (
                  <Button size="sm" className="w-full gap-1.5" asChild>
                    <Link href={joinHref}>
                      {token ? <Swords className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                      Join
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled variant="secondary" className="w-full">
                    Closed
                  </Button>
                )}

                {canWatchLive && (
                  <Button size="sm" variant="destructive" className="w-full gap-1.5" asChild>
                    <a href={liveStreamUrl} target="_blank" rel="noreferrer noopener">
                      <Radio className="w-3.5 h-3.5" />
                      Watch Live
                    </a>
                  </Button>
                )}

                <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
                  <Link href={`/tournaments/${tournament.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
      </HoloCard>
    </motion.div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <p className="text-sm text-white/60 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

export default function TournamentsPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialGame = params.get("game") || "all";
  const initialStatus = params.get("status") || "all";

  const [gameFilter, setGameFilter] = useState(initialGame);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedOnly, setJoinedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("start_asc");
  const [roomDialogTournament, setRoomDialogTournament] = useState<Tournament | null>(null);
  const [winnersDialogTournament, setWinnersDialogTournament] = useState<Tournament | null>(null);
  const [copiedRoomField, setCopiedRoomField] = useState<"roomId" | "roomPassword" | null>(null);

  const { data: tournaments = [], isLoading, isError } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
    queryFn: async () => {
      const token = localStorage.getItem("bn_token");
      const res = await fetch("/api/tournaments", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 15000,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: myRegistrations = [] } = useQuery<Registration[]>({
    queryKey: ["/api/registrations/my"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/registrations/my", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const {
    data: winnersDialogResults = [],
    isLoading: winnersLoading,
    isError: winnersError,
    refetch: refetchWinners,
  } = useQuery<WinnerRow[]>({
    queryKey: ["/api/tournaments", winnersDialogTournament?.id?.toString() || "0", "winners-dialog"],
    enabled: !!winnersDialogTournament,
    queryFn: async () => {
      if (!winnersDialogTournament) return [];

      const [resultsRes, participantsRes] = await Promise.all([
        fetch(`/api/tournaments/${winnersDialogTournament.id}/results`),
        fetch(`/api/tournaments/${winnersDialogTournament.id}/participants`),
      ]);

      if (!resultsRes.ok) {
        const text = await resultsRes.text();
        throw new Error(text || "Failed to fetch winners");
      }

      const resultsData = await resultsRes.json();
      const safeResults = Array.isArray(resultsData) ? (resultsData as Result[]) : [];

      const participantsData: ParticipantLite[] = participantsRes.ok
        ? ((await participantsRes.json()) as ParticipantLite[])
        : [];
      const participantNameByUserId = new Map<number, string>(
        participantsData.map((p) => [
          Number(p.userId),
          p.displayName || p.username || `Player #${p.userId}`,
        ])
      );

      return [...safeResults]
        .sort((a, b) => a.position - b.position)
        .map((row) => ({
          ...row,
          playerName: participantNameByUserId.get(Number(row.userId)) || `Player #${row.userId}`,
        }));
    },
  });

  const joinedTournamentIds = useMemo(
    () =>
      new Set(
        myRegistrations
          .map((r) => Number(r.tournamentId))
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    [myRegistrations]
  );

  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const normalizedTournaments = useMemo(
    () =>
      tournaments.map((t) => ({
        ...t,
        status: normalizeStatus(t.status),
        entryFee: Number.isFinite(t.entryFee) ? t.entryFee : 0,
        prizePool: Number.isFinite(t.prizePool) ? t.prizePool : 0,
        maxSlots: Number.isFinite(t.maxSlots) && t.maxSlots > 0 ? t.maxSlots : 1,
        filledSlots: Number.isFinite(t.filledSlots) && t.filledSlots >= 0 ? t.filledSlots : 0,
      })),
    [tournaments]
  );

  const filtered = useMemo(
    () =>
      normalizedTournaments.filter((t) => {
        if (gameFilter !== "all" && t.gameId !== Number(gameFilter)) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (typeFilter !== "all" && t.matchType !== typeFilter) return false;
        if (joinedOnly) {
          if (!joinedTournamentIds.has(Number(t.id))) return false;
          if (t.status !== "live" && t.status !== "upcoming") return false;
        }
        if (searchQuery.trim() && !t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
        return true;
      }),
    [normalizedTournaments, gameFilter, statusFilter, typeFilter, joinedOnly, joinedTournamentIds, searchQuery]
  );

  const liveTournaments = useMemo(
    () => sortTournaments(filtered.filter((t) => t.status === "live"), sortBy),
    [filtered, sortBy]
  );

  const upcomingTournaments = useMemo(
    () => sortTournaments(filtered.filter((t) => t.status === "upcoming"), sortBy),
    [filtered, sortBy]
  );

  const hotTournaments = useMemo(
    () => sortTournaments(filtered.filter((t) => t.status === "hot"), sortBy),
    [filtered, sortBy]
  );

  const completedTournaments = useMemo(
    () => sortTournaments(filtered.filter((t) => t.status === "completed"), sortBy),
    [filtered, sortBy]
  );

  const sectionCounts = {
    live: liveTournaments.length,
    hot: hotTournaments.length,
    upcoming: upcomingTournaments.length,
    completed: completedTournaments.length,
  };

  function clearFilters() {
    setGameFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
    setJoinedOnly(false);
    setSortBy("start_asc");
  }

  async function copyRoomCredential(value: string, field: "roomId" | "roomPassword") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRoomField(field);
      window.setTimeout(() => setCopiedRoomField(null), 1200);
    } catch {
      setCopiedRoomField(null);
    }
  }

  return (
    <div className="dark esports-theme esports-page relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="esports-page-backdrop absolute inset-0 -z-30 bg-gradient-to-br from-[#010701] via-[#03210b] to-[#001006]" />
      <div className="esports-page-glow-top absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,#39ff7a33,transparent_58%)]" />
      <div className="esports-page-glow-bottom absolute inset-0 -z-20 bg-[radial-gradient(circle_at_bottom,#22c55e26,transparent_64%)]" />
      <div className="esports-page-vignette absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(3,8,3,0.12),rgba(0,0,0,0.55))]" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <p className="text-sm text-white/70 mt-1">Explore live, upcoming and completed Battle Nest tournaments</p>
        </div>

        <Card className="border-white/10 bg-black/45 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tournaments..."
                  className="pl-9 bg-black/35 border-white/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-tournaments"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={gameFilter} onValueChange={setGameFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-game-filter">
                    <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Game" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Games</SelectItem>
                    {games.filter((g) => g.enabled).map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                    <Filter className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[120px]" data-testid="select-type-filter">
                    <Swords className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="solo">Solo</SelectItem>
                    <SelectItem value="duo">Duo</SelectItem>
                    <SelectItem value="squad">Squad</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-sort-filter">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start_asc">Start: Soonest</SelectItem>
                    <SelectItem value="start_desc">Start: Latest</SelectItem>
                    <SelectItem value="prize_desc">Prize: High to Low</SelectItem>
                    <SelectItem value="slots_desc">Players: High to Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={joinedOnly ? "default" : "outline"}
                  className="gap-1.5"
                  disabled={!token}
                  onClick={() => setJoinedOnly((prev) => !prev)}
                  data-testid="button-joined-filter"
                >
                  <Users className="w-3.5 h-3.5" />
                  Joined Only
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={clearFilters}
                  data-testid="button-clear-tournament-filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => document.getElementById("live-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Live ({sectionCounts.live})
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById("upcoming-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Upcoming ({sectionCounts.upcoming})
          </Button>
          {!joinedOnly && (
            <Button variant="outline" size="sm" onClick={() => document.getElementById("hot-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Hot ({sectionCounts.hot})
            </Button>
          )}
          {!joinedOnly && (
            <Button variant="outline" size="sm" onClick={() => document.getElementById("completed-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Completed ({sectionCounts.completed})
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="border-white/10 bg-black/40">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <section id="live-section" className="space-y-2 scroll-mt-24">
              <SectionHeader
                icon={<Activity className="w-6 h-6 text-red-300" />}
                title="Live Tournaments"
                subtitle="Matches currently in progress"
              />
              {liveTournaments.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {liveTournaments.map((t, idx) => (
                    <TournamentMatchCard
                      key={t.id}
                      tournament={t}
                      gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                      index={idx}
                      joined={joinedTournamentIds.has(Number(t.id))}
                      token={token}
                      onShowRoom={setRoomDialogTournament}
                      onShowWinners={setWinnersDialogTournament}
                      onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No live tournaments.</CardContent>
                </Card>
              )}
            </section>

            {!joinedOnly && (
              <section id="hot-section" className="space-y-2 scroll-mt-24">
                <SectionHeader
                  icon={<Flame className="w-6 h-6 text-amber-300" />}
                  title="Hot Tournaments"
                  subtitle="Admin spotlight tournaments"
                />
                {hotTournaments.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {hotTournaments.map((t, idx) => (
                      <TournamentMatchCard
                        key={t.id}
                        tournament={t}
                        gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                        index={idx}
                        joined={joinedTournamentIds.has(Number(t.id))}
                        token={token}
                        onShowRoom={setRoomDialogTournament}
                        onShowWinners={setWinnersDialogTournament}
                        onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="border-white/10 bg-black/35">
                    <CardContent className="p-8 text-center text-white/65">No hot tournaments.</CardContent>
                  </Card>
                )}
              </section>
            )}

            <section id="upcoming-section" className="space-y-2 scroll-mt-24">
              <SectionHeader
                icon={<CalendarClock className="w-6 h-6 text-indigo-300" />}
                title="Upcoming Tournaments"
                subtitle="Scheduled matches starting soon"
              />
              {upcomingTournaments.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingTournaments.map((t, idx) => (
                    <TournamentMatchCard
                      key={t.id}
                      tournament={t}
                      gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                      index={idx}
                      joined={joinedTournamentIds.has(Number(t.id))}
                      token={token}
                      onShowRoom={setRoomDialogTournament}
                      onShowWinners={setWinnersDialogTournament}
                      onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No upcoming tournaments.</CardContent>
                </Card>
              )}
            </section>

            {!joinedOnly && (
              <section id="completed-section" className="space-y-2 scroll-mt-24">
                <SectionHeader
                  icon={<Trophy className="w-6 h-6 text-slate-300" />}
                  title="Completed Tournaments"
                  subtitle="Past matches and finished battles"
                />
                {completedTournaments.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {completedTournaments.map((t, idx) => (
                      <TournamentMatchCard
                        key={t.id}
                        tournament={t}
                        gameName={gameById.get(t.gameId)?.name || "Unknown Game"}
                        index={idx}
                        joined={joinedTournamentIds.has(Number(t.id))}
                        token={token}
                        onShowRoom={setRoomDialogTournament}
                        onShowWinners={setWinnersDialogTournament}
                        onOpenDetails={(tournamentId) => setLocation(`/tournaments/${tournamentId}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="border-white/10 bg-black/35">
                    <CardContent className="p-8 text-center text-white/65">No completed tournaments.</CardContent>
                  </Card>
                )}
              </section>
            )}
          </>
        )}

        {isError && (
          <Card className="border-red-500/40 bg-black/40">
            <CardContent className="p-6 text-center text-red-300">Failed to load tournaments. Try refreshing.</CardContent>
          </Card>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="border-white/10 bg-black/35">
            <CardContent className="p-8 text-center">
              <Trophy className="w-10 h-10 text-white/55 mx-auto mb-3" />
              <p className="font-medium">No tournaments found</p>
              <p className="text-sm text-white/60">Try changing search or filters.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={!!roomDialogTournament}
        onOpenChange={(open) => {
          if (!open) setRoomDialogTournament(null);
        }}
      >
        <DialogContent className="max-w-md border-white/20 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Room Credentials</DialogTitle>
          </DialogHeader>
          {roomDialogTournament && (
            <div className="space-y-3">
              <p className="text-sm text-white/70">{roomDialogTournament.title}</p>
              {roomDialogTournament.roomId && roomDialogTournament.roomPassword ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-black/20 px-3 py-2">
                    <p className="text-sm text-emerald-100">
                      Room ID: <span className="font-mono font-semibold text-white">{roomDialogTournament.roomId}</span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyRoomCredential(roomDialogTournament.roomId!, "roomId")}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copiedRoomField === "roomId" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-black/20 px-3 py-2">
                    <p className="text-sm text-emerald-100">
                      Password: <span className="font-mono font-semibold text-white">{roomDialogTournament.roomPassword}</span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyRoomCredential(roomDialogTournament.roomPassword!, "roomPassword")}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copiedRoomField === "roomPassword" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                  Room credentials are visible only to registered players when the tournament is live.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!winnersDialogTournament}
        onOpenChange={(open) => {
          if (!open) setWinnersDialogTournament(null);
        }}
      >
        <DialogContent className="max-w-md border-white/20 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Winners</DialogTitle>
          </DialogHeader>
          {winnersDialogTournament && (
            <div className="space-y-3">
              <p className="text-sm text-white/70">{winnersDialogTournament.title}</p>

              {winnersLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-11 w-full" />
                  ))}
                </div>
              )}

              {winnersError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 space-y-2">
                  <p className="text-sm text-red-200">Failed to load winners.</p>
                  <Button size="sm" variant="outline" onClick={() => refetchWinners()}>
                    Retry
                  </Button>
                </div>
              )}

              {!winnersLoading && !winnersError && winnersDialogResults.length === 0 && (
                <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/75">
                  Winners have not been declared yet.
                </div>
              )}

              {!winnersLoading && !winnersError && winnersDialogResults.length > 0 && (
                <div className="space-y-2">
                  {winnersDialogResults.map((winner) => (
                    <div
                      key={winner.id}
                      className={`rounded-md border px-3 py-2 ${winner.position === 1 ? "border-amber-400/60 bg-amber-500/10" : "border-white/15 bg-white/5"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Rank #{winner.position}</p>
                        <p className="text-sm font-medium">{formatMoney(winner.prize)}</p>
                      </div>
                      <p className="text-sm text-white/80">{winner.playerName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
