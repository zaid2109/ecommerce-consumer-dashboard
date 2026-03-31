from slowapi import Limiter

# Initialize the Limiter
limiter = Limiter(key_func=lambda request: request.client.host)