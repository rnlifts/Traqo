from datetime import datetime, timezone

from pydantic import BaseModel

from src.shared.utc_datetime import UTCDatetime


class _Model(BaseModel):
    ts: UTCDatetime


class TestUTCDatetime:
    def test_naive_datetime_serializes_with_utc_offset(self):
        """DB rows come back as naive datetimes assumed to be UTC; the JSON
        must carry an explicit offset so browsers don't reinterpret it as
        local time (this is exactly what caused workout-completion times to
        display in the wrong timezone)."""
        naive = datetime(2026, 8, 11, 7, 59, 37)
        model = _Model(ts=naive)

        assert model.model_dump_json() == '{"ts":"2026-08-11T07:59:37Z"}'

    def test_aware_non_utc_datetime_is_converted_to_utc(self):
        from datetime import timedelta

        aware = datetime(2026, 8, 11, 13, 44, 37, tzinfo=timezone(timedelta(hours=5, minutes=45)))
        model = _Model(ts=aware)

        assert model.model_dump_json() == '{"ts":"2026-08-11T07:59:37Z"}'

    def test_aware_utc_datetime_round_trips(self):
        aware_utc = datetime(2026, 8, 11, 7, 59, 37, tzinfo=timezone.utc)
        model = _Model(ts=aware_utc)

        assert model.model_dump_json() == '{"ts":"2026-08-11T07:59:37Z"}'
