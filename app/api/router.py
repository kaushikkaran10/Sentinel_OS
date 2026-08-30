"""Aggregates every versioned sub-router under the ``/api/v1`` prefix.

Health/liveness routes stay at the root and are mounted directly in main.py.
"""

from __future__ import annotations

from fastapi import APIRouter

from api import kb, system
from core.config import settings

api_router = APIRouter(prefix=settings.API_V1_PREFIX)
api_router.include_router(system.router)
api_router.include_router(kb.router)
