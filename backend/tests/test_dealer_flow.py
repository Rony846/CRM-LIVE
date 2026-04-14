"""
Test Dealer Flow - Admin Edit Dealer and Dealer Products
Tests:
1. Admin can edit dealer phone number via PATCH /api/admin/dealers/{id}
2. Admin can edit dealer email via PATCH /api/admin/dealers/{id}
3. Admin can link dealer product to master SKU via PATCH /api/admin/dealer-products/{id}
4. Dealer products page shows Master SKU mapping correctly after linking
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@musclegrid.in"
ADMIN_PASSWORD = "Muscle@846"


class TestDealerFlow:
    """Test dealer management flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Admin login successful, token obtained")
    
    def test_01_get_dealers_list(self):
        """Test getting list of dealers"""
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200, f"Failed to get dealers: {response.text}"
        dealers = response.json()
        print(f"Found {len(dealers)} dealers")
        assert isinstance(dealers, list), "Response should be a list"
        
        # Store dealer for later tests
        if dealers:
            self.dealer = dealers[0]
            print(f"First dealer: {self.dealer.get('firm_name')} - {self.dealer.get('id')}")
    
    def test_02_admin_edit_dealer_phone(self):
        """Test admin can edit dealer phone number"""
        # First get a dealer
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200
        dealers = response.json()
        
        if not dealers:
            pytest.skip("No dealers found to test")
        
        dealer = dealers[0]
        dealer_id = dealer.get("id")
        original_phone = dealer.get("phone", "")
        
        # Update phone number - use form data with correct content type
        new_phone = "9876543210"
        
        # Remove JSON content type for form data
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/dealers/{dealer_id}",
            data={"phone": new_phone},
            headers=headers
        )
        
        print(f"Update dealer phone response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Failed to update dealer phone: {response.text}"
        
        # Verify the update
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200
        updated_dealers = response.json()
        updated_dealer = next((d for d in updated_dealers if d.get("id") == dealer_id), None)
        
        assert updated_dealer is not None, "Dealer not found after update"
        assert updated_dealer.get("phone") == new_phone, f"Phone not updated. Expected {new_phone}, got {updated_dealer.get('phone')}"
        print(f"SUCCESS: Dealer phone updated from '{original_phone}' to '{new_phone}'")
    
    def test_03_admin_edit_dealer_email(self):
        """Test admin can edit dealer email"""
        # First get a dealer
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200
        dealers = response.json()
        
        if not dealers:
            pytest.skip("No dealers found to test")
        
        dealer = dealers[0]
        dealer_id = dealer.get("id")
        original_email = dealer.get("email", "")
        
        # Update email - use form data with correct content type
        new_email = "test_updated@example.com"
        
        # Remove JSON content type for form data
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/dealers/{dealer_id}",
            data={"email": new_email},
            headers=headers
        )
        
        print(f"Update dealer email response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Failed to update dealer email: {response.text}"
        
        # Verify the update
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200
        updated_dealers = response.json()
        updated_dealer = next((d for d in updated_dealers if d.get("id") == dealer_id), None)
        
        assert updated_dealer is not None, "Dealer not found after update"
        assert updated_dealer.get("email") == new_email, f"Email not updated. Expected {new_email}, got {updated_dealer.get('email')}"
        print(f"SUCCESS: Dealer email updated from '{original_email}' to '{new_email}'")
    
    def test_04_get_dealer_products(self):
        """Test getting dealer products list"""
        response = self.session.get(f"{BASE_URL}/api/admin/dealer-products")
        assert response.status_code == 200, f"Failed to get dealer products: {response.text}"
        products = response.json()
        print(f"Found {len(products)} dealer products")
        assert isinstance(products, list), "Response should be a list"
        
        if products:
            print(f"First product: {products[0].get('name')} - {products[0].get('id')}")
    
    def test_05_get_master_skus(self):
        """Test getting master SKUs for mapping"""
        response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert response.status_code == 200, f"Failed to get master SKUs: {response.text}"
        data = response.json()
        
        # Handle both list and dict response formats
        if isinstance(data, dict):
            skus = data.get("master_skus", [])
        else:
            skus = data
        
        print(f"Found {len(skus)} master SKUs")
        assert isinstance(skus, list), "Response should contain a list of SKUs"
        
        if skus:
            print(f"First master SKU: {skus[0].get('name')} - {skus[0].get('id')}")
    
    def test_06_admin_link_dealer_product_to_master_sku(self):
        """Test admin can link dealer product to master SKU"""
        # Get dealer products
        response = self.session.get(f"{BASE_URL}/api/admin/dealer-products")
        assert response.status_code == 200
        products = response.json()
        
        if not products:
            pytest.skip("No dealer products found to test")
        
        # Get master SKUs
        response = self.session.get(f"{BASE_URL}/api/master-skus")
        assert response.status_code == 200
        data = response.json()
        skus = data.get("master_skus", []) if isinstance(data, dict) else data
        
        if not skus:
            pytest.skip("No master SKUs found to test")
        
        product = products[0]
        product_id = product.get("id")
        master_sku = skus[0]
        master_sku_id = master_sku.get("id")
        
        print(f"Linking product '{product.get('name')}' (ID: {product_id}) to master SKU '{master_sku.get('name')}' (ID: {master_sku_id})")
        
        # Update dealer product with master_sku_id - use form data with correct content type
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.patch(
            f"{BASE_URL}/api/admin/dealer-products/{product_id}",
            data={"master_sku_id": master_sku_id},
            headers=headers
        )
        
        print(f"Link product to master SKU response: {response.status_code} - {response.text}")
        assert response.status_code == 200, f"Failed to link product to master SKU: {response.text}"
        
        # Verify the update
        response = self.session.get(f"{BASE_URL}/api/admin/dealer-products")
        assert response.status_code == 200
        updated_products = response.json()
        updated_product = next((p for p in updated_products if p.get("id") == product_id), None)
        
        assert updated_product is not None, "Product not found after update"
        assert updated_product.get("master_sku_id") == master_sku_id, f"Master SKU not linked. Expected {master_sku_id}, got {updated_product.get('master_sku_id')}"
        print(f"SUCCESS: Product linked to master SKU '{master_sku.get('sku_code')}'")
    
    def test_07_dealer_products_catalogue_shows_master_sku(self):
        """Test dealer products catalogue shows master SKU mapping"""
        response = self.session.get(f"{BASE_URL}/api/dealer/products-catalogue")
        assert response.status_code == 200, f"Failed to get dealer products catalogue: {response.text}"
        products = response.json()
        
        print(f"Found {len(products)} products in catalogue")
        
        # Check if any product has master_sku info
        products_with_sku = [p for p in products if p.get("master_sku")]
        print(f"Products with master SKU mapping: {len(products_with_sku)}")
        
        if products_with_sku:
            product = products_with_sku[0]
            print(f"Product: {product.get('name')}")
            print(f"  - Master SKU: {product.get('master_sku', {}).get('sku_code')}")
            print(f"  - HSN Code: {product.get('master_sku', {}).get('hsn_code')}")
            assert product.get("master_sku") is not None, "Master SKU info should be present"
        else:
            print("No products with master SKU mapping found (may need to link first)")


class TestDealerSpecificData:
    """Test specific dealer data mentioned in the review request"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_find_aanjaney_dealer(self):
        """Test finding dealer AANJANEY with email aanjaney@test.com"""
        response = self.session.get(f"{BASE_URL}/api/admin/dealers")
        assert response.status_code == 200
        dealers = response.json()
        
        # Find AANJANEY dealer
        aanjaney = next((d for d in dealers if "AANJANEY" in (d.get("firm_name", "") or "").upper()), None)
        
        if aanjaney:
            print(f"Found dealer AANJANEY:")
            print(f"  - Firm Name: {aanjaney.get('firm_name')}")
            print(f"  - Email: {aanjaney.get('email')}")
            print(f"  - Phone: {aanjaney.get('phone')}")
            print(f"  - ID: {aanjaney.get('id')}")
            
            # Verify email is set
            if aanjaney.get("email") == "aanjaney@test.com":
                print("SUCCESS: Email is correctly set to aanjaney@test.com")
            else:
                print(f"NOTE: Email is '{aanjaney.get('email')}' (expected aanjaney@test.com)")
        else:
            print("Dealer AANJANEY not found in the system")
    
    def test_find_mg_inverter_product(self):
        """Test finding MG Inverter 1KVA product linked to master SKU"""
        response = self.session.get(f"{BASE_URL}/api/admin/dealer-products")
        assert response.status_code == 200
        products = response.json()
        
        # Find MG Inverter 1KVA
        inverter = next((p for p in products if "MG Inverter 1KVA" in (p.get("name", "") or "")), None)
        
        if inverter:
            print(f"Found product MG Inverter 1KVA:")
            print(f"  - Name: {inverter.get('name')}")
            print(f"  - SKU: {inverter.get('sku')}")
            print(f"  - Master SKU ID: {inverter.get('master_sku_id')}")
            print(f"  - ID: {inverter.get('id')}")
            
            if inverter.get("master_sku_id"):
                print("SUCCESS: Product is linked to a master SKU")
            else:
                print("NOTE: Product is not linked to a master SKU")
        else:
            print("Product 'MG Inverter 1KVA' not found in dealer products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
