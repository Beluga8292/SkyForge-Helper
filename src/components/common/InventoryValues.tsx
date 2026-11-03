import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { useBazaar } from "@/hooks/useBazaar";
import type { InventoryContainer, ProfileMemberStats } from "@/types/profile";
import {
  inventoryValueIndex,
  inventoryItemValue,
  type InventoryValue,
} from "@/features/inventory/values";
import { useI18n } from "@/locales";
/** Mounted only while enabled. One shared analysis + Bazaar query, never per slot. */
export function InventoryValues({
  member,
  profileId,
  containers,
  children,
}: {
  member: ProfileMemberStats;
  profileId: string;
  containers: InventoryContainer[];
  children: (values: Map<string, InventoryValue>) => ReactNode;
}) {
  const provider = useDataProvider(),
    scope = useDataScope(),
    bazaar = useBazaar(),
    { t } = useI18n();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ["intelligence", scope, member.uuid, profileId, true],
    queryFn: ({ signal }) =>
      provider.getIntelligence(member.uuid, profileId, true, signal),
    enabled: Boolean(member.uuid && profileId),
    staleTime: 60000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const prices = useMemo(
    () =>
      new Map(
        bazaar.quotes
          .filter((q) => q.instantSell > 0 || q.instantBuy > 0)
          .map((q) => [
            q.productId.toUpperCase(),
            q.instantSell > 0 ? q.instantSell : q.instantBuy,
          ]),
      ),
    [bazaar.quotes],
  );
  const index = useMemo(
    () =>
      inventoryValueIndex(
        query.data
          ? {
              ...query.data,
              stale:
                query.data.stale ||
                Boolean(query.error) ||
                Boolean(bazaar.envelope?.stale),
            }
          : undefined,
        member.uuid,
        profileId,
        prices,
        bazaar.envelope?.updatedAt ?? null,
      ),
    [
      query.data,
      query.error,
      member.uuid,
      profileId,
      prices,
      bazaar.envelope?.stale,
      bazaar.envelope?.updatedAt,
    ],
  );
  const values = useMemo(() => {
    const result = new Map<string, InventoryValue>();
    for (const c of containers)
      if (c.known)
        for (const item of c.slots)
          if (item)
            result.set(
              `${c.id}:${item.slot}`,
              inventoryItemValue(
                item,
                c.location,
                index,
                bazaar.itemMap.get(item.itemId),
                Math.max(clock, Date.now()),
              ),
            );
    return result;
  }, [containers, index, bazaar.itemMap, clock]);
  return (
    <>
      {query.error || bazaar.error ? (
        <p role="alert" className="mb-3 text-xs text-amber">
          {t("invValue.error")}
        </p>
      ) : null}
      <p className="mb-3 text-[10px] text-fg-subtle">{t("invValue.note")}</p>
      {children(values)}
    </>
  );
}
