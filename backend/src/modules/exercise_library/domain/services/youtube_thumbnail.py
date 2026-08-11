"""Derive a YouTube thumbnail URL from a video URL.

Uses proper URL parsing (urllib.parse) rather than substring index arithmetic —
a prior version located the video id via `url.find("v=")`, which could match a
`v=` substring inside an unrelated query parameter name that happens to end in
"v" (e.g. `?abv=1&v=REALID` would incorrectly extract from the first "v=").
"""

from urllib.parse import urlparse, parse_qs


def derive_youtube_thumbnail(video_url: str | None) -> str | None:
    """Derive a YouTube thumbnail URL from a video URL.

    Supports youtube.com/watch?v=ID and youtu.be/ID (with or without extra
    query params/path segments). Returns None if the URL is missing or doesn't
    look like a YouTube URL.
    """
    video_id = extract_youtube_id(video_url)
    if not video_id:
        return None
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def extract_youtube_id(video_url: str | None) -> str | None:
    """Extract the 11-character video id from a YouTube URL, or None."""
    if not video_url:
        return None

    try:
        parsed = urlparse(video_url)
    except ValueError:
        return None

    hostname = (parsed.hostname or "").lower()

    if hostname.endswith("youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]
        return video_id or None

    if hostname == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/")[0]
        return video_id or None

    return None
