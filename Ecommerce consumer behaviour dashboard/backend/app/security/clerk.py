from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.config import settings


@dataclass
class JwksCache:
    keys: dict | None = None
    fetched_at: float = 0.0


_jwks_cache = JwksCache()


def _get_jwks_url() -> str:
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url
    if settings.clerk_issuer:
        return settings.clerk_issuer.rstrip("/") + "/.well-known/jwks.json"
    raise RuntimeError("Clerk JWKS configuration missing. Set DASH_CLERK_JWKS_URL or DASH_CLERK_ISSUER")


def _fetch_jwks() -> dict:
    url = _get_jwks_url()
    with httpx.Client(timeout=5.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.json()


def _get_cached_jwks(ttl_seconds: int = 300) -> dict:
    now = time.time()
    if _jwks_cache.keys and (now - _jwks_cache.fetched_at) < ttl_seconds:
        return _jwks_cache.keys
    jwks = _fetch_jwks()
    _jwks_cache.keys = jwks
    _jwks_cache.fetched_at = now
    return jwks


def verify_clerk_jwt(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise ValueError("Invalid JWT header") from exc

    kid = header.get("kid")
    if not kid:
        raise ValueError("JWT kid missing")

    jwks = _get_cached_jwks()
    keys = jwks.get("keys", []) if isinstance(jwks, dict) else []
    key = next((k for k in keys if isinstance(k, dict) and k.get("kid") == kid), None)
    if not key:
        _jwks_cache.keys = None
        jwks = _get_cached_jwks(ttl_seconds=0)
        keys = jwks.get("keys", []) if isinstance(jwks, dict) else []
        key = next((k for k in keys if isinstance(k, dict) and k.get("kid") == kid), None)

    if not key:
        raise ValueError("JWT signing key not found")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer if settings.clerk_issuer else None,
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise ValueError("JWT verification failed") from exc

    if not isinstance(claims, dict):
        raise ValueError("Invalid JWT claims")

    return claims
