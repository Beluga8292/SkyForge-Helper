import { APP_VERSION, RELEASE_BUILD, DEVELOPER_TOOLS_ENABLED } from "@/version";
import { DiagnosticsPanel } from "@/components/common/DiagnosticsPanel";
import { UpdatePanel } from "@/components/common/UpdateDialog";
import { TexturePackSettings } from "@/components/common/TexturePackSettings";
import { normalizeBackendUrl } from "@/data/backend-url";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Globe,
  Image,
  KeyRound,
  Loader2,
  Palette,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  FlaskConical,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n, type TranslationKey } from "@/locales";
import { useSettingsStore } from "@/stores/settings";
import { verifyApiKey } from "@/api/hypixel/client";
import { ApiError, errorMessageKey } from "@/api/errors";
import {
  getSecretStatus,
  saveApiKey,
  deleteApiKey,
  getApiKey,
} from "@/services/secrets";
import { clearApiCache, getCacheStats } from "@/services/cache";
import { clearMarketHistory } from "@/services/history";
import {
  getDataDirectory,
  openExternal,
  openLocalPath,
} from "@/services/desktop";
import { isTauriRuntime } from "@/api/transport";
import { useConnectionStatus } from "@/hooks/useConnection";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  timeAgo,
} from "@/utils/format";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InfoNote } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { DataMode, Language, ThemeId } from "@/types/app";

type ConfirmKind =
  "delete-key" | "clear-cache" | "clear-history" | "reset" | null;

export function SettingsPage() {
  const { t, language } = useI18n();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const reset = useSettingsStore((state) => state.reset);
  const developer = DEVELOPER_TOOLS_ENABLED && settings.developerMode;
  const queryClient = useQueryClient();

  const secretStatus = useQuery({
    queryKey: ["secret-status"],
    queryFn: getSecretStatus,
    enabled: developer,
    staleTime: 10_000,
  });
  const cacheStats = useQuery({
    queryKey: ["cache-stats"],
    queryFn: getCacheStats,
    staleTime: 10_000,
  });
  const dataDir = useQuery({
    queryKey: ["data-dir"],
    queryFn: getDataDirectory,
    enabled: developer,
    staleTime: 60_000,
  });

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);

  const status = secretStatus.data;
  const stored = Boolean(status?.configured);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) {
      toast.error(t("settings.apiKeyMissing"));
      return;
    }
    setSavingKey(true);
    try {
      await saveApiKey(keyInput);
      setKeyInput("");
      await queryClient.invalidateQueries({ queryKey: ["secret-status"] });
      await queryClient.invalidateQueries({ queryKey: ["player-profiles"] });
      toast.success(t("settings.keySavedToast"));
    } catch {
      toast.error(t("toasts.error"));
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestKey = async () => {
    const candidate = keyInput.trim() || (await getApiKey());
    if (!candidate) {
      toast.error(t("settings.apiKeyMissing"));
      return;
    }
    setTestingKey(true);
    try {
      const ok = await verifyApiKey(candidate);
      if (ok) toast.success(t("settings.keyTestOk"));
      else toast.error(t("settings.keyInvalid"));
    } catch (error) {
      if (error instanceof ApiError && error.kind === "auth")
        toast.error(t("settings.keyInvalid"));
      else
        toast.error(t("settings.keyTestFailed"), {
          description: t(errorMessageKey(error) as TranslationKey),
        });
    } finally {
      setTestingKey(false);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === "delete-key") {
        await deleteApiKey();
        setKeyInput("");
        await queryClient.invalidateQueries({ queryKey: ["secret-status"] });
        toast.success(t("settings.keyDeletedToast"));
      }
      if (confirm === "clear-cache") {
        await clearApiCache();
        await queryClient.invalidateQueries({ queryKey: ["cache-stats"] });
        toast.success(t("settings.cacheCleared"));
      }
      if (confirm === "clear-history") {
        await clearMarketHistory();
        await queryClient.invalidateQueries({ queryKey: ["cache-stats"] });
        await queryClient.invalidateQueries({ queryKey: ["market-history"] });
        toast.success(t("settings.historyCleared"));
      }
      if (confirm === "reset") {
        await reset();
        await queryClient.invalidateQueries({ queryKey: ["secret-status"] });
        toast.success(t("settings.saved"));
      }
      setConfirm(null);
    } catch {
      toast.error(t("toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-[fade-up_260ms_ease-out]">
      <PageHeader
        eyebrow={
          <>
            <Settings2 className="size-3" /> {t("nav.settings")}
          </>
        }
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={<Badge variant="outline">v{APP_VERSION}</Badge>}
      />

      {developer ? <DiagnosticsPanel /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Section icon={Palette} title={t("settings.appearance")}>
            <div>
              <Label>{t("settings.language")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["ru", "en"] as Language[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => update({ language: code })}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition-colors",
                      settings.language === code
                        ? "border-violet/40 bg-violet-soft text-fg"
                        : "border-line bg-surface-2/40 text-fg-muted hover:border-line-strong",
                    )}
                  >
                    <Globe className="size-3.5" />
                    {code === "ru"
                      ? t("settings.languageRu")
                      : t("settings.languageEn")}
                    {settings.language === code ? (
                      <Check className="size-3.5 text-violet" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{t("settings.theme")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    active={settings.theme === theme.id}
                    onClick={() => update({ theme: theme.id })}
                  />
                ))}
              </div>
              <FieldHint>{t("settings.themeHint")}</FieldHint>
            </div>

            <div>
              <Label>{t("settings.uiScale")}</Label>
              <Select
                value={String(settings.uiScale)}
                onValueChange={(value) => update({ uiScale: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.9">90%</SelectItem>
                  <SelectItem value="1">100%</SelectItem>
                  <SelectItem value="1.1">110%</SelectItem>
                  <SelectItem value="1.25">125%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SettingRow
              title={t("settings.reducedMotion")}
              description={t("settings.reducedMotionDesc")}
              htmlFor="reduced-motion"
            >
              <Switch
                id="reduced-motion"
                checked={settings.reducedMotion}
                onCheckedChange={(checked) =>
                  update({ reducedMotion: checked })
                }
              />
            </SettingRow>
          </Section>

          {developer ? <ConnectionSection /> : <ConnectionSummary />}

          <Section icon={RefreshCw} title={t("settings.data")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("settings.refreshInterval")}</Label>
                <Select
                  value={String(settings.refreshIntervalSec)}
                  onValueChange={(value) =>
                    update({ refreshIntervalSec: Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">
                      {t("settings.interval60")}
                    </SelectItem>
                    <SelectItem value="120">
                      {t("settings.interval120")}
                    </SelectItem>
                    <SelectItem value="300">
                      {t("settings.interval300")}
                    </SelectItem>
                    <SelectItem value="600">
                      {t("settings.interval600")}
                    </SelectItem>
                    <SelectItem value="900">
                      {t("settings.interval900")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>{t("settings.refreshHint")}</FieldHint>
              </div>
              <div>
                <Label>{t("settings.bazaarFee")}</Label>
                <Select
                  value={String(settings.bazaarFeePct)}
                  onValueChange={(value) =>
                    update({ bazaarFeePct: Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t("settings.fee0")}</SelectItem>
                    <SelectItem value="1">{t("settings.fee1")}</SelectItem>
                    <SelectItem value="1.125">
                      {t("settings.fee1125")}
                    </SelectItem>
                    <SelectItem value="1.25">{t("settings.fee125")}</SelectItem>
                    <SelectItem value="2.5">{t("settings.fee25")}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>{t("settings.bazaarFeeHint")}</FieldHint>
                <Label htmlFor="custom-bazaar-fee">
                  {t("market.customTax")}
                </Label>
                <Input
                  id="custom-bazaar-fee"
                  type="number"
                  min={0}
                  max={10}
                  step={0.001}
                  value={settings.bazaarFeePct}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n))
                      update({ bazaarFeePct: Math.max(0, Math.min(10, n)) });
                  }}
                />
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-line bg-surface-2/25 p-3">
              <SettingRow
                title={t("settings.enableNotifications")}
                description={t("settings.watchlistAlerts")}
                htmlFor="notifications"
              >
                <Switch
                  id="notifications"
                  checked={settings.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    update({ notificationsEnabled: checked })
                  }
                />
              </SettingRow>
              <SettingRow
                title={t("settings.watchlistAlerts")}
                description={t("watchlist.setTargetDesc")}
                htmlFor="alerts"
              >
                <Switch
                  id="alerts"
                  checked={settings.watchlistAlerts}
                  onCheckedChange={(checked) =>
                    update({ watchlistAlerts: checked })
                  }
                />
              </SettingRow>
              <SettingRow
                title={t("settings.hideBalances")}
                description={t("settings.privacy")}
                htmlFor="hide-balances"
              >
                <Switch
                  id="hide-balances"
                  checked={settings.hideBalances}
                  onCheckedChange={(checked) =>
                    update({ hideBalances: checked })
                  }
                />
              </SettingRow>
            </div>
          </Section>

          {DEVELOPER_TOOLS_ENABLED && (
            <Section icon={FlaskConical} title={t("settings.developer")}>
              <SettingRow
                title={t("settings.devMode")}
                description={t("settings.devModeDesc")}
                htmlFor="dev-mode"
              >
                <Switch
                  id="dev-mode"
                  disabled={RELEASE_BUILD}
                  checked={settings.developerMode}
                  onCheckedChange={(checked) =>
                    update({ developerMode: checked })
                  }
                />
              </SettingRow>
              <InfoNote>{t("settings.telemetry")}</InfoNote>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          {developer && settings.dataMode === "direct" ? (
            <Section icon={KeyRound} title={t("settings.api")}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      stored ? "bg-green" : "bg-amber",
                    )}
                  />
                  <span className="text-[11.5px] text-fg-muted">
                    {stored
                      ? t("settings.apiKeyStored")
                      : t("settings.apiKeyMissing")}
                  </span>
                </div>
                {status?.hint ? (
                  <span className="font-mono text-[10px] text-fg-subtle">
                    {t("settings.keyHint", { hint: status.hint })}
                  </span>
                ) : null}
              </div>

              <div>
                <Label htmlFor="api-key">{t("settings.apiKey")}</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                    placeholder={
                      stored
                        ? "••••••••••••••••"
                        : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-9 font-mono text-[11.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((current) => !current)}
                    className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-fg-subtle hover:text-fg"
                    aria-label={
                      showKey ? t("settings.apiKey") : t("settings.apiKey")
                    }
                  >
                    {showKey ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                <FieldHint>
                  {status?.storage === "session"
                    ? t("settings.apiKeySession")
                    : t("profile.apiKeyHint")}
                </FieldHint>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleSaveKey()}
                  disabled={savingKey || !keyInput.trim()}
                >
                  {savingKey ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-3.5" />
                  )}
                  {t("settings.saveKey")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleTestKey()}
                  disabled={testingKey}
                >
                  {testingKey ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  {testingKey ? t("settings.testing") : t("settings.testKey")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirm("delete-key")}
                  disabled={!stored}
                >
                  <Trash2 className="size-3.5" /> {t("settings.deleteKey")}
                </Button>
              </div>

              <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-3 text-[10.5px] leading-relaxed text-amber/90">
                <p className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="size-3.5" /> {t("settings.keyPolicy")}
                </p>
                <p className="mt-1 text-fg-subtle">
                  {t("settings.apiKeyNote")}
                </p>
              </div>

              <Button
                variant="link"
                size="sm"
                className="justify-start px-0"
                onClick={() =>
                  void openExternal("https://developer.hypixel.net/dashboard")
                }
              >
                <ExternalLink className="size-3.5" /> {t("settings.getKey")}
              </Button>
            </Section>
          ) : null}

          <Section icon={Database} title={t("settings.storage")}>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {t("settings.cacheDesc")}
            </p>
            {developer &&
              (cacheStats.isPending ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <StorageStat
                    label={t("settings.cacheEntries")}
                    value={String(cacheStats.data?.entries ?? 0)}
                  />
                  <StorageStat
                    label={t("settings.cacheSize")}
                    value={formatBytes(cacheStats.data?.bytes ?? 0)}
                  />
                  <StorageStat
                    label={t("settings.historyPoints")}
                    value={String(cacheStats.data?.historyPoints ?? 0)}
                  />
                </div>
              ))}
            {developer && cacheStats.data?.oldest ? (
              <p className="text-[9.5px] text-fg-subtle">
                {t("common.updated")}:{" "}
                {formatDateTime(cacheStats.data.oldest, language)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirm("clear-cache")}
              >
                <Database className="size-3.5" /> {t("settings.clearCache")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirm("clear-history")}
              >
                <Trash2 className="size-3.5" /> {t("settings.clearHistory")}
              </Button>
            </div>

            {developer && (
              <>
                <div className="rounded-xl border border-line bg-surface-2/25 p-3">
                  <p className="text-[9.5px] uppercase tracking-[0.08em] text-fg-subtle">
                    {t("settings.dataFolder")}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-fg-muted">
                    {dataDir.data ?? t("settings.openFolderUnavailable")}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 px-1.5"
                    disabled={!dataDir.data || !isTauriRuntime()}
                    onClick={async () => {
                      if (!dataDir.data) return;
                      try {
                        await openLocalPath(dataDir.data);
                      } catch {
                        toast.error(t("settings.openFolderUnavailable"));
                      }
                    }}
                  >
                    <FolderOpen className="size-3.5" />{" "}
                    {t("settings.openFolder")}
                  </Button>
                </div>
              </>
            )}
          </Section>

          <Section icon={Image} title={t("settings.textures")}>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {t("settings.texturesDesc")}
            </p>
            <TexturePackSettings />
          </Section>

          <Section icon={Server} title={t("settings.about")}>
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/25 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[11.5px] text-fg-muted">
                <Monitor className="size-3.5 text-violet" />{" "}
                {t("settings.version")}
              </span>
              <span className="font-mono text-[11px] text-fg">
                {APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-fg-muted">SkyForge Helper · © 2026 Beluga_8292</p>
            <UpdatePanel />
            {developer && (
              <>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/25 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[11.5px] text-fg-muted">
                    <Sparkles className="size-3.5 text-cyan" />{" "}
                    {t("settings.apiSource")}
                  </span>
                  <span className="text-[11px] text-fg">Hypixel API v2</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/25 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[11.5px] text-fg-muted">
                    <Bell className="size-3.5 text-amber" />{" "}
                    {t("settings.buildInfo")}
                  </span>
                  <span className="text-[11px] text-fg">
                    {isTauriRuntime() ? "Tauri desktop" : "Browser preview"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void openExternal("https://api.hypixel.net/")
                    }
                  >
                    <ExternalLink className="size-3.5" /> Hypixel API
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void openExternal("https://developer.hypixel.net/")
                    }
                  >
                    <ExternalLink className="size-3.5" /> Developer docs
                  </Button>
                </div>
              </>
            )}
            <p className="text-[10px] leading-relaxed text-fg-subtle">
              {t("settings.disclaimer")}
            </p>
            {developer && (
              <p className="rounded-lg border border-line bg-bg-elevated/50 px-3 py-2 text-[10px] text-fg-subtle">
                {t("settings.keyPolicy")}
              </p>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirm("reset")}
            >
              <RefreshCw className="size-3.5" /> {t("settings.resetSettings")}
            </Button>
            <InfoNote>{t("settings.telemetry")}</InfoNote>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "delete-key"
            ? t("settings.deleteKey")
            : confirm === "clear-cache"
              ? t("settings.clearCache")
              : confirm === "clear-history"
                ? t("settings.clearHistory")
                : t("settings.resetSettings")
        }
        description={
          confirm === "delete-key"
            ? t("settings.apiKeyNote")
            : confirm === "clear-cache"
              ? t("settings.cacheDesc")
              : confirm === "clear-history"
                ? t("settings.historyCleared")
                : t("settings.resetConfirmDesc")
        }
        confirmLabel={
          confirm === "delete-key" ||
          confirm === "clear-cache" ||
          confirm === "clear-history"
            ? t("common.delete")
            : t("common.reset")
        }
        destructive={confirm !== "reset"}
        busy={busy}
        onConfirm={() => void confirmAction()}
      >
        {confirm === "reset" ? (
          <p className="text-[11.5px] text-fg-muted">
            {t("settings.resetConfirm")}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

const CONNECTION_MODES: Array<{
  id: DataMode;
  title: TranslationKey;
  description: TranslationKey;
}> = [
  {
    id: "backend",
    title: "connection.backend",
    description: "connection.backendDesc",
  },
  {
    id: "direct",
    title: "connection.direct",
    description: "connection.directDesc",
  },
  { id: "demo", title: "connection.demo", description: "connection.demoDesc" },
];

const HEALTH_LABEL: Record<string, TranslationKey> = {
  checking: "connection.checking",
  connected: "connection.connected",
  degraded: "connection.degraded",
  offline: "connection.offline",
  misconfigured: "connection.misconfigured",
  direct: "connection.directActive",
  demo: "connection.demoActive",
};

const HEALTH_DOT: Record<string, string> = {
  checking: "bg-amber",
  connected: "bg-green",
  degraded: "bg-amber",
  offline: "bg-red",
  misconfigured: "bg-red",
  direct: "bg-cyan",
  demo: "bg-amber",
};

function ConnectionSection() {
  const { t, language } = useI18n();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const connection = useConnectionStatus();
  const [draftUrl, setDraftUrl] = useState(settings.backendUrl);

  useEffect(() => {
    setDraftUrl(settings.backendUrl);
  }, [settings.backendUrl]);

  const modeNote =
    connection.mode === "demo"
      ? t("connection.demoNote")
      : connection.mode === "direct"
        ? t("connection.byokNote")
        : t("settings.connectionDesc");

  return (
    <Section icon={Server} title={t("settings.connection")}>
      <p className="text-[11px] leading-relaxed text-fg-muted">
        {t("settings.connectionDesc")}
      </p>

      <div>
        <Label>{t("connection.mode")}</Label>
        <div className="grid gap-2">
          {CONNECTION_MODES.map((mode) => {
            const active = settings.dataMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  update({ dataMode: mode.id, demoMode: mode.id === "demo" });
                  if (mode.id === "demo")
                    toast.success(t("toasts.demoEnabled"));
                }}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-violet/45 bg-violet-soft"
                    : "border-line bg-surface-2/30 hover:border-line-strong",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg">
                    {mode.id === "backend" ? (
                      <Server className="size-3.5 text-violet" />
                    ) : mode.id === "direct" ? (
                      <KeyRound className="size-3.5 text-cyan" />
                    ) : (
                      <FlaskConical className="size-3.5 text-amber" />
                    )}
                    {t(mode.title)}
                    {mode.id === "backend" ? (
                      <Badge variant="violet">{t("common.recommended")}</Badge>
                    ) : null}
                  </span>
                  {active ? <Check className="size-3.5 text-violet" /> : null}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-fg-subtle">
                  {t(mode.description)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>{t("connection.endpoint")}</Label>
        <p className="break-all rounded-lg border border-line bg-surface-2/25 px-2.5 py-2 font-mono text-[10.5px] text-fg-muted">
          {connection.endpoint ||
            (connection.mode === "direct"
              ? "Hypixel API v2 (BYOK)"
              : connection.mode === "backend"
                ? t("connection.misconfigured")
                : t("connection.demo"))}
        </p>
        {settings.developerMode ? (
          <div className="mt-2 space-y-2">
            <Label htmlFor="backend-url">{t("connection.devEndpoint")}</Label>
            <div className="flex gap-2">
              <Input
                id="backend-url"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                placeholder="http://127.0.0.1:8000"
                spellCheck={false}
                className="font-mono text-[11px]"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const url = normalizeBackendUrl(draftUrl);
                  if (draftUrl.trim() && !url) {
                    toast.error(t("connection.invalidEndpoint"));
                    return;
                  }
                  update({ backendUrl: url ?? "" });
                }}
              >
                {t("connection.saveEndpoint")}
              </Button>
            </div>
            <p className="rounded-lg border border-amber/20 bg-amber/[0.04] px-2.5 py-2 text-[10px] leading-relaxed text-amber/90">
              {t("connection.devWarning")}
            </p>
          </div>
        ) : (
          <FieldHint>{t("connection.endpointLocked")}</FieldHint>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface-2/25 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11.5px] font-medium text-fg-muted">
            <span
              className={cn(
                "size-2 rounded-full",
                HEALTH_DOT[connection.health] ?? "bg-amber",
              )}
            />
            {t("connection.status")}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-fg">
              {t(HEALTH_LABEL[connection.health] ?? "connection.checking")}
            </span>
            {connection.mode === "backend" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={connection.refresh}
                disabled={connection.isRefreshing}
                aria-label={t("connection.refresh")}
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    connection.isRefreshing && "animate-spin",
                  )}
                />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 grid gap-1.5 text-[10px] text-fg-subtle">
          <div className="flex justify-between">
            <span>{t("connection.backendVersion")}</span>
            <span>{connection.version ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t("connection.lastSync")}</span>
            <span className="font-mono text-fg-muted">
              {connection.lastSuccessAt
                ? `${formatDateTime(connection.lastSuccessAt, language)} · ${timeAgo(connection.lastSuccessAt, language)}`
                : t("connection.never")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t("connection.cacheAge")}</span>
            <span className="font-mono text-fg-muted">
              {connection.cacheAgeMs == null
                ? "—"
                : formatDuration(
                    Math.max(0, Math.round(connection.cacheAgeMs / 1000)),
                  )}
            </span>
          </div>
        </div>
        {connection.error ? (
          <p className="mt-2 rounded-lg border border-red/20 bg-red/[0.04] px-2.5 py-2 text-[10px] leading-relaxed text-red/90">
            {t(errorMessageKey(connection.error) as TranslationKey)}
          </p>
        ) : null}
      </div>

      <div>
        <Label>{t("connection.services")}</Label>
        {connection.services.length ? (
          <div className="grid gap-1.5">
            {connection.services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/25 px-2.5 py-1.5"
              >
                <span className="flex items-center gap-2 text-[10.5px] text-fg-muted">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      service.state === "ok"
                        ? "bg-green"
                        : service.state === "degraded"
                          ? "bg-amber"
                          : "bg-red",
                    )}
                  />
                  {t(`connection.service.${service.id}` as TranslationKey)}
                </span>
                <span
                  className="max-w-[55%] truncate font-mono text-[9.5px] text-fg-subtle"
                  title={service.detail ?? undefined}
                >
                  {service.state}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <FieldHint>{t("connection.noServices")}</FieldHint>
        )}
      </div>

      <InfoNote>{modeNote}</InfoNote>
    </Section>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg border border-violet/20 bg-violet-soft text-violet">
          <Icon className="size-3.5" />
        </span>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
          {title}
        </h2>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <label htmlFor={htmlFor} className="min-w-0 cursor-pointer">
        <span className="block text-[11.5px] font-medium text-fg-muted">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-fg-subtle">
            {description}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function ThemeCard({
  theme,
  active,
  onClick,
}: {
  theme: {
    id: ThemeId;
    label: TranslationKey;
    bg: string;
    surface: string;
    accent: string;
  };
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group overflow-hidden rounded-xl border p-1.5 text-left transition-colors",
        active
          ? "border-violet/45 bg-violet-soft"
          : "border-line bg-surface-2/30 hover:border-line-strong",
      )}
    >
      <span
        className="flex h-12 w-full gap-1 overflow-hidden rounded-lg border border-black/20 p-1"
        style={{ background: theme.bg }}
      >
        <span
          className="h-full w-2.5 rounded-sm"
          style={{ background: theme.surface }}
        />
        <span className="flex flex-1 flex-col gap-1">
          <span
            className="h-1.5 w-2/3 rounded-sm"
            style={{ background: theme.surface }}
          />
          <span
            className="h-1 w-full rounded-sm"
            style={{ background: theme.surface }}
          />
          <span
            className="h-1 w-4/5 rounded-sm"
            style={{ background: theme.surface }}
          />
          <span
            className="mt-auto h-1.5 w-1/2 rounded-sm"
            style={{ background: theme.accent }}
          />
        </span>
      </span>
      <span className="mt-1.5 flex items-center justify-between px-0.5 text-[10px] font-medium text-fg-muted">
        {t(theme.label)}
        {active ? <Check className="size-3 text-violet" /> : null}
      </span>
    </button>
  );
}

function StorageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/25 px-2.5 py-2">
      <p className="text-[8.5px] uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[13px] font-semibold text-fg">
        {value}
      </p>
    </div>
  );
}

const THEMES: Array<{
  id: ThemeId;
  label: TranslationKey;
  bg: string;
  surface: string;
  accent: string;
}> = [
  {
    id: "graphite",
    label: "settings.themeGraphite",
    bg: "#0a0b0f",
    surface: "#1d212c",
    accent: "#8b5cf6",
  },
  {
    id: "midnight",
    label: "settings.themeMidnight",
    bg: "#05070d",
    surface: "#161d2d",
    accent: "#a78bfa",
  },
  {
    id: "light",
    label: "settings.themeLight",
    bg: "#f3f4f8",
    surface: "#d6d9e4",
    accent: "#7c3aed",
  },
];

function ConnectionSummary() {
  const { t, language } = useI18n();
  const connection = useConnectionStatus();
  return (
    <Section icon={Server} title={t("settings.connection")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg">
          {t(`connection.${connection.health}` as TranslationKey)}
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={connection.refresh}
          disabled={connection.isRefreshing}
        >
          <RefreshCw className="size-3.5" />
          {t("common.refresh")}
        </Button>
      </div>
      <p className="text-xs text-fg-muted">
        {t("connection.lastSync")}:{" "}
        {connection.lastSuccessAt
          ? formatDateTime(connection.lastSuccessAt, language)
          : "—"}
      </p>
    </Section>
  );
}
