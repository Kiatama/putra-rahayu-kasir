"""Server-side date helpers. The pod clock is UTC — anchor "today" here, never in the browser."""

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def today_iso(tz: str | None = None) -> str:
    """Today's date as YYYY-MM-DD in `tz` (default: APP_TZ env, else UTC)."""
    zone = tz or os.environ.get("APP_TZ", "UTC")
    return datetime.now(ZoneInfo(zone)).strftime("%Y-%m-%d")


def utc_aware(dt: datetime) -> datetime:
    """Motor hands naive datetimes back — re-tag UTC so Pydantic serialises an offset."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
