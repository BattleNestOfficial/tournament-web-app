import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Crosshair, Flame, Trophy, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type LeaderboardEntry = {
  rank: number;
  userId: number;
  username: string;
  totalPrize: number;
  totalKills: number;
  wins: number;
  podiums: number;
  tournamentsPlayed: number;
};

type PlayerAnalytics = {
  userId: number;
  username: string;
  summary: {
    matchesPlayed: number;
    wins: number;
    podiums: number;
    totalKills: number;
    totalPrize: number;
    winRate: number;
    avgKills: number;
  };
  dayLabels: string[];
  bucketLabels: string[];
  winTrend: Array<{ match: number; label: string; date: string; winRate: number; won: number }>;
  killsTrend: Array<{ match: number; label: string; date: string; kills: number; avgKills: number }>;
  heatmap: Array<{
    day: number;
    dayLabel: string;
    bucket: number;
    bucketLabel: string;
    matches: number;
    wins: number;
    kills: number;
    score: number;
    intensity: number;
  }>;
};

function formatCurrency(paise = 0) {
  return `\u20B9${(Number(paise || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function getHeatCellClass(intensity: number) {
  if (intensity <= 0) return "bg-muted/40 text-muted-foreground border-border/60";
  if (intensity < 0.25) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30";
  if (intensity < 0.5) return "bg-emerald-500/30 text-emerald-800 dark:text-emerald-100 border-emerald-500/40";
  if (intensity < 0.75) return "bg-chart-2/40 text-foreground border-chart-2/50";
  return "bg-chart-3/50 text-foreground border-chart-3/60";
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const leaderboardQuery = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", "limit=100"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchInterval: 15000,
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?limit=100");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load leaderboard");
      return Array.isArray(data) ? data : [];
    },
  });

  const analyticsQuery = useQuery<PlayerAnalytics>({
    queryKey: ["/api/leaderboard", selectedUserId, "analytics"],
    enabled: !!selectedUserId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchInterval: 20000,
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard/${selectedUserId}/analytics`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load analytics");
      return data as PlayerAnalytics;
    },
  });

  useEffect(() => {
    const rows = leaderboardQuery.data || [];
    if (rows.length === 0) return;
    if (selectedUserId && rows.some((row) => Number(row.userId) === Number(selectedUserId))) return;
    const me = user ? rows.find((row) => Number(row.userId) === Number(user.id)) : undefined;
    setSelectedUserId(me?.userId ?? rows[0].userId);
  }, [leaderboardQuery.data, selectedUserId, user?.id]);

  const analytics = analyticsQuery.data;
  const heatmapByKey = useMemo(() => {
    const map = new Map<string, PlayerAnalytics["heatmap"][number]>();
    for (const cell of analytics?.heatmap || []) {
      map.set(`${cell.day}-${cell.bucket}`, cell);
    }
    return map;
  }, [analytics?.heatmap]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-card via-card to-primary/10">
        <CardContent className="p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <Badge variant="outline" className="text-[11px] border-primary/40 text-primary">PRO ANALYTICS</Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Leaderboard Analytics Center</h1>
            <p className="text-sm text-muted-foreground">
              Track player heatmaps, win-rate trends, and average kills per match with pro-level esports insights.
            </p>
          </div>
          {analytics && (
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Selected Player</p>
              <p className="text-lg font-bold">{analytics.username}</p>
              <p className="text-xs text-muted-foreground">Matches: {analytics.summary.matchesPlayed}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-chart-3" /> Global Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {leaderboardQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : leaderboardQuery.isError ? (
              <p className="text-sm text-destructive">{(leaderboardQuery.error as Error).message}</p>
            ) : (leaderboardQuery.data || []).length > 0 ? (
              <div className="space-y-1.5 max-h-[740px] overflow-y-auto pr-1">
                {(leaderboardQuery.data || []).map((row) => {
                  const active = Number(row.userId) === Number(selectedUserId);
                  return (
                    <button
                      key={row.userId}
                      onClick={() => setSelectedUserId(row.userId)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition ${
                        active
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">#{row.rank} {row.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.wins}W • {row.totalKills} Kills • {row.tournamentsPlayed} Matches
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatCurrency(row.totalPrize)}</p>
                          <p className="text-[11px] text-muted-foreground">Prize</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed match stats yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-8 space-y-4">
          {analyticsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : analyticsQuery.isError ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-destructive">{(analyticsQuery.error as Error).message}</p>
              </CardContent>
            </Card>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Win Rate</p>
                    <p className="text-xl font-bold">{analytics.summary.winRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Crosshair className="w-3 h-3" /> Avg Kills/Match</p>
                    <p className="text-xl font-bold">{analytics.summary.avgKills.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3" /> Total Kills</p>
                    <p className="text-xl font-bold">{analytics.summary.totalKills}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Trophy className="w-3 h-3" /> Total Prize</p>
                    <p className="text-xl font-bold">{formatCurrency(analytics.summary.totalPrize)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Win % Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {analytics.winTrend.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.winTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                            <Tooltip
                              formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "Win Rate"]}
                              labelFormatter={(_label, payload) => {
                                const point = payload?.[0]?.payload as { date?: string } | undefined;
                                return point?.date ? formatShortDate(point.date) : "";
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="winRate"
                              stroke="hsl(var(--chart-2))"
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6">No match trend available yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Kills Per Match Average</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {analytics.killsTrend.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.killsTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip
                              formatter={(value: number, name: string) => [Number(value).toFixed(2), name === "avgKills" ? "Avg Kills" : "Kills"]}
                              labelFormatter={(_label, payload) => {
                                const point = payload?.[0]?.payload as { date?: string } | undefined;
                                return point?.date ? formatShortDate(point.date) : "";
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="avgKills"
                              stroke="hsl(var(--chart-1))"
                              fill="hsl(var(--chart-1) / 0.25)"
                              strokeWidth={2}
                            />
                            <Line
                              type="monotone"
                              dataKey="kills"
                              stroke="hsl(var(--chart-4))"
                              strokeWidth={1.8}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6">No kill analytics available yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-chart-2" /> Heatmap Of Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="overflow-x-auto">
                    <div className="min-w-[540px]">
                      <div className="grid grid-cols-7 gap-2 mb-2 pl-12">
                        {analytics.bucketLabels.map((label) => (
                          <p key={label} className="text-[11px] text-center text-muted-foreground">{label}</p>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {analytics.dayLabels.map((dayLabel, day) => (
                          <div key={dayLabel} className="grid grid-cols-[40px_1fr] gap-2 items-center">
                            <p className="text-[11px] text-muted-foreground">{dayLabel}</p>
                            <div className="grid grid-cols-7 gap-2">
                              {analytics.bucketLabels.map((_bucketLabel, bucket) => {
                                const cell = heatmapByKey.get(`${day}-${bucket}`);
                                const intensity = cell?.intensity || 0;
                                return (
                                  <div
                                    key={`${day}-${bucket}`}
                                    className={`h-10 rounded-md border flex items-center justify-center text-[11px] font-semibold ${getHeatCellClass(intensity)}`}
                                    title={
                                      cell
                                        ? `${dayLabel} ${cell.bucketLabel} | Matches: ${cell.matches}, Wins: ${cell.wins}, Kills: ${cell.kills}`
                                        : `${dayLabel} ${analytics.bucketLabels[bucket]} | No data`
                                    }
                                  >
                                    {cell && cell.matches > 0 ? cell.matches : "-"}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Low</span>
                    <div className="h-2 w-12 rounded-sm bg-muted/40 border border-border/60" />
                    <div className="h-2 w-12 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
                    <div className="h-2 w-12 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
                    <div className="h-2 w-12 rounded-sm bg-chart-2/40 border border-chart-2/50" />
                    <div className="h-2 w-12 rounded-sm bg-chart-3/50 border border-chart-3/60" />
                    <span>High</span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Select a player from the leaderboard to view analytics.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
