import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Clock,
  Filter,
  Flame,
  Gamepad2,
  Search,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

import type { Game, Registration, Tournament } from "@shared/schema";

type ShowcaseStatus = "hot" | "upcoming" | "live" | "completed";

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
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 170, damping: 20 });
  const rotateY = useSpring(x, { stiffness: 170, damping: 20 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    x.set((px - rect.width / 2) / 18);
    y.set(-(py - rect.height / 2) / 18);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="transition-transform duration-300"
    >
      {children}
    </motion.div>
  );
}

function TournamentMatchCard({
  tournament,
  gameName,
  index,
}: {
  tournament: Tournament;
  gameName: string;
  index: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const status = normalizeStatus(tournament.status);
  const countdown = useCountdown(tournament.startTime);
  const theme = SHOWCASE_THEME[status];
  const progress = Math.min(100, (tournament.filledSlots / Math.max(tournament.maxSlots, 1)) * 100);
  const rightMeta = status === "completed" ? "Completed" : countdown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.45 }}
    >
      <HoloCard>
        <Link href={`/tournaments/${tournament.id}`}>
          <Card className={`group overflow-hidden border ${theme.edge} ${theme.glow} bg-gradient-to-br from-black/80 to-slate-950/80 backdrop-blur-xl cursor-pointer transition-all duration-300`}>
            <div className="relative h-44 overflow-hidden">
              {tournament.imageUrl && !imgFailed ? (
                <img
                  src={tournament.imageUrl}
                  alt={tournament.title}
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${PLACEHOLDER_GRADIENT[status]} flex items-center justify-center`}>
                  <div className="text-center">
                    <Shield className="w-9 h-9 mx-auto opacity-60" />
                    <p className="text-xs mt-2 text-white/85">{gameName}</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
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

              {status === "live" && tournament.roomId && tournament.roomPassword && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs">
                  <p className="text-red-200">
                    Room ID: <span className="font-semibold font-mono text-white">{tournament.roomId}</span>
                  </p>
                  <p className="text-red-200 mt-1">
                    Password: <span className="font-semibold font-mono text-white">{tournament.roomPassword}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
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
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialGame = params.get("game") || "all";
  const initialStatus = params.get("status") || "all";

  const [gameFilter, setGameFilter] = useState(initialGame);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedOnly, setJoinedOnly] = useState(false);

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
        if (joinedOnly && !joinedTournamentIds.has(Number(t.id))) return false;
        if (searchQuery.trim() && !t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
        return true;
      }),
    [normalizedTournaments, gameFilter, statusFilter, typeFilter, joinedOnly, joinedTournamentIds, searchQuery]
  );

  const liveTournaments = useMemo(
    () => filtered.filter((t) => t.status === "live").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filtered]
  );

  const upcomingTournaments = useMemo(
    () => filtered.filter((t) => t.status === "upcoming").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filtered]
  );

  const hotTournaments = useMemo(
    () => filtered.filter((t) => t.status === "hot").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filtered]
  );

  const completedTournaments = useMemo(
    () => filtered.filter((t) => t.status === "completed").sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [filtered]
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 -z-30 bg-gradient-to-br from-[#010701] via-[#03210b] to-[#001006]" />
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,#39ff7a33,transparent_58%)]" />
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_bottom,#22c55e26,transparent_64%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(3,8,3,0.12),rgba(0,0,0,0.55))]" />

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
                  {token && <span className="text-[11px] opacity-80">({joinedTournamentIds.size})</span>}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
            <section className="space-y-2">
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
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No live tournaments.</CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-2">
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
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No upcoming tournaments.</CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-2">
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
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No hot tournaments.</CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-2">
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
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-white/10 bg-black/35">
                  <CardContent className="p-8 text-center text-white/65">No completed tournaments.</CardContent>
                </Card>
              )}
            </section>
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
    </div>
  );
}
