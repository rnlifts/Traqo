"""Unit tests for youtube_thumbnail.py.

Covers the specific bug the code review found: a query param whose name merely
ends in "v" (not the actual "v=" param) must not be mistaken for the video id.
"""

from src.modules.exercise_library.domain.services.youtube_thumbnail import (
    derive_youtube_thumbnail,
    extract_youtube_id,
)


class TestExtractYoutubeId:
    def test_standard_watch_url(self):
        assert extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url_with_trailing_params(self):
        assert extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30") == "dQw4w9WgXcQ"

    def test_watch_url_with_multiple_trailing_params(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&index=3"
        assert extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url_with_trailing_params(self):
        assert extract_youtube_id("https://youtu.be/dQw4w9WgXcQ?t=30") == "dQw4w9WgXcQ"

    def test_no_www_subdomain(self):
        assert extract_youtube_id("https://youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_regression_a_param_name_ending_in_v_before_the_real_v_param(self):
        """The bug the code review found: naive `url.find("v=")` matches the "v="
        inside "abv=1" first and extracts garbage. Proper query parsing must find
        the real "v" parameter regardless of what precedes it."""
        url = "https://www.youtube.com/watch?abv=1&v=dQw4w9WgXcQ"
        assert extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_none_url(self):
        assert extract_youtube_id(None) is None

    def test_empty_url(self):
        assert extract_youtube_id("") is None

    def test_non_youtube_url(self):
        assert extract_youtube_id("https://vimeo.com/12345") is None

    def test_youtube_url_with_no_v_param(self):
        assert extract_youtube_id("https://www.youtube.com/watch?list=PLxyz") is None

    def test_malformed_url_does_not_raise(self):
        assert extract_youtube_id("not a url at all :::") is None


class TestDeriveYoutubeThumbnail:
    def test_builds_thumbnail_url_from_video_id(self):
        result = derive_youtube_thumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        assert result == "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"

    def test_none_for_non_youtube_url(self):
        assert derive_youtube_thumbnail("https://vimeo.com/12345") is None

    def test_none_for_none_input(self):
        assert derive_youtube_thumbnail(None) is None
