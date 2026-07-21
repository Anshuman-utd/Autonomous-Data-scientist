from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class EmailBackend(ModelBackend):
    """
    Custom authentication backend that authenticates using email instead of username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        email = username or kwargs.get('email')
        if email is None:
            email = kwargs.get('username')
        
        try:
            # Look up by email (case-insensitive)
            user = UserModel.objects.get(email__iexact=email)
        except UserModel.DoesNotExist:
            # Fallback to username lookup just in case
            try:
                user = UserModel.objects.get(username__iexact=email)
            except UserModel.DoesNotExist:
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
        user = authenticate(username=email, password=password)

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
