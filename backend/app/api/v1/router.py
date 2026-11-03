from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import auctions, bazaar, intelligence, market, players, resources, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(bazaar.router)
api_router.include_router(auctions.router)
api_router.include_router(players.router)
api_router.include_router(resources.router)

api_router.include_router(market.router)

api_router.include_router(intelligence.router)
