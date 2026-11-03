"""Bounded, member-scoped, deterministic domain normalization; no network calls."""

from __future__ import annotations

import base64
import gzip
import io
import json
import math
from pathlib import Path

import nbtlib

from app.core.errors import UpstreamNotFoundError
from app.schemas.profile_analysis import Analysis, Asset, Metric, Networth, Pet, Recommendation
from app.services.market.auctions import identity_from_item

RULES = json.loads((Path(__file__).parents[2] / "data/intelligence_rules.json").read_text())
FAMILIES = {item: family[0] for family in RULES["families"] for item in family}
for canonical, aliases in RULES["aliases"].items():
    for alias in aliases:
        FAMILIES[alias] = FAMILIES.get(canonical, canonical)
RARITIES = list(RULES["power"])


def obj(x):
    return x if isinstance(x, dict) else {}


def num(x):
    return (
        float(x)
        if not isinstance(x, bool) and isinstance(x, (int, float)) and math.isfinite(x) and 0 <= x <= 1e18
        else None
    )


def milestone(id, category, xp, thresholds, source):
    xp = num(xp)
    if xp is None:
        return Metric(id=id, category=category, source=source)
    if not thresholds:
        return Metric(id=id, category=category, value=xp, source=source, state="not_supported")
    level = max((i for i, t in enumerate(thresholds) if xp >= t), default=0)
    target = thresholds[level + 1] if level + 1 < len(thresholds) else None
    previous = thresholds[level]
    return Metric(
        id=id,
        category=category,
        value=xp,
        level=level,
        target=target,
        remaining=max(0, target - xp) if target is not None else None,
        progress=min(1, max(0, (xp - previous) / (target - previous)))
        if target is not None and target > previous
        else 1,
        state="known",
        source=source,
    )


def pet_progress(raw):
    kind, rarity = raw.get("type", "UNKNOWN"), raw.get("tier")
    xp = num(raw.get("exp"))
    custom = RULES["custom_pets"].get(kind)
    offset = (custom or {}).get("rarity_offset", RULES["pet_offsets"]).get(rarity)
    levels = RULES["pet_levels"][offset : offset + 99] if offset is not None else []
    if custom and custom.get("pet_levels"):
        if custom.get("type") == 1:
            levels += custom["pet_levels"]
        else:
            levels = custom["pet_levels"]
        levels = levels[: custom["max_level"] - 1]
    if custom and custom.get("xp_multiplier"):
        levels = [v * custom["xp_multiplier"] for v in levels]
    metric = milestone(
        kind, "pets", xp, [0, *list(__import__("itertools").accumulate(levels))] if levels else [], "pets_data.pets"
    )
    return Pet(
        type=kind,
        rarity=rarity,
        xp=xp,
        level=metric.level + 1 if metric.level is not None else None,
        next_xp=metric.target,
        remaining=metric.remaining,
        progress=metric.progress,
        held_item=raw.get("heldItem"),
        active=raw.get("active") if isinstance(raw.get("active"), bool) else None,
        state=metric.state,
    )


def decode_inventory(blob, location, items):
    if not isinstance(blob, str) or len(blob) > 2 * 1024 * 1024:
        raise ValueError("oversized_nbt")
    compressed = base64.b64decode(blob, validate=True)
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        data = stream.read(2 * 1024 * 1024 + 1)
    if len(data) > 2 * 1024 * 1024:
        raise ValueError("oversized_nbt")
    root = nbtlib.File.parse(io.BytesIO(data)).unpack()
    if "i" not in root:
        raise ValueError("missing_inventory_list")
    entries = root["i"]
    if not isinstance(entries, list) or len(entries) > 1000:
        raise ValueError("oversized_inventory")
    out = []
    for slot, item in enumerate(entries):
        tag = obj(item.get("tag"))
        extra = obj(tag.get("ExtraAttributes"))
        id = extra.get("id")
        if not isinstance(id, str):
            if item:
                raise ValueError("unidentified_item")
            continue
        count = num(item.get("Count"))
        if count is None or count != int(count) or not 1 <= count <= 64:
            raise ValueError("invalid_item_count")
        meta = items.get(id, {})
        rarity = meta.get("tier")
        lore = obj(tag.get("display")).get("Lore", [])
        if isinstance(lore, list):
            import re

            for line in reversed(lore[-4:]):
                found = False
                clean = re.sub("§.", "", str(line))
                for r in reversed(RARITIES):
                    if clean.startswith(r.replace("_", " ")):
                        rarity = r
                        found = True
                        break
                if found:
                    break
        match = identity_from_item(item, rarity)
        out.append(
            Asset(
                match_key=match[0] if match else None,
                key=f"{location}:{slot}",
                item_id=id,
                name=meta.get("name", id),
                location=location,
                category=meta.get("category"),
                count=int(count),
                rarity=rarity,
                modifiers=json.loads(
                    json.dumps(
                        {
                            k: v
                            for k, v in extra.items()
                            if k not in ("id", "uuid", "timestamp", "originTag", "spawnedFor")
                        },
                        default=lambda value: value.tolist() if hasattr(value, "tolist") else str(value),
                        allow_nan=False,
                    )
                ),
                uuid=str(extra["uuid"]) if extra.get("uuid") else None,
                soulbound=bool(extra.get("donated_museum") or extra.get("soulbound") or meta.get("soulbound")),
            )
        )
    return out


def normalize(profile, uuid, skills, items, fetched_at, source="backend", stale=False, demo=False):
    uuid = uuid.replace("-", "").lower()
    member = next((v for k, v in obj(profile.get("members")).items() if k.replace("-", "").lower() == uuid), None)
    if not isinstance(member, dict) or obj(member.get("profile")).get("deletion_notice"):
        raise UpstreamNotFoundError("Profile member unavailable")
    metrics = []
    completeness = {}
    assets = []
    warnings = []
    experience = obj(obj(member.get("player_data")).get("experience"))
    completeness["skills"] = "known" if experience else "unknown"
    for id, xp in sorted(experience.items()):
        key = id.removeprefix("SKILL_")
        resource = obj(skills.get(key))
        rows = resource.get("levels") or []
        thresholds = [0] + [
            r["totalExpRequired"]
            for r in sorted(rows, key=lambda r: r["level"])
            if num(r.get("totalExpRequired")) is not None
        ]
        metrics.append(
            milestone(key, "skills", xp, thresholds if rows else [], "player_data.experience + resources.skills")
        )
    sx = num(obj(member.get("leveling")).get("experience"))
    metrics.append(
        milestone(
            "skyblock",
            "general",
            sx,
            [100 * i for i in range(int(sx // 100) + 2)] if sx is not None and sx < 1e7 else [],
            "leveling.experience /100",
        )
    )
    bosses = obj(obj(member.get("slayer")).get("slayer_bosses"))
    completeness["slayers"] = "known" if bosses else "unknown"
    for id, b in sorted(bosses.items()):
        metrics.append(
            milestone(id, "slayer", obj(b).get("xp"), RULES["slayer_xp"].get(id, []), "slayer.slayer_bosses + rules")
        )
    d = obj(member.get("dungeons"))
    types = obj(d.get("dungeon_types"))
    cata = obj(types.get("catacombs"))
    completeness["dungeons"] = "known" if cata else "unknown"
    metrics.append(
        milestone(
            "catacombs", "dungeons", cata.get("experience"), RULES["catacombs"], "dungeons.dungeon_types.catacombs"
        )
    )
    for id, raw in sorted(obj(d.get("player_classes")).items()):
        metrics.append(
            milestone(id, "classes", obj(raw).get("experience"), RULES["catacombs"], "dungeons.player_classes")
        )
    for id, amount in sorted(obj(member.get("collection")).items()):
        metrics.append(
            Metric(
                id=id,
                category="collections",
                value=num(amount),
                state="known" if num(amount) is not None else "unknown",
                source="member.collection",
            )
        )
    coop = len(obj(profile.get("members"))) > 1
    purse = num(obj(member.get("currencies")).get("coin_purse"))
    bank = num(obj(profile.get("banking")).get("balance"))
    metrics += [
        Metric(
            id="purse",
            category="economy",
            value=purse,
            state="known" if purse is not None else "unknown",
            source="currencies.coin_purse",
        ),
        Metric(
            id="bank",
            category="economy",
            value=bank,
            state="known" if bank is not None else "private",
            source="profile.banking.balance",
            scope="shared" if coop else "member",
        ),
    ]
    inv = obj(member.get("inventory"))
    bags = obj(inv.get("bag_contents"))
    locations = {
        k: inv.get(k)
        for k in ["inv_contents", "inv_armor", "equipment_contents", "ender_chest_contents", "wardrobe_contents"]
    }
    locations["accessory_bag"] = bags.get("talisman_bag")
    # Legacy transitional location is accepted only if the current bag path is absent.
    if locations["accessory_bag"] is None:
        locations["accessory_bag"] = inv.get("talisman_bag")
    backpacks = obj(inv.get("backpack_contents"))
    for key, raw in sorted(backpacks.items())[:16]:
        locations[f"backpack:{key}"] = raw
    if len(backpacks) > 16:
        warnings.append("storage_truncated_16_bags")
    for key, raw in locations.items():
        blob = obj(raw).get("data")
        completeness[key] = "private" if blob is None else "unknown"
        if blob is None:
            continue
        try:
            assets += decode_inventory(blob, key, items)
            completeness[key] = "known"
        except Exception:
            completeness[key] = "invalid"
            warnings.append(f"invalid_nbt:{key}")
    seen = set()
    unique = []
    for asset in assets:
        if asset.uuid and asset.uuid in seen:
            continue
        if asset.uuid:
            seen.add(asset.uuid)
        unique.append(asset)
    completeness["storage"] = (
        (
            "known"
            if len(backpacks) <= 16 and all(completeness.get(f"backpack:{k}") == "known" for k in backpacks)
            else "unknown"
        )
        if "backpack_contents" in inv
        else "private"
    )
    completeness["museum"] = "not_supported"
    pets_raw = obj(member.get("pets_data")).get("pets")
    completeness["pets"] = "known" if isinstance(pets_raw, list) else "unknown"
    pets = [pet_progress(obj(p)) for p in (pets_raw or [])[:500]] if isinstance(pets_raw, list) else []
    crafted = obj(member.get("player_data")).get("crafted_generators")
    minions = [v for v in crafted if isinstance(v, str)][:1000] if isinstance(crafted, list) else None
    out = Analysis(
        rules_version=RULES["version"],
        uuid=uuid,
        profile_id=profile["profile_id"],
        profile_name=profile.get("cute_name"),
        profile_type=profile.get("game_mode") or "normal",
        coop=coop,
        first_join=num(obj(member.get("profile")).get("first_join")),
        last_save=num(member.get("last_save")),
        fetched_at=fetched_at,
        source=source,
        stale=stale,
        demo=demo,
        completeness=completeness,
        metrics=metrics,
        assets=unique,
        pets=pets,
        recommendations=[],
        accessories=[],
        networth=Networth(personal_liquid=purse, shared_bank=bank if coop else None),
        warnings=warnings,
        selected_class=d.get("selected_dungeon_class"),
        floors={str(k): v for k, v in obj(cata.get("tier_completions")).items() if num(v) is not None},
        minions=minions,
    )
    recommend(out)
    return out


def recommend(out):
    rows = []
    for m in out.metrics:
        if (
            m.category not in ("skills", "slayer", "dungeons", "classes", "general")
            or m.state != "known"
            or m.target is None
        ):
            continue
        rows.append(
            Recommendation(
                id=f"next:{m.category}:{m.id}",
                category=m.category,
                subject=m.id,
                current=m.value,
                target=m.target,
                remaining=m.remaining,
                score=40 + 40 * (m.progress or 0),
                source=m.source,
                reason="next_verified_xp_milestone",
            )
        )
    cata = next((m for m in out.metrics if m.id == "catacombs"), None)
    for floor, level in enumerate(RULES["floor_levels"]):
        if floor == 0 or out.floors.get(str(floor), 0) > 0:
            continue
        prior = out.floors.get(str(floor - 1), 0) > 0
        ready = cata is not None and cata.level is not None and cata.level >= level and prior
        rows.append(
            Recommendation(
                id=f"floor:{floor}",
                category="dungeons",
                subject=f"catacombs_floor_{floor}",
                current=cata.level if cata else None,
                target=level,
                score=65 if ready else 20,
                status="available" if ready else "locked",
                requirements=[f"catacombs>={level}", f"floor:{floor - 1}"],
                dependencies=[] if prior else [f"floor:{floor - 1}"],
                source="rules.floor_levels + tier_completions",
                reason="floor_unlock_is_not_readiness",
            )
        )
    for r in rows:
        metric = next((m for m in out.metrics if m.category == r.category and m.id == r.subject), None)
        if metric and metric.category == "skills" and metric.id in ("FARMING", "TAMING") and (metric.level or 0) >= 50:
            r.status = "missing_data"
            r.requirements.append("individual_level_cap_unverified")
    out.warnings.append("skill_levels_are_xp_derived_individual_caps_unverified")
    out.recommendations = sorted(rows, key=lambda r: (-r.score, r.id))
