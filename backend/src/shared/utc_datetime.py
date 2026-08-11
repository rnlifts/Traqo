"""Shared datetime type for API responses.

All timestamps in this app are stored as naive datetimes assumed to be UTC
(the DB columns are plain DateTime, not TIMESTAMPTZ). Serializing a naive
datetime straight to JSON produces a string with no offset (e.g.
"2026-08-11T07:59:37"), which browsers interpret as *local* time via
`new Date(...)`, silently shifting every timestamp by the viewer's UTC
offset. UTCDatetime tags the naive value as UTC at serialization time so the
JSON always carries an explicit offset.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _serialize_as_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


UTCDatetime = Annotated[datetime, PlainSerializer(_serialize_as_utc, return_type=str)]
