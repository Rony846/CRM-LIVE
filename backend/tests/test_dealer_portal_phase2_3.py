"""
Test Dealer Portal Phase 2 & 3 Features
- Dealer Catalogue API with live stock visibility
- Admin Announcements API
- Dealer Targets API with incentives
- Warranty Registration API
- Reorder Suggestions API
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"
DEALER_EMAIL = "testdealer@example.com"
DEALER_PASSWORD = "Dealer@123"


class TestAuth:
    """Authentication tests for admin and dealer"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_dealer_login(self):
        """Test dealer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DEALER_EMAIL,
            "password": DEALER_PASSWORD
        })
        assert response.status_code == 200, f"Dealer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "dealer"
        print(f"✓ Dealer login successful: {data['user']['email']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def dealer_token():
    """Get dealer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEALER_EMAIL,
        "password": DEALER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Dealer authentication failed")


class TestDealerCatalogue:
    """Test Dealer Catalogue API - GET /api/dealer/catalogue"""
    
    def test_dealer_catalogue_with_admin(self, admin_token):
        """Admin can access dealer catalogue (allows dealer and admin roles)"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/catalogue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "datasheets" in data
        assert isinstance(data["datasheets"], list)
        print(f"✓ Admin accessed catalogue: {len(data['datasheets'])} products")
        
        # Verify datasheet structure if products exist
        if data["datasheets"]:
            ds = data["datasheets"][0]
            assert "id" in ds
            assert "stock_available" in ds, "Missing live stock visibility"
            print(f"  - Sample product: {ds.get('model_name', 'N/A')}, Stock: {ds.get('stock_available', 0)}")
    
    def test_dealer_catalogue_with_dealer(self, dealer_token):
        """Dealer can access catalogue with live stock visibility"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/catalogue",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "datasheets" in data
        
        # Verify stock visibility fields
        if data["datasheets"]:
            ds = data["datasheets"][0]
            assert "stock_available" in ds, "Missing stock_available field"
            assert "public_url" in ds, "Missing public_url field"
            print(f"✓ Dealer accessed catalogue with stock visibility")
    
    def test_catalogue_unauthorized(self):
        """Catalogue requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dealer/catalogue")
        assert response.status_code == 401 or response.status_code == 403
        print("✓ Catalogue requires authentication")


class TestAdminAnnouncements:
    """Test Admin Announcements API - POST /api/admin/dealer-announcements"""
    
    def test_create_announcement(self, admin_token):
        """Admin can create dealer announcement"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/dealer-announcements",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "title": f"Test Announcement {unique_id}",
                "content": "This is a test announcement for dealer portal testing",
                "type": "general"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Announcement created"
        print(f"✓ Created announcement: {data['id']}")
        return data["id"]
    
    def test_create_announcement_with_all_fields(self, admin_token):
        """Admin can create announcement with all optional fields"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/admin/dealer-announcements",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "title": f"Promotion Announcement {unique_id}",
                "content": "Special discount on all batteries this month!",
                "type": "promotion",
                "action_url": "https://example.com/promo",
                "action_text": "View Promotion",
                "expires_at": "2026-12-31T23:59:59Z"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Created promotion announcement with all fields")
    
    def test_get_announcements_admin(self, admin_token):
        """Admin can get all announcements"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dealer-announcements",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin retrieved {len(data)} announcements")
    
    def test_dealer_cannot_create_announcement(self, dealer_token):
        """Dealer cannot create announcements (admin only)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/dealer-announcements",
            headers={"Authorization": f"Bearer {dealer_token}"},
            data={
                "title": "Unauthorized Announcement",
                "content": "This should fail",
                "type": "general"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Dealer cannot create announcements (correctly denied)")


class TestDealerAnnouncements:
    """Test Dealer Announcements API - GET /api/dealer/announcements"""
    
    def test_dealer_get_announcements(self, dealer_token):
        """Dealer can get announcements"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/announcements",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "announcements" in data
        assert isinstance(data["announcements"], list)
        
        # Verify announcement structure
        if data["announcements"]:
            ann = data["announcements"][0]
            assert "id" in ann
            assert "title" in ann
            assert "content" in ann
            assert "is_read" in ann, "Missing is_read field"
            print(f"✓ Dealer retrieved {len(data['announcements'])} announcements")
        else:
            print("✓ Dealer announcements endpoint works (no announcements yet)")
    
    def test_mark_announcement_read(self, dealer_token, admin_token):
        """Dealer can mark announcement as read"""
        # First create an announcement
        unique_id = str(uuid.uuid4())[:8]
        create_resp = requests.post(
            f"{BASE_URL}/api/admin/dealer-announcements",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "title": f"Read Test {unique_id}",
                "content": "Test content",
                "type": "general"
            }
        )
        if create_resp.status_code != 200:
            pytest.skip("Could not create test announcement")
        
        announcement_id = create_resp.json()["id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/dealer/announcements/{announcement_id}/read",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✓ Marked announcement as read")


class TestDealerTargets:
    """Test Dealer Targets API - GET /api/dealer/targets"""
    
    def test_dealer_get_targets(self, dealer_token):
        """Dealer can get sales targets"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/targets",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "current_target" in data, "Missing current_target"
        assert "quarterly_target" in data, "Missing quarterly_target"
        assert "yearly_target" in data, "Missing yearly_target"
        assert "incentives" in data, "Missing incentives"
        
        # Verify current target structure
        if data["current_target"]:
            ct = data["current_target"]
            assert "month" in ct
            assert "target_amount" in ct
            assert "achieved_amount" in ct
            assert "percentage" in ct
            assert "days_remaining" in ct
            print(f"✓ Current target: {ct['month']} - {ct['percentage']:.1f}% achieved")
        
        # Verify quarterly target
        if data["quarterly_target"]:
            qt = data["quarterly_target"]
            assert "quarter" in qt
            assert "target_amount" in qt
            print(f"✓ Quarterly target: {qt['quarter']}")
        
        # Verify yearly target
        if data["yearly_target"]:
            yt = data["yearly_target"]
            assert "year" in yt
            assert "months_remaining" in yt
            print(f"✓ Yearly target: {yt['year']}")
        
        # Verify incentives
        assert isinstance(data["incentives"], list)
        if data["incentives"]:
            inc = data["incentives"][0]
            assert "name" in inc
            assert "threshold" in inc
            assert "achieved" in inc
            print(f"✓ Incentives: {len(data['incentives'])} slabs defined")
    
    def test_targets_unauthorized(self):
        """Targets require dealer authentication"""
        response = requests.get(f"{BASE_URL}/api/dealer/targets")
        assert response.status_code in [401, 403]
        print("✓ Targets require authentication")


class TestWarrantyRegistration:
    """Test Warranty Registration API - POST /api/dealer/warranty-registrations"""
    
    def test_get_warranty_registrations(self, dealer_token):
        """Dealer can get warranty registrations"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/warranty-registrations",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "registrations" in data
        assert isinstance(data["registrations"], list)
        print(f"✓ Retrieved {len(data['registrations'])} warranty registrations")
    
    def test_create_warranty_registration(self, dealer_token):
        """Dealer can create warranty registration"""
        unique_serial = f"TEST-SN-{uuid.uuid4().hex[:8].upper()}"
        response = requests.post(
            f"{BASE_URL}/api/dealer/warranty-registrations",
            headers={"Authorization": f"Bearer {dealer_token}"},
            data={
                "product_id": "test-product-001",
                "serial_number": unique_serial,
                "customer_name": "Test Customer",
                "customer_phone": "9876543210",
                "purchase_date": "2026-01-15",
                "customer_email": "customer@test.com",
                "customer_address": "123 Test Street",
                "customer_city": "Delhi",
                "customer_state": "Delhi",
                "customer_pincode": "110001",
                "invoice_number": f"INV-{uuid.uuid4().hex[:6].upper()}"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Warranty registered successfully"
        print(f"✓ Created warranty registration: {data['id']}")
        
        # Verify it appears in list
        list_resp = requests.get(
            f"{BASE_URL}/api/dealer/warranty-registrations",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert list_resp.status_code == 200
        registrations = list_resp.json()["registrations"]
        found = any(r["serial_number"] == unique_serial for r in registrations)
        assert found, "Created warranty not found in list"
        print("✓ Warranty registration persisted and retrievable")
    
    def test_duplicate_serial_rejected(self, dealer_token):
        """Duplicate serial number should be rejected"""
        unique_serial = f"DUP-SN-{uuid.uuid4().hex[:8].upper()}"
        
        # First registration
        response1 = requests.post(
            f"{BASE_URL}/api/dealer/warranty-registrations",
            headers={"Authorization": f"Bearer {dealer_token}"},
            data={
                "product_id": "test-product-001",
                "serial_number": unique_serial,
                "customer_name": "Customer 1",
                "customer_phone": "9876543210",
                "purchase_date": "2026-01-15"
            }
        )
        assert response1.status_code == 200
        
        # Duplicate registration
        response2 = requests.post(
            f"{BASE_URL}/api/dealer/warranty-registrations",
            headers={"Authorization": f"Bearer {dealer_token}"},
            data={
                "product_id": "test-product-001",
                "serial_number": unique_serial,
                "customer_name": "Customer 2",
                "customer_phone": "9876543211",
                "purchase_date": "2026-01-16"
            }
        )
        assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
        assert "already registered" in response2.json().get("detail", "").lower()
        print("✓ Duplicate serial number correctly rejected")


class TestReorderSuggestions:
    """Test Reorder Suggestions API - GET /api/dealer/reorder-suggestions"""
    
    def test_get_reorder_suggestions(self, dealer_token):
        """Dealer can get reorder suggestions"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/reorder-suggestions",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "suggestions" in data
        assert "stats" in data
        assert isinstance(data["suggestions"], list)
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_suggestions" in stats
        assert "high_priority" in stats
        assert "unique_products_ordered" in stats
        assert "suggested_order_value" in stats
        
        print(f"✓ Reorder suggestions: {stats['total_suggestions']} suggestions")
        print(f"  - High priority: {stats['high_priority']}")
        print(f"  - Unique products ordered: {stats['unique_products_ordered']}")
        print(f"  - Suggested value: ₹{stats['suggested_order_value']}")
        
        # Verify suggestion structure if any exist
        if data["suggestions"]:
            sug = data["suggestions"][0]
            assert "product_name" in sug
            assert "sku" in sug
            assert "priority" in sug
            assert "suggested_quantity" in sug
            assert "suggested_value" in sug
            print(f"  - Sample: {sug['product_name']} ({sug['priority']} priority)")
    
    def test_suggestions_unauthorized(self):
        """Suggestions require dealer authentication"""
        response = requests.get(f"{BASE_URL}/api/dealer/reorder-suggestions")
        assert response.status_code in [401, 403]
        print("✓ Reorder suggestions require authentication")


class TestAdminCannotAccessDealerOnlyEndpoints:
    """Verify admin cannot access dealer-only endpoints"""
    
    def test_admin_cannot_access_dealer_announcements(self, admin_token):
        """Admin cannot access dealer announcements endpoint (dealer role only)"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/announcements",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # This endpoint requires dealer role specifically
        assert response.status_code in [401, 403, 404], f"Expected 401/403/404, got {response.status_code}"
        print("✓ Admin correctly denied access to dealer-only announcements endpoint")
    
    def test_admin_cannot_access_dealer_targets(self, admin_token):
        """Admin cannot access dealer targets endpoint (dealer role only)"""
        response = requests.get(
            f"{BASE_URL}/api/dealer/targets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [401, 403, 404], f"Expected 401/403/404, got {response.status_code}"
        print("✓ Admin correctly denied access to dealer targets endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
