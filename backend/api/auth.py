from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication


class QueryParamOrHeaderJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to support both Authorization: Bearer <token> header
    and ?token=<token> query parameter (useful for browser window.open and downloads).
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = None
            if hasattr(request, 'query_params'):
                raw_token = request.query_params.get('token')
            if not raw_token and hasattr(request, 'GET'):
                raw_token = request.GET.get('token')
            if raw_token:
                if isinstance(raw_token, str):
                    raw_token = raw_token.encode('utf-8')

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token


class EmailBackend(ModelBackend):
    """
    Custom authentication backend that authenticates using email instead of username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        email = username or kwargs.get('email')
        if email is None:
            email = kwargs.get('username')

        if not email:
            return None

        # Look up by email (case-insensitive) or username safely
        user = UserModel.objects.filter(email__iexact=email).first()
        if not user:
            user = UserModel.objects.filter(username__iexact=email).first()
        if not user:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom SimpleJWT Serializer to accept 'email' instead of 'username'.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace the username field with an email field
        self.fields['email'] = serializers.EmailField()
        if 'username' in self.fields:
            del self.fields['username']

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        # Authenticate using django.contrib.auth.authenticate
        from django.contrib.auth import authenticate
        user = authenticate(request=self.context.get('request'), username=email, password=password)

        if not user:
            raise serializers.ValidationError({"detail": "No active account found with the given credentials"})

        self.user = user

        # Generate JWT tokens
        data = {}
        refresh = self.get_token(self.user)

        data["refresh"] = str(refresh)
        data["access"] = str(refresh.access_token)

        # Include some basic user info for the frontend
        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "full_name": self.user.first_name,
        }

        return data

