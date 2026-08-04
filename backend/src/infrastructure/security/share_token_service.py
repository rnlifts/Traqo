import secrets


def generate_share_token() -> str:
    """Generate a cryptographically random, URL-safe opaque share token.

    32 random bytes -> 43 URL-safe characters; fits the 64-char column with room
    to spare and is infeasible to guess.
    """
    return secrets.token_urlsafe(32)
