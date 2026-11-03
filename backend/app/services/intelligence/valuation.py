from __future__ import annotations

import statistics

from app.schemas.profile_analysis import AccessoryCandidate, Networth, Recommendation
from app.services.intelligence.normalize import FAMILIES, RULES
from app.services.market.flip_engine import book, vwap

# Explicitly excluded mechanics require additional member state (contacts/Rift).
SPECIAL = {"HEGEMONY_ARTIFACT", "RIFT_PRISM"}


def power(item_id, rarity):
    if "ABICASE" in item_id or item_id == "RIFT_PRISM":
        return None
    v = RULES["power"].get(rarity)
    return v * 2 if v is not None and item_id == "HEGEMONY_ARTIFACT" else v


def enrich(out, items, products=None, auction_values=None, timestamp=None):
    products = products or {}
    auction_values = auction_values or []
    by_match = {}
    by_id = {}
    for r in auction_values:
        if r.get("reference_price") is None or r.get("confidence") not in ("medium", "high"):
            continue
        by_match.setdefault(r.get("match_key"), []).append(r)
        if not r.get("modifiers") and r.get("count") == 1:
            by_id.setdefault((r.get("item_id"), r.get("rarity")), []).append(r)
    for a in out.assets:
        if a.soulbound:
            continue
        product = products.get(a.item_id)
        # Bazaar is only used when no item modifiers could change value.
        if product and not a.modifiers:
            price = vwap(book(product.get("sell_summary"), bids=True), a.count)
            if price is not None:
                a.value = price * a.count
                a.method = "bazaar_visible_bid"
                a.confidence = "medium"
                a.price_timestamp = timestamp
        if a.value is None and a.match_key in by_match:
            rows = by_match[a.match_key]
            a.value = statistics.median(r["reference_price"] for r in rows)
            a.method = "exact_bin_listing_median"
            a.confidence = "medium"
            a.price_timestamp = timestamp
    owned = {}
    unknown = False
    for a in out.assets:
        if a.location != "accessory_bag":
            continue
        family = FAMILIES.get(a.item_id)
        contribution = power(a.item_id, a.rarity)
        if family is None or contribution is None:
            unknown = True
            continue
        owned[family] = max(owned.get(family, 0), contribution)
    bag_known = out.completeness.get("accessory_bag") == "known"
    subset = sum(owned.values()) if bag_known else None
    out.accessory_power_known_subset = subset
    # Catalogue intentionally partial: no claim of exact total with unsupported families.
    out.accessory_power = subset if bag_known and not unknown else None
    if unknown:
        out.warnings.append("accessory_power_partial_catalogue")
    out.accessories = []
    if bag_known:
        owned_ids = {a.item_id for a in out.assets if a.location == "accessory_bag"}
        for family in RULES["families"]:
            for id in family:
                if id in owned_ids:
                    continue
                meta = items.get(id)
                if not meta or meta.get("category") != "ACCESSORY":
                    continue
                gain = power(id, meta.get("tier"))
                gain = max(0, gain - owned.get(family[0], 0)) if gain is not None else None
                if gain is not None and gain <= 0:
                    continue
                cost = None
                method = "unknown"
                confidence = "insufficient"
                if not meta.get("soulbound") and out.profile_type not in ("ironman", "stranded", "bingo"):
                    if id in products:
                        cost = vwap(book(products[id].get("buy_summary"), bids=False), 1)
                        if cost is not None:
                            method = "bazaar_visible_ask"
                            confidence = "medium"
                    elif (id, meta.get("tier")) in by_id:
                        cost = statistics.median(r["reference_price"] for r in by_id[(id, meta.get("tier"))])
                        method = "bin_listing_reference"
                        confidence = "medium"
                req = [str(r) for r in meta.get("requirements", [])]
                out.accessories.append(
                    AccessoryCandidate(
                        item_id=id,
                        family=family[0],
                        rarity=meta.get("tier"),
                        gain=gain,
                        cost=cost,
                        coins_per_point=cost / gain if cost is not None and gain else None,
                        method=method,
                        confidence=confidence,
                        requirements=req,
                        price_timestamp=timestamp if cost is not None else None,
                    )
                )
    priced = [a for a in out.assets if a.value is not None]
    unknown_assets = [a for a in out.assets if a.value is None and not a.soulbound]
    liquid = out.networth.personal_liquid
    bank = next((m.value for m in out.metrics if m.id == "bank"), None)
    if not out.coop and liquid is not None and bank is not None:
        liquid += bank
    tradable = sum(a.value for a in priced) if priced else (0 if not out.assets else None)
    known = sum(a.value for a in priced) + (liquid or 0) if priced or liquid is not None else None
    out.networth = Networth(
        personal_liquid=liquid,
        shared_bank=bank if out.coop else None,
        tradable=tradable,
        untradeable_count=sum(a.soulbound for a in out.assets),
        unknown_count=len(unknown_assets) + len(out.pets),
        priced_count=len(priced),
        coverage=len(priced) / (len(out.assets) + len(out.pets)) if out.assets or out.pets else None,
        known_total=known,
        complete=False,
    )
    out.warnings += [
        "networth_partial_not_earnings",
        "shared_bank_excluded" if out.coop else "inventory_coverage_not_total_wealth",
    ]
    for c in out.accessories:
        if c.gain and c.cost is not None:
            out.recommendations.append(
                Recommendation(
                    id=f"accessory:{c.item_id}",
                    category="accessories",
                    subject=c.item_id,
                    current=0,
                    target=c.gain,
                    score=50,
                    cost=c.cost,
                    source=c.method,
                    reason="catalogued_family_increment_not_guaranteed_gain",
                    confidence=c.confidence,
                    requirements=c.requirements,
                    status="locked" if c.requirements else "available",
                )
            )
    gear_candidates(out, items)
    for recommendation in out.recommendations:
        if recommendation.category.startswith("gear:"):
            meta = items.get(recommendation.subject, {})
            rows = by_id.get((recommendation.subject, meta.get("tier")), [])
            if rows:
                recommendation.cost = statistics.median(r["reference_price"] for r in rows)
    out.recommendations.sort(key=lambda r: (-r.score, r.id))
    return out


def gear_candidates(out, items):
    """Curated role candidates; eligibility comes from official item requirements, never rarity."""
    candidates = {
        "archer": ["JUJU_SHORTBOW"],
        "mage": ["WITHER_GOGGLES"],
        "berserk": ["FLOWER_OF_TRUTH"],
        "tank": ["WITHER_CHESTPLATE"],
        "healer": ["NECROMANCER_SWORD"],
    }
    owned = {a.item_id for a in out.assets}
    cata = next((m.level for m in out.metrics if m.id == "catacombs"), None)
    for role, ids in candidates.items():
        for id in ids:
            if id in owned or id not in items:
                continue
            meta = items[id]
            requirements = []
            missing = False
            for r in meta.get("requirements", []) + meta.get("catacombs_requirements", []):
                kind = r.get("type")
                known = False
                met = False
                if kind == "DUNGEON_TIER":
                    known = out.completeness["dungeons"] == "known"
                    met = out.floors.get(str(r.get("tier")), 0) > 0
                elif kind == "DUNGEON_SKILL":
                    known = cata is not None
                    met = known and cata >= r.get("level", 0)
                elif kind == "SLAYER":
                    level = next(
                        (m.level for m in out.metrics if m.category == "slayer" and m.id == r.get("slayer_boss_type")),
                        None,
                    )
                    known = level is not None
                    met = known and level >= r.get("level", 0)
                else:
                    missing = True
                if not known:
                    missing = True
                if not met:
                    requirements.append(str(r))
            inventory = out.completeness.get("inv_contents") == "known" and out.completeness.get("inv_armor") == "known"
            out.recommendations.append(
                Recommendation(
                    id=f"gear:{role}:{id}",
                    category=f"gear:{role}",
                    subject=id,
                    score=45,
                    status="missing_data" if missing or not inventory else "locked" if requirements else "available",
                    requirements=requirements,
                    dependencies=requirements,
                    source="resources.items.requirements + catacombs_requirements",
                    reason="role_candidate_not_dps_upgrade",
                    confidence="low",
                )
            )
