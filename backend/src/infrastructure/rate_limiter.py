from slowapi import Limiter
from slowapi.util import get_remote_address

from src.config.settings import settings

# Rate limits exist to slow down a malicious actor, not to constrain our own
# test infrastructure. E2E tests run many registrations/logins from the same
# machine (same client IP, since slowapi keys by remote address) within a
# short window — enough to blow through the real 3/15minutes login limit
# even though every request is legitimate. ENVIRONMENT=test is set explicitly
# and only for these test runs (see frontend/playwright.config.ts), so it's
# safe to disable enforcement there without weakening real production limits.
limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=True,
    enabled=settings.ENVIRONMENT != "test",
)
