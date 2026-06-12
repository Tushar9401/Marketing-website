from django.core.exceptions import RequestDataTooBig
from django.http import HttpResponse, JsonResponse


ALLOWED_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
}


class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse()
        else:
            try:
                response = self.get_response(request)
            except RequestDataTooBig:
                response = JsonResponse(
                    {"error": "Upload is too large. Please use files up to 500 MB."},
                    status=413,
                )

        origin = request.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response["Access-Control-Max-Age"] = "86400"
        return response
