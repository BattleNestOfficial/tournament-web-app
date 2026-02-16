import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Plus, Crown, UserPlus, Trash2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { Team, TeamMember } from "@shared/schema";

type TeamWithMembers = Team & { members: (TeamMember & { username?: string })[] };

export default function TeamsPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [addMemberTeamId, setAddMemberTeamId] = useState<number | null>(null);
  const [memberUsername, setMemberUsername] = useState("");

  const { data: teams, isLoading } = useQuery<TeamWithMembers[]>({
    queryKey: ["/api/teams/my"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/teams", { name: teamName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my"] });
      toast({ title: "Team created!" });
      setTeamName("");
      setCreateDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, username }: { teamId: number; username: string }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/members`, { username });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my"] });
      toast({ title: "Member added!" });
      setMemberUsername("");
      setAddMemberTeamId(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      const res = await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("DELETE", `/api/teams/${teamId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my"] });
      toast({ title: "Team deleted" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!user) setLocation("/auth");
  }, [user, setLocation]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Teams</h1>
            <p className="text-sm text-muted-foreground">Create and manage your tournament teams</p>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-team">
              <Plus className="w-4 h-4" /> Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Team Name</Label>
                <Input
                  placeholder="Enter team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  data-testid="input-team-name"
                />
              </div>
              <Button
                className="w-full"
                disabled={!teamName || teamName.length < 2 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                data-testid="button-confirm-create-team"
              >
                {createMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="space-y-4">
          {teams.map((team) => {
            const isOwner = team.ownerId === user.id;
            return (
              <Card key={team.id} data-testid={`card-team-${team.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {team.name}
                      {isOwner && <Badge variant="outline" className="text-[10px] text-chart-4 gap-1"><Crown className="w-2.5 h-2.5" /> Owner</Badge>}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <Dialog open={addMemberTeamId === team.id} onOpenChange={(open) => { setAddMemberTeamId(open ? team.id : null); setMemberUsername(""); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-add-member-${team.id}`}>
                              <UserPlus className="w-3.5 h-3.5" /> Add Member
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Member to {team.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <Label>Username</Label>
                                <Input
                                  placeholder="Enter player username"
                                  value={memberUsername}
                                  onChange={(e) => setMemberUsername(e.target.value)}
                                  data-testid="input-member-username"
                                />
                              </div>
                              <Button
                                className="w-full"
                                disabled={!memberUsername || addMemberMutation.isPending}
                                onClick={() => addMemberMutation.mutate({ teamId: team.id, username: memberUsername })}
                                data-testid="button-confirm-add-member"
                              >
                                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      {isOwner && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteTeamMutation.mutate(team.id)}
                          data-testid={`button-delete-team-${team.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-1 mb-3">
                    <Badge variant="secondary" className="text-[10px]">{team.members.length} member{team.members.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="space-y-1">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`member-${member.id}`}>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {member.username?.slice(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{member.username || `User #${member.userId}`}</span>
                          {member.userId === team.ownerId && (
                            <Badge variant="outline" className="text-[10px] text-chart-4"><Crown className="w-2.5 h-2.5" /></Badge>
                          )}
                        </div>
                        {isOwner && member.userId !== team.ownerId && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => removeMemberMutation.mutate({ teamId: team.id, userId: member.userId })}
                            data-testid={`button-remove-member-${member.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium mb-1">No teams yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create a team to compete in tournaments together</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2" data-testid="button-create-team-empty">
              <Plus className="w-4 h-4" /> Create Your First Team
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
