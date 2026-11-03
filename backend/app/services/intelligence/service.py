from __future__ import annotations

import asyncio
import time

from app.schemas.profile_analysis import Analysis
from app.services.intelligence.normalize import RULES, normalize
from app.services.intelligence.valuation import enrich


class IntelligenceService:
    def __init__(self, container):
        self.container = container

    async def overview(self, uuid, profile_id, market=False):
        # Reuse the same cached raw profile, never one upstream call per UI block.
        response = await self.container.players.get_profile(profile_id)
        profile = response.profile.model_dump()
        skills = {}
        items = {}
        warnings = []
        try:
            resource = await self.container.resources.skills()
            skills = {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in resource.skills.items()}
        except Exception:
            warnings.append("skills_resource_unavailable")
        try:
            resource = await self.container.resources.items()
            items = {
                item["id"]: item
                for item in resource.items
                if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id")
            }
        except Exception:
            warnings.append("items_resource_unavailable")

        # Membership is checked before returning or caching any selected-member data.
        def build():
            return normalize(profile, uuid, skills, items, response.meta.fetched_at_ms, stale=response.meta.stale)

        version = f"{RULES['version']}:{response.meta.fetched_at_ms}:{uuid}:{profile_id}:{market}"

        async def fetch():
            out = await asyncio.to_thread(build)
            products = {}
            values = []
            timestamp = None
            if market:
                try:
                    bz = await self.container.bazaar.get_bazaar()
                    if not bz.meta.stale and int(time.time() * 1000) - bz.lastUpdated <= 120000:
                        products = {k: v.model_dump() for k, v in bz.products.items()}
                        timestamp = bz.lastUpdated
                except Exception:
                    warnings.append("bazaar_unavailable")
                # Explicit opt-in: do not force a multi-page AH refresh on every profile view.
                try:
                    snapshot = await self.container.auctions.get_snapshot()
                    if not snapshot.stale and int(time.time() * 1000) - snapshot.value["last_updated"] <= 120000:
                        values = await self.container.market._auction_values(snapshot, int(time.time() * 1000))
                        timestamp = min(timestamp or snapshot.value["last_updated"], snapshot.value["last_updated"])
                except Exception:
                    warnings.append("auction_valuation_unavailable")
            out = await asyncio.to_thread(enrich, out, items, products, values, timestamp)
            out.warnings.extend(warnings)
            return out.model_dump()

        result = await self.container.cache_service.get_or_fetch(
            f"intelligence:{version}", ttl=60, stale_ttl=0, fetcher=fetch, allow_swr=False
        )
        out = Analysis.model_validate(result.value)
        out.stale = out.stale or response.meta.stale
        return out
