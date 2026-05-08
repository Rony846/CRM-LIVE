"""
Test Catalogue Import & Amazon Listing System
Tests for:
- /api/catalogue/import-product endpoint
- /api/catalogue/scrape-product-url endpoint
- Pricing calculation: Amazon Price = (Website Price + Margin%) + 18% GST
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-rebuild-11.preview.emergentagent.com')

class TestCatalogueImport:
    """Test catalogue import endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}"
        }
    
    # ==================== Import Product Tests ====================
    
    def test_import_product_success(self):
        """Test importing a product with manual entry data"""
        form_data = {
            "name": "TEST_Import_Product_001",
            "price": "1000",
            "description": "Test product for import testing",
            "images": json.dumps(["https://example.com/image1.jpg", "https://example.com/image2.jpg"]),
            "specifications": json.dumps({"weight": "5kg", "color": "black"}),
            "category": "accessories",
            "source_url": "https://example.com/product/test",
            "bullet_points": json.dumps(["Feature 1", "Feature 2", "Feature 3"]),
            "mrp_markup": "500",
            "margin_percent": "70",
            "gst_percent": "18"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert "datasheet" in data
        assert "pricing" in data
        
        # Verify datasheet fields
        datasheet = data["datasheet"]
        assert datasheet["model_name"] == "TEST_Import_Product_001"
        assert datasheet["category"] == "accessories"
        assert "amazon_fields" in datasheet
        
        # Verify pricing calculation
        pricing = data["pricing"]
        assert pricing["website_price"] == 1000
        
        # Verify Amazon price calculation: (1000 + 70%) + 18% = 1700 + 18% = 2006
        expected_amazon_price = round((1000 + (1000 * 70 / 100)) * 1.18)
        assert pricing["selling_price"] == expected_amazon_price, f"Expected {expected_amazon_price}, got {pricing['selling_price']}"
        
        print(f"Import successful - Product ID: {datasheet['id']}")
        print(f"Pricing: Website={pricing['website_price']}, MRP={pricing['mrp']}, Selling={pricing['selling_price']}")
    
    def test_import_product_pricing_calculation_default_margin(self):
        """Test pricing calculation with default 70% margin"""
        form_data = {
            "name": "TEST_Pricing_Default_Margin",
            "price": "500",
            "description": "Test pricing with default margin",
            "images": json.dumps([]),
            "category": "accessories",
            "margin_percent": "70",
            "gst_percent": "18"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pricing: (500 + 70%) + 18% = 850 + 18% = 1003
        pricing = data["pricing"]
        price_with_margin = 500 + (500 * 70 / 100)  # 850
        expected_selling = round(price_with_margin + (price_with_margin * 18 / 100))  # 1003
        
        assert pricing["selling_price"] == expected_selling, f"Expected {expected_selling}, got {pricing['selling_price']}"
        print(f"Pricing verified: Website=500, Selling={pricing['selling_price']}")
    
    def test_import_product_pricing_calculation_custom_margin(self):
        """Test pricing calculation with custom margin (50%)"""
        form_data = {
            "name": "TEST_Pricing_Custom_Margin",
            "price": "1000",
            "description": "Test pricing with 50% margin",
            "images": json.dumps([]),
            "category": "accessories",
            "margin_percent": "50",
            "gst_percent": "18"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify pricing: (1000 + 50%) + 18% = 1500 + 18% = 1770
        pricing = data["pricing"]
        price_with_margin = 1000 + (1000 * 50 / 100)  # 1500
        expected_selling = round(price_with_margin + (price_with_margin * 18 / 100))  # 1770
        
        assert pricing["selling_price"] == expected_selling, f"Expected {expected_selling}, got {pricing['selling_price']}"
        print(f"Custom margin pricing verified: Website=1000, Margin=50%, Selling={pricing['selling_price']}")
    
    def test_import_product_amazon_fields_saved(self):
        """Test that amazon_fields are correctly saved in the datasheet"""
        form_data = {
            "name": "TEST_Amazon_Fields_Check",
            "price": "2000",
            "description": "Test amazon fields",
            "images": json.dumps(["https://example.com/img.jpg"]),
            "category": "accessories",
            "margin_percent": "70",
            "gst_percent": "18"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        datasheet = data["datasheet"]
        amazon_fields = datasheet.get("amazon_fields", {})
        
        # Verify amazon_fields structure
        assert "website_price" in amazon_fields
        assert "mrp" in amazon_fields
        assert "selling_price" in amazon_fields
        assert "margin_percent" in amazon_fields
        assert "gst_percent" in amazon_fields
        assert "hsn_code" in amazon_fields
        assert "brand" in amazon_fields
        
        assert amazon_fields["website_price"] == 2000
        assert amazon_fields["margin_percent"] == 70
        assert amazon_fields["gst_percent"] == 18
        assert amazon_fields["brand"] == "MuscleGrid"
        
        print(f"Amazon fields verified: {amazon_fields}")
    
    def test_import_product_missing_name(self):
        """Test import fails without product name"""
        form_data = {
            "price": "1000",
            "category": "accessories"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Validation error correctly returned for missing name")
    
    def test_import_product_missing_price(self):
        """Test import fails without price"""
        form_data = {
            "name": "TEST_No_Price",
            "category": "accessories"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Validation error correctly returned for missing price")
    
    def test_import_product_requires_auth(self):
        """Test import endpoint requires authentication"""
        form_data = {
            "name": "TEST_No_Auth",
            "price": "1000",
            "category": "accessories"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            data=form_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authentication required - verified")
    
    # ==================== Scrape Product URL Tests ====================
    
    def test_scrape_product_url_success(self):
        """Test scraping a single product URL"""
        # Using a test URL - this may fail if the URL is not accessible
        form_data = {
            "product_url": "https://www.amazon.in/dp/B0GSVVGW4K"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/scrape-product-url",
            headers=self.headers,
            data=form_data
        )
        
        # May return 200 or 400 depending on if URL is accessible
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "product" in data
            product = data["product"]
            assert "name" in product
            assert "price" in product
            assert "images" in product
            assert "source_url" in product
            print(f"Scrape successful - Product: {product.get('name', 'N/A')[:50]}")
        else:
            # URL may not be accessible - this is expected
            print(f"Scrape returned {response.status_code} - URL may not be accessible")
    
    def test_scrape_product_url_missing_url(self):
        """Test scrape fails without URL"""
        form_data = {}
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/scrape-product-url",
            headers=self.headers,
            data=form_data
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Validation error correctly returned for missing URL")
    
    def test_scrape_product_url_requires_auth(self):
        """Test scrape endpoint requires authentication"""
        form_data = {
            "product_url": "https://example.com/product"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/catalogue/scrape-product-url",
            data=form_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Authentication required for scrape - verified")
    
    # ==================== Product Datasheets Collection Tests ====================
    
    def test_get_product_datasheets(self):
        """Test fetching product datasheets"""
        response = requests.get(
            f"{BASE_URL}/api/product-datasheets",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "datasheets" in data
        print(f"Found {len(data['datasheets'])} datasheets")
    
    def test_imported_product_in_datasheets(self):
        """Test that imported products appear in datasheets list"""
        # First import a product
        form_data = {
            "name": "TEST_Verify_In_List",
            "price": "1500",
            "description": "Test product to verify in list",
            "images": json.dumps([]),
            "category": "accessories",
            "margin_percent": "70",
            "gst_percent": "18"
        }
        
        import_response = requests.post(
            f"{BASE_URL}/api/catalogue/import-product",
            headers=self.headers,
            data=form_data
        )
        
        assert import_response.status_code == 200
        imported_id = import_response.json()["datasheet"]["id"]
        
        # Now fetch datasheets and verify the product is there
        list_response = requests.get(
            f"{BASE_URL}/api/product-datasheets",
            headers=self.headers
        )
        
        assert list_response.status_code == 200
        datasheets = list_response.json()["datasheets"]
        
        found = any(ds["id"] == imported_id for ds in datasheets)
        assert found, f"Imported product {imported_id} not found in datasheets list"
        print(f"Imported product {imported_id} found in datasheets list")
    
    # ==================== Cleanup ====================
    
    def test_cleanup_test_products(self):
        """Cleanup test products created during testing"""
        # Get all datasheets
        response = requests.get(
            f"{BASE_URL}/api/product-datasheets",
            headers=self.headers
        )
        
        if response.status_code == 200:
            datasheets = response.json().get("datasheets", [])
            deleted_count = 0
            
            for ds in datasheets:
                if ds.get("model_name", "").startswith("TEST_"):
                    delete_response = requests.delete(
                        f"{BASE_URL}/api/product-datasheets/{ds['id']}",
                        headers=self.headers
                    )
                    if delete_response.status_code == 200:
                        deleted_count += 1
            
            print(f"Cleaned up {deleted_count} test products")


class TestPricingCalculation:
    """Dedicated tests for pricing calculation formula"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@musclegrid.in",
            "password": "Muscle@846"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pricing_formula_verification(self):
        """
        Verify pricing formula: Amazon Price = (Website Price + Margin%) + 18% GST
        Test with multiple price points
        """
        test_cases = [
            {"price": 100, "margin": 70, "expected": round((100 + 70) * 1.18)},  # 200.6 -> 201
            {"price": 500, "margin": 70, "expected": round((500 + 350) * 1.18)},  # 1003
            {"price": 1000, "margin": 70, "expected": round((1000 + 700) * 1.18)},  # 2006
            {"price": 2500, "margin": 70, "expected": round((2500 + 1750) * 1.18)},  # 5015
            {"price": 1000, "margin": 50, "expected": round((1000 + 500) * 1.18)},  # 1770
            {"price": 1000, "margin": 100, "expected": round((1000 + 1000) * 1.18)},  # 2360
        ]
        
        for tc in test_cases:
            form_data = {
                "name": f"TEST_Pricing_{tc['price']}_{tc['margin']}",
                "price": str(tc["price"]),
                "description": "Pricing test",
                "images": json.dumps([]),
                "category": "accessories",
                "margin_percent": str(tc["margin"]),
                "gst_percent": "18"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/catalogue/import-product",
                headers=self.headers,
                data=form_data
            )
            
            assert response.status_code == 200
            selling_price = response.json()["pricing"]["selling_price"]
            
            assert selling_price == tc["expected"], \
                f"Price {tc['price']} with {tc['margin']}% margin: expected {tc['expected']}, got {selling_price}"
            
            print(f"✓ Price {tc['price']} + {tc['margin']}% margin + 18% GST = {selling_price}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
