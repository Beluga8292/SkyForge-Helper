import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Link2, Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales";
import { useAccountDialogStore } from "@/stores/account-dialog";
import { useSettingsStore } from "@/stores/settings";
import { useMojangLookup, usePlayerProfiles } from "@/hooks/usePlayer";
import { ApiError, errorMessageKey } from "@/api/errors";
import { validateMinecraftName } from "@/utils/validation";
import type { LinkedProfile } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { clearTransientAccountCaches } from "@/features/account/caches";
import { cn } from "@/utils/cn";

export function LinkAccountDialog() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { open, mode, redirect, close } = useAccountDialogStore();
  const linked = useSettingsStore((state) => state.settings.lastProfile);
  const setLinkedProfile = useSettingsStore((state) => state.setLinkedProfile);

  const [confirmed, setConfirmed] = useState(mode !== "switch");
  const [input, setInput] = useState("");
  const [lookupName, setLookupName] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmed(mode !== "switch");
    setInput("");
    setLookupName(null);
    setSelectedProfileId(null);
    setBinding(false);
  }, [open, mode]);

  const mojang = useMojangLookup(lookupName, Boolean(lookupName));
  const player = usePlayerProfiles({
    uuid: mojang.data?.id,
    name: mojang.data?.name,
    enabled: Boolean(mojang.data),
  });

  const profiles = player.data?.profiles ?? [];
  const sameAccount =
    Boolean(linked && mojang.data) &&
    linked!.uuid.replace(/-/g, "").toLowerCase() ===
      mojang.data!.id.replace(/-/g, "").toLowerCase();

  const preferredProfileId = useMemo(() => {
    if (selectedProfileId) return selectedProfileId;
    if (sameAccount && linked?.profileId) return linked.profileId;
    return (
      profiles.find((profile) => profile.selected)?.id ?? profiles[0]?.id ?? null
    );
  }, [selectedProfileId, sameAccount, linked?.profileId, profiles]);

  const selectedProfile =
    profiles.find((profile) => profile.id === preferredProfileId) ?? null;

  const submitLookup = (event: FormEvent) => {
    event.preventDefault();
    const result = validateMinecraftName(input);
    if (!result.valid) {
      toast.error(t("profile.searchHint"));
      return;
    }
    setSelectedProfileId(null);
    setLookupName(result.value);
  };

  const bind = () => {
    if (!player.data || !selectedProfile) return;
    setBinding(true);
    const previousUuid = linked?.uuid;
    const next: LinkedProfile = {
      uuid: player.data.uuid,
      name: player.data.name,
      profileId: selectedProfile.id,
      profileName: selectedProfile.cuteName ?? undefined,
      gameMode: selectedProfile.gameMode,
    };
    setLinkedProfile(next);
    clearTransientAccountCaches(queryClient, previousUuid);
    setBinding(false);
    toast.success(t("account.linked"), {
      description: `${next.name} · ${next.profileName ?? next.profileId}`,
    });
    close();
    if (redirect) navigate(redirect, { replace: true });
    else if (mode === "switch") navigate("/profile");
  };

  const notFound = mojang.error instanceof ApiError && mojang.error.kind === "not-found";
  const missingKey = player.error
    ? errorMessageKey(player.error) === "errors.missingKey"
    : false;

  if (!open) return null;

  if (!confirmed) {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={t("account.switchTitle")}
        description={t("account.switchDesc")}
        confirmLabel={t("account.switchConfirm")}
        onConfirm={() => setConfirmed(true)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? close() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "switch" ? (
              <Link2 className="size-4 text-violet" />
            ) : (
              <UserPlus className="size-4 text-violet" />
            )}
            {t("account.linkTitle")}
          </DialogTitle>
          <DialogDescription>{t("account.linkDesc")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <form onSubmit={submitLookup} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="link-account-name">{t("account.nickname")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  id="link-account-name"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t("profile.placeholder")}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <Button type="submit" disabled={mojang.isFetching} className="sm:w-auto">
              {mojang.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {mojang.isFetching ? t("account.searching") : t("account.find")}
            </Button>
          </form>

          {notFound ? (
            <p className="rounded-lg border border-amber/25 bg-amber/[0.06] px-3 py-2 text-[11.5px] text-amber/90">
              {t("account.notFound")}
            </p>
          ) : null}
          {missingKey ? (
            <p className="rounded-lg border border-amber/25 bg-amber/[0.06] px-3 py-2 text-[11.5px] text-amber/90">
              {t("errors.missingKey")}
            </p>
          ) : null}
          {player.error && !missingKey && !notFound ? (
            <p className="flex items-start gap-2 rounded-lg border border-red/25 bg-red/[0.05] px-3 py-2 text-[11.5px] text-red/90">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {t("errors.unavailable")}
            </p>
          ) : null}

          {player.isFetching ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/30 px-3 py-3 text-[11.5px] text-fg-muted">
              <Loader2 className="size-3.5 animate-spin" /> {t("common.loading")}
            </div>
          ) : null}

          {player.data && !profiles.length ? (
            <p className="rounded-lg border border-line bg-surface-2/30 px-3 py-2 text-[11.5px] text-fg-muted">
              {t("account.noProfiles")}
            </p>
          ) : null}

          {profiles.length ? (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                {t("account.chooseProfile")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {profiles.map((profile) => {
                  const active = profile.id === preferredProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-violet/45 bg-violet-soft text-fg"
                          : "border-line bg-surface-2/30 text-fg-muted hover:border-line-strong hover:text-fg",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-md border",
                          active
                            ? "border-violet/40 bg-violet/15 text-violet"
                            : "border-line bg-surface-2 text-fg-subtle",
                        )}
                      >
                        {active ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium">
                          {profile.cuteName ?? profile.id.slice(0, 8)}
                        </span>
                        <span className="block font-mono text-[9.5px] text-fg-subtle">
                          {profile.gameMode ?? "normal"} · LV{" "}
                          {profile.member?.skyblockLevel ?? "?"}
                          {profile.isCoop ? ` · co-op ${profile.coopMemberCount}` : ""}
                        </span>
                      </span>
                      {profile.selected ? (
                        <Badge variant="outline" className="shrink-0 text-[9px]">
                          {t("profile.selected")}
                        </Badge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {player.data ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/25 px-3 py-2">
              <PlayerAvatar uuid={player.data.uuid} name={player.data.name} size={28} />
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-medium text-fg">
                  {player.data.name}
                </p>
                <p className="truncate font-mono text-[9px] text-fg-subtle">
                  {player.data.uuid}
                </p>
              </div>
            </div>
          ) : null}

          <p className="text-[10px] leading-relaxed text-fg-subtle">{t("account.hint")}</p>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close} disabled={binding}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={bind}
            disabled={!player.data || !selectedProfile || binding}
          >
            {binding ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
            {binding ? t("account.binding") : t("account.bind")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
