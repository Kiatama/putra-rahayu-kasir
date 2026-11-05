import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldCheck, Trash2, X } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import { useMe } from "@/lib/session";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/types";
import type { User } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function StatusBadge({ status }: { status: User["status"] }) {
  if (status === "approved")
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700">
        {USER_STATUS_LABELS[status]}
      </Badge>
    );
  if (status === "rejected") return <Badge variant="destructive">{USER_STATUS_LABELS[status]}</Badge>;
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
      {USER_STATUS_LABELS[status]}
    </Badge>
  );
}

export default function UsersPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<User[]>("/users"),
  });
  const [deleting, setDeleting] = useState<User | null>(null);

  const pending = users.filter((u) => u.status === "pending");

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost<User>(`/users/${id}/approve`),
    onSuccess: (user) => {
      toast.success(`Akun ${user.name} disetujui`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiPost<User>(`/users/${id}/reject`),
    onSuccess: (user) => {
      toast.success(`Pendaftaran ${user.name} ditolak`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/users/${id}`),
    onSuccess: () => {
      toast.success("Akun dihapus");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">Manajemen Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          Setujui pendaftaran baru dan kelola akun pegawai
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" data-testid="users-tab-pending">
              Menunggu Persetujuan ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="users-tab-all">
              Semua Pengguna ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="flex flex-col gap-2 pt-3">
            {pending.length === 0 && (
              <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Tidak ada pendaftaran yang menunggu persetujuan
              </p>
            )}
            {pending.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
                data-testid={`users-pending-card-${user.email}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email} — {ROLE_LABELS[user.role]} — daftar {formatDate(user.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="active:scale-[0.98]"
                    onClick={() => approveMutation.mutate(user.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`users-approve-button-${user.email}`}
                  >
                    <Check className="size-4" />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => rejectMutation.mutate(user.id)}
                    disabled={rejectMutation.isPending}
                    data-testid={`users-reject-button-${user.email}`}
                  >
                    <X className="size-4" />
                    Tolak
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="all" className="pt-3">
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terdaftar</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const deletable = user.role !== "owner" && user.id !== me?.id;
                    return (
                      <TableRow key={user.id} data-testid={`users-row-${user.email}`}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-sm">{ROLE_LABELS[user.role]}</TableCell>
                        <TableCell>
                          <StatusBadge status={user.status} />
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-right">
                          {deletable && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              aria-label="Hapus akun"
                              onClick={() => setDeleting(user)}
                              data-testid={`users-delete-button-${user.email}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Akun owner tidak dapat dihapus demi keamanan toko.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Akun</DialogTitle>
            <DialogDescription>
              Akun <b>{deleting?.name}</b> ({deleting?.email}) akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleting(null)}
              data-testid="users-delete-cancel-button"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              data-testid="users-delete-confirm-button"
            >
              {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}