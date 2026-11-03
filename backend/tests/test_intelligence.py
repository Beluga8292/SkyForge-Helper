from __future__ import annotations

import base64
import gzip
import io
import json
from pathlib import Path

import nbtlib
import pytest
from fastapi.testclient import TestClient

from app.core.errors import UpstreamNotFoundError
from app.main import create_app
from app.schemas.profile_analysis import Analysis
from app.services.intelligence.normalize import RULES, decode_inventory, milestone, normalize, pet_progress
from app.services.intelligence.valuation import enrich, power
from app.services.market.auctions import identity

UUID = "0123456789abcdef0123456789abcdef"
PROFILE = "fedcba9876543210fedcba9876543210"
RESOURCES = json.loads((Path(__file__).parents[2] / "src/features/intelligence/demo-resources.json").read_text())
ITEMS = {i["id"]: i for i in RESOURCES["items"]}
DEMO_NBT = json.loads((Path(__file__).parents[2] / "src/features/intelligence/demo-inventory.json").read_text())


def profile():
    return {
        "profile_id": PROFILE,
        "cute_name": "Synthetic test",
        "banking": {"balance": 500},
        "members": {
            UUID: {
                "profile": {"first_join": 1000},
                "currencies": {"coin_purse": 100},
                "leveling": {"experience": 150},
                "player_data": {"experience": {"SKILL_MINING": 1000}, "crafted_generators": ["COBBLESTONE_1"]},
                "slayer": {"slayer_bosses": {"zombie": {"xp": 1000}, "vampire": {"xp": 75}, "future_boss": {"xp": 10}}},
                "dungeons": {
                    "dungeon_types": {"catacombs": {"experience": 1000, "tier_completions": {"0": 1, "1": 1}}},
                    "player_classes": {"mage": {"experience": 0}},
                },
                "inventory": {
                    "inv_contents": {"data": DEMO_NBT["inventory"]},
                    "inv_armor": {"data": DEMO_NBT["empty"]},
                    "bag_contents": {"talisman_bag": {"data": DEMO_NBT["bag"]}},
                },
                "pets_data": {"pets": [{"type": "WOLF", "tier": "COMMON", "exp": 100, "active": True}]},
                "collection": {"WHEAT": 0},
            }
        },
    }


def analyse(raw=None):
    return normalize(raw or profile(), UUID, RESOURCES["skills"], ITEMS, 10000)


def nbt(items):
    root = nbtlib.File(
        {
            "i": nbtlib.List[nbtlib.Compound](
                [
                    nbtlib.Compound(
                        {
                            "Count": nbtlib.Byte(1),
                            "Damage": nbtlib.Short(0),
                            "tag": nbtlib.Compound(
                                {
                                    "ExtraAttributes": nbtlib.Compound(extra),
                                    "display": nbtlib.Compound(
                                        {"Lore": nbtlib.List[nbtlib.String]([rarity + " ACCESSORY"])}
                                    ),
                                }
                            ),
                        }
                    )
                    for extra, rarity in items
                ]
            )
        }
    )
    buf = io.BytesIO()
    root.write(buf)
    return base64.b64encode(gzip.compress(buf.getvalue())).decode()


def test_valid_profile_normalizes_member_metrics_and_metadata():
    a = analyse()
    assert a.schema_version == "1" and a.rules_version == RULES["version"]
    assert next(m for m in a.metrics if m.id == "MINING").value == 1000
    assert next(m for m in a.metrics if m.id == "WHEAT").value == 0
    assert a.minions == ["COBBLESTONE_1"] and a.pets[0].level == 2
    assert Analysis.model_validate(a.model_dump()) == a


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"profile_id": PROFILE, "members": {}},
        {"profile_id": PROFILE, "members": {UUID: {"profile": {"deletion_notice": {"timestamp": 1}}}}},
    ],
)
def test_missing_deleted_or_nonmember_profile_is_not_another_member(raw):
    with pytest.raises(UpstreamNotFoundError):
        normalize(raw, UUID, {}, ITEMS, 1000)


def test_private_inventory_suppresses_missing_accessory_recommendations():
    p = profile()
    p["members"][UUID].pop("inventory")
    a = enrich(analyse(p), ITEMS)
    assert a.completeness["accessory_bag"] == "private" and a.assets == []
    assert a.accessory_power is None and a.accessories == []


@pytest.mark.parametrize("bad", ["broken", "x" * (2 * 1024 * 1024 + 1)])
def test_invalid_and_oversized_nbt_are_classified(bad):
    p = profile()
    p["members"][UUID]["inventory"]["inv_contents"]["data"] = bad
    a = analyse(p)
    assert a.completeness["inv_contents"] == "invalid"
    assert "invalid_nbt:inv_contents" in a.warnings


def test_decompression_bomb_is_bounded():
    data = base64.b64encode(gzip.compress(b"x" * (2 * 1024 * 1024 + 1))).decode()
    with pytest.raises(ValueError, match="oversized"):
        decode_inventory(data, "bag", {})


def test_partial_profile_is_unknown_and_unknown_fields_do_not_invent_stats():
    p = {"profile_id": PROFILE, "members": {UUID: {"future_xp": 999, "dungeons": {"player_classes": {}}}}}
    a = analyse(p)
    assert next(m for m in a.metrics if m.id == "catacombs").value is None
    assert next(m for m in a.metrics if m.id == "purse").value is None
    assert all(m.value != 999 for m in a.metrics)


def test_coop_resources_not_attributed_to_selected_member():
    p = profile()
    p["members"]["f" * 32] = {"currencies": {"coin_purse": 999999}}
    a = enrich(analyse(p), ITEMS)
    assert a.coop
    assert a.networth.personal_liquid == 100 and a.networth.shared_bank == 500
    assert next(m for m in a.metrics if m.id == "bank").scope == "shared"


@pytest.mark.parametrize(("xp", "level", "next_xp"), [(0, 0, 50), (50, 1, 125), (125, 2, 235), (1000, 6, 1425)])
def test_dungeon_cumulative_curve(xp, level, next_xp):
    m = milestone("catacombs", "dungeons", xp, RULES["catacombs"], "rules")
    assert (m.level, m.target) == (level, next_xp)


@pytest.mark.parametrize(("kind", "xp", "level"), [("zombie", 1000, 4), ("vampire", 75, 2), ("future", 20, None)])
def test_slayer_categories_and_unknown_curve(kind, xp, level):
    m = milestone(kind, "slayer", xp, RULES["slayer_xp"].get(kind, []), "rules")
    assert m.level == level


def test_completed_milestone_absent_dependencies_and_determinism():
    a = analyse()
    b = analyse()
    assert a.recommendations == b.recommendations
    assert all(r.id != "floor:1" for r in a.recommendations)
    assert next(r for r in a.recommendations if r.id == "floor:3").status == "locked"
    assert next(r for r in a.recommendations if r.id == "floor:3").dependencies == ["floor:2"]
    assert all(r.reason and r.source for r in a.recommendations)


@pytest.mark.parametrize(
    ("kind", "rarity", "xp", "level"),
    [
        ("WOLF", "COMMON", 0, 1),
        ("WOLF", "COMMON", 100, 2),
        ("WOLF", "LEGENDARY", 660, 2),
        ("BINGO", "LEGENDARY", 100, 2),
        ("REINDEER", "COMMON", 100, 1),
        ("GOLDEN_DRAGON", "LEGENDARY", 1e12, 200),
        ("WOLF", "UNKNOWN", 100, None),
    ],
)
def test_pet_nonlinear_and_custom_curves(kind, rarity, xp, level):
    assert pet_progress({"type": kind, "tier": rarity, "exp": xp}).level == level


def test_accessory_families_recombob_duplicates_and_unknown_specials():
    p = profile()
    p["members"][UUID]["inventory"]["bag_contents"]["talisman_bag"]["data"] = nbt(
        [
            ({"id": nbtlib.String("SPEED_TALISMAN")}, "COMMON"),
            ({"id": nbtlib.String("SPEED_RING")}, "RARE"),
            ({"id": nbtlib.String("SPEED_RING")}, "UNCOMMON"),
        ]
    )
    a = enrich(analyse(p), ITEMS)
    assert a.accessory_power == 8
    assert not any(c.item_id == "SPEED_ARTIFACT" for c in a.accessories)  # no gain over recombob ring
    assert power("HEGEMONY_ARTIFACT", "LEGENDARY") == 32 and power("RIFT_PRISM", "RARE") is None
    p["members"][UUID]["inventory"]["bag_contents"]["talisman_bag"]["data"] = nbt(
        [({"id": nbtlib.String("FUTURE_ACCESSORY")}, "RARE")]
    )
    assert enrich(analyse(p), ITEMS).accessory_power is None


def test_bazaar_depth_unavailable_and_networth_unknown_are_not_zero():
    a = enrich(
        analyse(), ITEMS, {"ENCHANTED_DIAMOND": {"sell_summary": [{"pricePerUnit": 100, "amount": 64}]}}, timestamp=1000
    )
    item = next(a for a in a.assets if a.item_id == "ENCHANTED_DIAMOND")
    assert item.value == 6400
    assert a.networth.personal_liquid == 600 and a.networth.known_total == 7000
    assert not a.networth.complete and a.networth.coverage < 1
    b = enrich(analyse(), ITEMS, {"ENCHANTED_DIAMOND": {"sell_summary": []}})
    assert next(a for a in b.assets if a.item_id == "ENCHANTED_DIAMOND").value is None


def test_modified_asset_requires_exact_stage3_comparables():
    p = profile()
    blob = nbt([({"id": nbtlib.String("SPEED_RING"), "modifier": nbtlib.String("strong")}, "UNCOMMON")])
    p["members"][UUID]["inventory"]["inv_contents"]["data"] = blob
    a = analyse(p)
    item = next(a for a in a.assets if a.location == "inv_contents")
    match = identity({"item_bytes": blob, "tier": "UNCOMMON"})
    assert item.match_key == match[0]
    row = {
        "match_key": item.match_key,
        "reference_price": 12345,
        "confidence": "medium",
        "item_id": "SPEED_RING",
        "rarity": "UNCOMMON",
        "modifiers": {"modifier": '"strong"'},
    }
    enriched = enrich(a, ITEMS, auction_values=[row], timestamp=1000)
    assert next(a for a in enriched.assets if a.location == "inv_contents").value == 12345
    row["match_key"] = "different"
    assert enrich(analyse(p), ITEMS, auction_values=[row]).assets[0].value is None


def test_uuid_duplicate_not_counted_twice_and_soulbound_not_priced():
    p = profile()
    blob = nbt(
        [
            (
                {"id": nbtlib.String("SPEED_RING"), "uuid": nbtlib.String("same"), "donated_museum": nbtlib.Byte(1)},
                "UNCOMMON",
            )
        ]
    )
    inv = p["members"][UUID]["inventory"]
    inv["inv_contents"]["data"] = blob
    inv["inv_armor"]["data"] = blob
    a = enrich(analyse(p), ITEMS)
    assert len([a for a in a.assets if a.uuid == "same"]) == 1
    assert next(a for a in a.assets if a.uuid == "same").value is None


def test_gear_unknown_prerequisites_never_actionable():
    a = enrich(analyse(), ITEMS)
    r = next(r for r in a.recommendations if r.subject == "JUJU_SHORTBOW")
    assert r.status == "missing_data" and r.requirements and r.confidence == "low"


@pytest.mark.parametrize(
    "section", ["overview", "recommendations", "accessories", "dungeons", "slayers", "pets", "networth"]
)
def test_api_shared_profile_and_membership(settings, upstream, section):
    async def transport(request):
        if request.url.path == "/v2/skyblock/profile":
            import httpx

            return httpx.Response(200, json={"success": True, "profile": profile()})
        return await upstream.handle(request)

    import httpx

    app = create_app(settings, upstream_transport=httpx.MockTransport(transport))
    with TestClient(app) as client:
        response = client.get(f"/api/v1/intelligence/players/{UUID}/profiles/{PROFILE}/{section}")
        assert response.status_code == 200, response.text
        assert response.json()["schema_version"] == "1"
        # Item metadata drives valuation; a schema mismatch must not silently
        # degrade every priced asset to "unknown".
        assert "items_resource_unavailable" not in response.json()["warnings"]
        assert client.get(f"/api/v1/intelligence/players/{'f' * 32}/profiles/{PROFILE}/{section}").status_code == 404
        assert client.get(f"/api/v1/intelligence/players/nope/profiles/{PROFILE}/{section}").status_code == 422
        assert client.get("/api/v1/intelligence/status").json()["mode"] == "on_demand"


def test_bundled_frontend_rules_are_identical():
    assert RULES == json.loads((Path(__file__).parents[2] / "src/features/intelligence/rules.json").read_text())


def test_valid_nbt_without_inventory_list_is_not_an_empty_bag():
    root = nbtlib.File({"unknown": nbtlib.String("x")})
    buf = io.BytesIO()
    root.write(buf)
    blob = base64.b64encode(gzip.compress(buf.getvalue())).decode()
    with pytest.raises(ValueError, match="missing_inventory_list"):
        decode_inventory(blob, "bag", ITEMS)


def test_unknown_nbt_arrays_are_json_serializable_without_guessing_value():
    blob = nbt([({"id": nbtlib.String("SPEED_RING"), "future_array": nbtlib.IntArray([1, 2, 3])}, "UNCOMMON")])
    assets = decode_inventory(blob, "bag", ITEMS)
    assert assets[0].modifiers["future_array"] == [1, 2, 3]
    assert assets[0].value is None
    json.dumps(assets[0].model_dump())
