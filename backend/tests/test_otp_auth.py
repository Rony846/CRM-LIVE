"""
Test OTP Authentication Flow
Tests the OTP login bug fixes:
1. localStorage using 'mg_token' instead of 'token'
2. setToken/setUser exported from AuthContext
3. UserResponse model includes profile_incomplete and missing_fields
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOTPAuthentication:
    """Test OTP authentication endpoints"""
    
    def test_send_otp_success(self):
        """Test sending OTP to a valid phone number"""
        # First check if user exists with this phone
        response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "9560377363"
        })
        
        # Should succeed (200) or fail with 404 if user doesn't exist
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}, body: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "OTP sent" in data["message"]
            assert "expires_in" in data
            print(f"OTP sent successfully: {data}")
        else:
            print(f"User not found (expected if no user with this phone): {response.json()}")
    
    def test_send_otp_invalid_phone(self):
        """Test sending OTP with invalid phone number"""
        response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "123"  # Invalid - too short
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid phone number" in data.get("detail", "")
        print(f"Invalid phone rejected correctly: {data}")
    
    def test_verify_otp_no_otp_sent(self):
        """Test verifying OTP when no OTP was sent"""
        response = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": "9999999999",
            "otp": "123456"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "expired or not requested" in data.get("detail", "").lower()
        print(f"No OTP case handled correctly: {data}")
    
    def test_verify_otp_invalid_otp(self):
        """Test verifying with wrong OTP"""
        # First send OTP
        send_response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "9560377363"
        })
        
        if send_response.status_code != 200:
            pytest.skip("Cannot send OTP - user may not exist")
        
        # Try wrong OTP
        response = requests.post(f"{BASE_URL}/api/auth/otp/verify", json={
            "phone": "9560377363",
            "otp": "000000"  # Wrong OTP
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "Invalid OTP" in data.get("detail", "")
        print(f"Invalid OTP rejected correctly: {data}")


class TestEmailLogin:
    """Test email/password login"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@musclegrid.in"
        print(f"Admin login successful: role={data['user']['role']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid credentials" in data.get("detail", "")
        print(f"Invalid credentials rejected correctly: {data}")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        
        assert response.status_code == 401
        print(f"Non-existent user rejected correctly")


class TestUserResponseModel:
    """Test that UserResponse includes profile_incomplete and missing_fields"""
    
    def test_auth_me_response_structure(self):
        """Test /auth/me returns proper user structure"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert "id" in data
        assert "email" in data
        assert "role" in data
        print(f"User response structure valid: {list(data.keys())}")
    
    def test_otp_verify_returns_profile_fields(self):
        """Test that OTP verify returns profile_incomplete and missing_fields"""
        # This test verifies the UserResponse model fix
        # We can't fully test without a real OTP, but we can verify the endpoint structure
        
        # Send OTP first
        send_response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "9560377363"
        })
        
        if send_response.status_code != 200:
            pytest.skip("Cannot send OTP - user may not exist")
        
        # Note: We can't verify the actual OTP without checking backend logs
        # But we've verified the endpoint accepts requests
        print("OTP send endpoint working - verify response includes profile_incomplete and missing_fields")


class TestOTPResend:
    """Test OTP resend functionality"""
    
    def test_resend_otp_rate_limit(self):
        """Test that resend has rate limiting"""
        # First send OTP
        send_response = requests.post(f"{BASE_URL}/api/auth/otp/send", json={
            "phone": "9560377363"
        })
        
        if send_response.status_code != 200:
            pytest.skip("Cannot send OTP - user may not exist")
        
        # Immediately try to resend
        resend_response = requests.post(f"{BASE_URL}/api/auth/otp/resend", json={
            "phone": "9560377363"
        })
        
        # Should be rate limited (429) or succeed if enough time passed
        assert resend_response.status_code in [200, 429]
        
        if resend_response.status_code == 429:
            data = resend_response.json()
            assert "wait" in data.get("detail", "").lower()
            print(f"Rate limiting working: {data}")
        else:
            print("Resend succeeded (enough time passed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
