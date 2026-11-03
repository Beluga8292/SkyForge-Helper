import { useDataProvider } from "@/data";
import { useEffect, useState } from "react";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { useMarketAlerts } from "@/stores/market-alerts";
import { newRule, ruleSchema, type AlertRule } from "@/features/market/alerts";
import { notificationPermission } from "@/features/market/notifications";
import { useI18n } from "@/locales";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDateTime } from "@/utils/format";
export function SmartAlertsPanel() {
  const provider = useDataProvider();
  const { t, language } = useI18n(),
    store = useMarketAlerts(),
    [editing, setEditing] = useState<AlertRule | null>(null),
    [id, setId] = useState(""),
    [kind, setKind] = useState<AlertRule["kind"]>("price_below"),
    [threshold, setThreshold] = useState("100"),
    [cooldown, setCooldown] = useState("5"),
    [invalid, setInvalid] = useState(false),
    [permission, setPermission] = useState("default");
  useEffect(() => {
    void notificationPermission()
      .then(setPermission)
      .catch(() => setPermission("unsupported"));
  }, []);
  const edit = (r: AlertRule) => {
    setEditing(r);
    setId(r.productId);
    setKind(r.kind);
    setThreshold(String(r.threshold));
    setCooldown(String(r.cooldownMs / 60000));
  };
  const save = () => {
    try {
      if (
        !/^[A-Za-z0-9_:.*-]{1,96}$/.test(id) ||
        !threshold.trim() ||
        !cooldown.trim()
      )
        throw Error();
      const base = editing ?? newRule(id, kind, Number(threshold));
      const rule = ruleSchema.parse({
        ...base,
        productId: id.toUpperCase(),
        kind,
        threshold: Number(threshold),
        cooldownMs: Number(cooldown) * 60000,
        lastSnapshot: null,
        active: false,
        baselinePrice: null,
        seenAuctions: [],
      });
      store.save(rule);
      setEditing(null);
      setId("");
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  };
  if (provider.isDemo)
    return (
      <section className="panel p-5 text-sm text-fg-muted">
        {t("market.demoAlerts")}
      </section>
    );
  return (
    <section className="panel p-5">
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <Bell className="size-4 text-violet" />
        {t("market.alerts")}
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-fg-muted">
        {t("market.alertNote")}
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <Label htmlFor="rule-item">{t("market.productId")}</Label>
          <Input
            id="rule-item"
            value={id}
            maxLength={96}
            onChange={(e) => setId(e.target.value)}
            placeholder="ENCHANTED_DIAMOND"
          />
        </div>
        <div>
          <Label htmlFor="rule-kind">{t("market.condition")}</Label>
          <select
            className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-xs"
            id="rule-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AlertRule["kind"])}
          >
            {ruleSchema.shape.kind.options.map((k) => (
              <option key={k} value={k}>
                {t(`market.rule.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rule-threshold">{t("market.threshold")}</Label>
          <Input
            id="rule-threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="rule-cooldown">{t("market.cooldown")}</Label>
          <Input
            id="rule-cooldown"
            type="number"
            min={1}
            max={1440}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
        </div>
      </div>
      <div className="my-3 flex flex-wrap items-center gap-3">
        <Button onClick={save}>
          {t(editing ? "market.updateRule" : "market.createRule")}
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(null);
              setId("");
            }}
          >
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() =>
            void notificationPermission(true)
              .then(setPermission)
              .catch(() => setPermission("unsupported"))
          }
        >
          {t("market.permission")}
        </Button>
        <span className="text-xs text-fg-muted">
          {t("market.permissionStatus", {
            status: t(
              `market.permission.${["granted", "denied", "default", "unsupported"].includes(permission) ? (permission as "granted") : "unsupported"}`,
            ),
          })}
        </span>
      </div>
      {invalid ? (
        <p role="alert" className="text-xs text-red">
          {t("market.ruleInvalid")}
        </p>
      ) : null}
      {store.error ? (
        <p role="alert" className="text-xs text-red">
          {t("market.storageError")}
        </p>
      ) : null}
      <div className="my-4 space-y-2">
        {store.rules.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-xs"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={() =>
                  store.save({
                    ...r,
                    enabled: !r.enabled,
                    lastSnapshot: null,
                    active: false,
                  })
                }
              />
              {t("market.enabled")}
            </label>
            <span className="font-mono">{r.productId}</span>
            <span>
              {t(`market.rule.${r.kind}`)} {r.threshold}
            </span>
            <span className="text-fg-subtle">{r.cooldownMs / 60000} min</span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("market.edit")}
              onClick={() => edit(r)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("market.delete")}
              onClick={() => store.remove(r.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <h3 className="mb-2 text-sm font-semibold">{t("market.alertHistory")}</h3>
      <div className="max-h-72 overflow-auto">
        {store.events.map((e) => (
          <div
            key={e.id}
            className="border-b border-line py-2 text-xs text-fg-muted"
          >
            {formatDateTime(e.ts, language)} · {e.productId} ·{" "}
            {t(`market.rule.${e.kind}`)} {e.value.toFixed(2)}
          </div>
        ))}
        {!store.events.length ? (
          <p className="text-xs text-fg-subtle">{t("market.noHistory")}</p>
        ) : null}
      </div>
    </section>
  );
}
