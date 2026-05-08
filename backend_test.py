#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import tempfile
import os

class MuscleGridCRMTester:
    def __init__(self, base_url="https://crm-rebuild-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.test_users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Predefined test credentials
        self.credentials = {
            "admin": {"email": "admin@musclegrid.in", "password": "admin123"},
            "customer": {"email": "customer@example.com", "password": "customer123"},
            "call_support": {"email": "support@musclegrid.in", "password": "support123"},
            "dispatcher": {"email": "dispatcher@musclegrid.in", "password": "dispatch123"},
            "accountant": {"email": "accountant@musclegrid.in", "password": "accountant123"}
        }

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name}")
        if details:
            print(f"    {details}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")

    def make_request(self, method, endpoint, data=None, headers=None, files=None):
        """Make HTTP request with error handling"""
        url = f"{self.api_base}/{endpoint}"
        req_headers = headers or {}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=req_headers, timeout=10)
                else:
                    req_headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PATCH':
                if files:
                    response = requests.patch(url, data=data, files=files, headers=req_headers, timeout=10)
                else:
                    req_headers['Content-Type'] = 'application/json'
                    response = requests.patch(url, json=data, headers=req_headers, timeout=10)
            else:
                return None, f"Unsupported method: {method}"
            
            return response, None
        except requests.exceptions.RequestException as e:
            return None, f"Request failed: {str(e)}"

    def test_user_registration(self):
        """Test user registration for different roles"""
        print("\n=== Testing User Registration ===")
        
        roles = ["customer", "call_support", "service_agent", "accountant", "dispatcher"]
        
        for role in roles:
            timestamp = datetime.now().strftime('%H%M%S')
            user_data = {
                "email": f"test_{role}_{timestamp}@test.com",
                "password": "TestPass123!",
                "first_name": f"Test{role.title()}",
                "last_name": "User",
                "phone": f"9876543{timestamp[-3:]}",
                "role": role
            }
            
            response, error = self.make_request('POST', 'auth/register', user_data)
            
            if error:
                self.log_test(f"Register {role}", False, error)
                continue
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.tokens[role] = data['access_token']
                    self.test_users[role] = data['user']
                    self.log_test(f"Register {role}", True, f"Token received, user ID: {data['user']['id']}")
                else:
                    self.log_test(f"Register {role}", False, "Missing token or user data")
            else:
                self.log_test(f"Register {role}", False, f"Status {response.status_code}: {response.text}")

    def test_user_login(self):
        """Test login with predefined credentials"""
        print("\n=== Testing User Login ===")
        
        for role, creds in self.credentials.items():
            response, error = self.make_request('POST', 'auth/login', creds)
            
            if error:
                self.log_test(f"Login {role}", False, error)
                continue
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data:
                    self.tokens[role] = data['access_token']
                    self.test_users[role] = data['user']
                    self.log_test(f"Login {role}", True, f"Role: {data['user']['role']}")
                else:
                    self.log_test(f"Login {role}", False, "No access token in response")
            else:
                self.log_test(f"Login {role}", False, f"Status {response.status_code}: {response.text}")

    def test_auth_me(self):
        """Test /auth/me endpoint for all roles"""
        print("\n=== Testing Auth Me Endpoint ===")
        
        for role, token in self.tokens.items():
            headers = {"Authorization": f"Bearer {token}"}
            response, error = self.make_request('GET', 'auth/me', headers=headers)
            
            if error:
                self.log_test(f"Auth me - {role}", False, error)
                continue
            
            if response.status_code == 200:
                data = response.json()
                if data.get('role') == role or (role in self.credentials and data.get('role') in ['admin', 'customer', 'call_support', 'dispatcher', 'accountant']):
                    self.log_test(f"Auth me - {role}", True, f"User: {data['first_name']} {data['last_name']}")
                else:
                    self.log_test(f"Auth me - {role}", False, f"Role mismatch: expected {role}, got {data.get('role')}")
            else:
                self.log_test(f"Auth me - {role}", False, f"Status {response.status_code}")

    def test_tickets_crud(self):
        """Test ticket CRUD operations"""
        print("\n=== Testing Tickets CRUD ===")
        
        # Test creating ticket as customer
        customer_token = self.tokens.get('customer')
        if not customer_token:
            self.log_test("Ticket Create (Customer)", False, "No customer token available")
            return
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Create ticket
        ticket_data = {
            "device_type": "Inverter",
            "order_id": "ORD123456",
            "issue_description": "Device not turning on after power outage"
        }
        
        response, error = self.make_request('POST', 'tickets', ticket_data, headers)
        
        if error:
            self.log_test("Create Ticket", False, error)
            return
        
        if response.status_code == 200:
            ticket = response.json()
            ticket_id = ticket.get('id')
            self.log_test("Create Ticket", True, f"Ticket {ticket['ticket_number']} created")
            
            # Test get tickets
            response, error = self.make_request('GET', 'tickets', headers=headers)
            if response and response.status_code == 200:
                tickets = response.json()
                self.log_test("Get Tickets", True, f"Retrieved {len(tickets)} tickets")
            else:
                self.log_test("Get Tickets", False, f"Status {response.status_code if response else 'No response'}")
            
            # Test get single ticket
            if ticket_id:
                response, error = self.make_request('GET', f'tickets/{ticket_id}', headers=headers)
                if response and response.status_code == 200:
                    self.log_test("Get Single Ticket", True, "Ticket retrieved successfully")
                else:
                    self.log_test("Get Single Ticket", False, f"Status {response.status_code if response else 'No response'}")
                    
                # Test update ticket (requires call_support or admin role)
                admin_token = self.tokens.get('admin')
                if admin_token:
                    admin_headers = {"Authorization": f"Bearer {admin_token}"}
                    update_data = {
                        "status": "in_progress",
                        "diagnosis": "Initial diagnosis completed"
                    }
                    
                    response, error = self.make_request('PATCH', f'tickets/{ticket_id}', update_data, admin_headers)
                    if response and response.status_code == 200:
                        self.log_test("Update Ticket", True, "Ticket updated successfully")
                    else:
                        self.log_test("Update Ticket", False, f"Status {response.status_code if response else 'No response'}")
                        
        else:
            self.log_test("Create Ticket", False, f"Status {response.status_code}: {response.text}")

    def test_warranty_registration(self):
        """Test warranty registration and approval"""
        print("\n=== Testing Warranty Registration ===")
        
        customer_token = self.tokens.get('customer')
        if not customer_token:
            self.log_test("Warranty Registration", False, "No customer token available")
            return
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Create a test PDF file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(b'%PDF-1.4\nTest invoice content\n%%EOF')
            tmp_file.flush()
            
            warranty_data = {
                "first_name": "John",
                "last_name": "Doe", 
                "phone": "9876543210",
                "email": "john.doe@test.com",
                "device_type": "Battery",
                "invoice_date": "2024-01-15",
                "invoice_amount": 15000.0,
                "order_id": "ORD789012"
            }
            
            files = {"invoice_file": open(tmp_file.name, 'rb')}
            
            response, error = self.make_request('POST', 'warranties', warranty_data, headers, files)
            files["invoice_file"].close()
            os.unlink(tmp_file.name)
            
            if error:
                self.log_test("Create Warranty", False, error)
                return
            
            if response.status_code == 200:
                warranty_data = response.json()
                warranty_id = warranty_data.get('warranty_id')
                self.log_test("Create Warranty", True, f"Warranty ID: {warranty_id}")
                
                # Test get warranties
                response, error = self.make_request('GET', 'warranties', headers=headers)
                if response and response.status_code == 200:
                    warranties = response.json()
                    self.log_test("Get Warranties", True, f"Retrieved {len(warranties)} warranties")
                    
                    # Test warranty approval (admin only)
                    admin_token = self.tokens.get('admin')
                    if admin_token and warranty_id:
                        admin_headers = {"Authorization": f"Bearer {admin_token}"}
                        approval_data = {
                            "warranty_end_date": "2026-01-15",
                            "notes": "Approved after verification"
                        }
                        
                        response, error = self.make_request('PATCH', f'warranties/{warranty_id}/approve', approval_data, admin_headers)
                        if response and response.status_code == 200:
                            self.log_test("Approve Warranty", True, "Warranty approved successfully")
                        else:
                            self.log_test("Approve Warranty", False, f"Status {response.status_code if response else 'No response'}")
                            
                else:
                    self.log_test("Get Warranties", False, f"Status {response.status_code if response else 'No response'}")
            else:
                self.log_test("Create Warranty", False, f"Status {response.status_code}: {response.text}")

    def test_dispatch_operations(self):
        """Test dispatch operations"""
        print("\n=== Testing Dispatch Operations ===")
        
        accountant_token = self.tokens.get('accountant')
        if not accountant_token:
            self.log_test("Dispatch Operations", False, "No accountant token available")
            return
        
        headers = {"Authorization": f"Bearer {accountant_token}"}
        
        # Create outbound dispatch
        dispatch_data = {
            "sku": "INV-2000W",
            "customer_name": "Test Customer",
            "phone": "9876543210",
            "address": "123 Test Street, Test City",
            "reason": "Replacement unit",
            "note": "Handle with care"
        }
        
        response, error = self.make_request('POST', 'dispatches/outbound', dispatch_data, headers)
        
        if error:
            self.log_test("Create Outbound Dispatch", False, error)
            return
        
        if response.status_code == 200:
            dispatch_result = response.json()
            dispatch_id = dispatch_result.get('dispatch_id')
            self.log_test("Create Outbound Dispatch", True, f"Dispatch ID: {dispatch_id}")
            
            # Test get dispatches
            response, error = self.make_request('GET', 'dispatches', headers=headers)
            if response and response.status_code == 200:
                dispatches = response.json()
                self.log_test("Get Dispatches", True, f"Retrieved {len(dispatches)} dispatches")
            else:
                self.log_test("Get Dispatches", False, f"Status {response.status_code if response else 'No response'}")
                
        else:
            self.log_test("Create Outbound Dispatch", False, f"Status {response.status_code}: {response.text}")

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        print("\n=== Testing Admin Endpoints ===")
        
        admin_token = self.tokens.get('admin')
        if not admin_token:
            self.log_test("Admin Endpoints", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test admin stats
        response, error = self.make_request('GET', 'admin/stats', headers=headers)
        if response and response.status_code == 200:
            stats = response.json()
            self.log_test("Admin Stats", True, f"Stats retrieved: {list(stats.keys())}")
        else:
            self.log_test("Admin Stats", False, f"Status {response.status_code if response else 'No response'}")
        
        # Test get customers
        response, error = self.make_request('GET', 'admin/customers', headers=headers)
        if response and response.status_code == 200:
            customers = response.json()
            self.log_test("Get Customers", True, f"Retrieved {len(customers)} customers")
        else:
            self.log_test("Get Customers", False, f"Status {response.status_code if response else 'No response'}")
        
        # Test get users
        response, error = self.make_request('GET', 'admin/users', headers=headers)
        if response and response.status_code == 200:
            users = response.json()
            self.log_test("Get Users", True, f"Retrieved {len(users)} users")
        else:
            self.log_test("Get Users", False, f"Status {response.status_code if response else 'No response'}")

    def test_role_based_access(self):
        """Test role-based access control"""
        print("\n=== Testing Role-Based Access Control ===")
        
        customer_token = self.tokens.get('customer')
        if not customer_token:
            self.log_test("Role Access Control", False, "No customer token available")
            return
        
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Customer should NOT access admin stats
        response, error = self.make_request('GET', 'admin/stats', headers=headers)
        if response and response.status_code == 403:
            self.log_test("Customer blocked from admin", True, "Access properly denied")
        else:
            self.log_test("Customer blocked from admin", False, f"Expected 403, got {response.status_code if response else 'No response'}")

    def test_stats_endpoints(self):
        """Test stats endpoints for different roles"""
        print("\n=== Testing Stats Endpoints ===")
        
        for role, token in self.tokens.items():
            if not token:
                continue
            
            headers = {"Authorization": f"Bearer {token}"}
            response, error = self.make_request('GET', 'stats', headers=headers)
            
            if response and response.status_code == 200:
                stats = response.json()
                self.log_test(f"Stats for {role}", True, f"Keys: {list(stats.keys())}")
            else:
                self.log_test(f"Stats for {role}", False, f"Status {response.status_code if response else 'No response'}")

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting MuscleGrid CRM Backend Testing")
        print(f"📡 API Base: {self.api_base}")
        print("=" * 60)
        
        # Run tests in logical order
        self.test_user_login()
        self.test_user_registration() 
        self.test_auth_me()
        self.test_role_based_access()
        self.test_tickets_crud()
        self.test_warranty_registration()
        self.test_dispatch_operations()
        self.test_admin_endpoints()
        self.test_stats_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 BACKEND TEST SUMMARY")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}/{self.tests_run}")
        
        if self.failed_tests:
            print("\n🔴 FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80% success rate as acceptable

def main():
    tester = MuscleGridCRMTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())