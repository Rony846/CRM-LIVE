"""
Test Incoming Inventory Queue Feature
Tests for:
- GET /api/incoming-queue - List queue entries
- GET /api/incoming-queue/pending-count - Get pending count
- POST /api/incoming-queue - Manual queue entry creation
- POST /api/incoming-queue/{id}/classify - Classify entry with different types
- Gate scan creates queue entry instead of direct stock impact
- return_inventory classification creates return_in ledger entry
- repair_yard classification creates repair_yard_in ledger entry with mandatory reason
- Duplicate processing prevention
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"email": "admin@musclegrid.in", "password": "Muscle@846"}
ACCOUNTANT_CREDS = {"email": "accountant@musclegrid.in", "password": "Muscle@846"}
GATE_CREDS = {"email": "gate@musclegrid.in", "password": "Muscle@846"}

# Test data
FIRM_ID = "c715c1b7-aca3-4100-8b00-4f711a729829"  # MuscleGrid Pvt Ltd
SKU_ID = "feb88b5c-4484-4f81-9e86-768335943785"   # MG-TEST-001


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def accountant_token():
    """Get accountant authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ACCOUNTANT_CREDS)
    assert response.status_code == 200, f"Accountant login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def gate_token():
    """Get gate user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=GATE_CREDS)
    assert response.status_code == 200, f"Gate login failed: {response.text}"
    return response.json()["access_token"]


class TestIncomingQueueEndpoints:
    """Test incoming queue API endpoints"""
    
    def test_get_incoming_queue_list(self, admin_token):
        """Test GET /api/incoming-queue returns list"""
        response = requests.get(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_pending_count(self, admin_token):
        """Test GET /api/incoming-queue/pending-count"""
        response = requests.get(
            f"{BASE_URL}/api/incoming-queue/pending-count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "pending_count" in data
        assert isinstance(data["pending_count"], int)
    
    def test_accountant_can_access_queue(self, accountant_token):
        """Test accountant role can access incoming queue"""
        response = requests.get(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200
    
    def test_accountant_can_get_pending_count(self, accountant_token):
        """Test accountant can get pending count"""
        response = requests.get(
            f"{BASE_URL}/api/incoming-queue/pending-count",
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        assert response.status_code == 200


class TestManualQueueEntry:
    """Test manual queue entry creation"""
    
    def test_create_manual_queue_entry(self, admin_token):
        """Test POST /api/incoming-queue creates manual entry"""
        tracking_id = f"TEST-MANUAL-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "tracking_id": tracking_id,
                "courier": "BlueDart",
                "notes": "Test manual entry",
                "source": "manual_entry"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "queue_number" in data
        assert data["tracking_id"] == tracking_id
        assert data["status"] == "pending"
        assert data["source"] == "manual_entry"
        assert data["queue_number"].startswith("MG-IQ-")
    
    def test_accountant_can_create_entry(self, accountant_token):
        """Test accountant can create manual queue entry"""
        tracking_id = f"TEST-ACCT-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {accountant_token}"},
            json={
                "tracking_id": tracking_id,
                "courier": "DTDC",
                "source": "manual_entry"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"


class TestGateScanCreatesQueueEntry:
    """Test that gate scan creates queue entry instead of direct stock impact"""
    
    def test_gate_scan_inward_creates_queue_entry(self, gate_token, admin_token):
        """Test gate scan inward creates incoming queue entry"""
        tracking_id = f"GATE-TEST-{int(time.time())}"
        
        # Perform gate scan
        response = requests.post(
            f"{BASE_URL}/api/gate/scan",
            headers={"Authorization": f"Bearer {gate_token}"},
            json={
                "scan_type": "inward",
                "tracking_id": tracking_id,
                "courier": "FedEx",
                "notes": "Test gate scan"
            }
        )
        assert response.status_code == 200
        scan_data = response.json()
        assert scan_data["scan_type"] == "inward"
        
        # Verify queue entry was created
        response = requests.get(
            f"{BASE_URL}/api/incoming-queue?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        queue_entries = response.json()
        
        # Find our entry
        matching = [e for e in queue_entries if e.get("tracking_id") == tracking_id]
        assert len(matching) == 1, f"Expected 1 queue entry for tracking {tracking_id}"
        
        entry = matching[0]
        assert entry["source"] == "gate_scan"
        assert entry["status"] == "pending"


class TestClassificationTypes:
    """Test different classification types"""
    
    def test_return_inventory_classification(self, admin_token):
        """Test return_inventory creates return_in ledger entry and increases stock"""
        # Get initial stock
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        initial_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        
        # Create queue entry
        tracking_id = f"TEST-RETURN-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        assert response.status_code == 200
        queue_id = response.json()["id"]
        
        # Classify as return_inventory
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "return_inventory",
                "firm_id": FIRM_ID,
                "item_type": "finished_good",
                "item_id": SKU_ID,
                "quantity": 1,
                "remarks": "Test return"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify classification
        assert data["status"] == "processed"
        assert data["classification_type"] == "return_inventory"
        assert data["ledger_entry_number"] is not None
        assert data["ledger_entry_number"].startswith("MG-L-")
        
        # Verify stock increased
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        new_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        assert new_stock == initial_stock + 1, f"Stock should increase by 1: {initial_stock} -> {new_stock}"
    
    def test_repair_yard_requires_mandatory_reason(self, admin_token):
        """Test repair_yard classification requires mandatory reason"""
        # Create queue entry
        tracking_id = f"TEST-REPYARD-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        # Try to classify WITHOUT reason - should fail
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "repair_yard",
                "firm_id": FIRM_ID,
                "item_type": "finished_good",
                "item_id": SKU_ID,
                "quantity": 1
            }
        )
        assert response.status_code == 400
        assert "reason is MANDATORY" in response.json()["detail"]
    
    def test_repair_yard_with_reason_succeeds(self, admin_token):
        """Test repair_yard classification with reason creates repair_yard_in ledger entry"""
        # Get initial stock
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        initial_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        
        # Create queue entry
        tracking_id = f"TEST-REPYARD-OK-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        # Classify WITH reason
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "repair_yard",
                "firm_id": FIRM_ID,
                "item_type": "finished_good",
                "item_id": SKU_ID,
                "quantity": 1,
                "reason": "Recovered from repair - tested working",
                "reference_number": "RY-TEST-001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify classification
        assert data["status"] == "processed"
        assert data["classification_type"] == "repair_yard"
        assert data["reason"] == "Recovered from repair - tested working"
        assert data["ledger_entry_number"] is not None
        
        # Verify stock increased
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        new_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        assert new_stock == initial_stock + 1
    
    def test_scrap_classification_no_stock_impact(self, admin_token):
        """Test scrap classification has no stock impact"""
        # Get initial stock
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        initial_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        
        # Create queue entry
        tracking_id = f"TEST-SCRAP-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        # Classify as scrap
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "scrap",
                "scrap_reason": "Damaged beyond repair"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify classification
        assert data["status"] == "processed"
        assert data["classification_type"] == "scrap"
        assert data["scrap_reason"] == "Damaged beyond repair"
        assert data["ledger_entry_number"] is None  # No ledger entry for scrap
        
        # Verify stock unchanged
        response = requests.get(
            f"{BASE_URL}/api/admin/skus",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        skus = response.json()
        new_stock = next((s["stock_quantity"] for s in skus if s["id"] == SKU_ID), 0)
        assert new_stock == initial_stock, "Stock should not change for scrap"


class TestDuplicateProcessingPrevention:
    """Test duplicate processing is prevented"""
    
    def test_cannot_classify_already_processed_entry(self, admin_token):
        """Test that already processed entries cannot be classified again"""
        # Create and classify an entry
        tracking_id = f"TEST-DUP-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        # First classification
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "scrap",
                "scrap_reason": "Test scrap"
            }
        )
        assert response.status_code == 200
        
        # Try to classify again - should fail
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "scrap",
                "scrap_reason": "Another reason"
            }
        )
        assert response.status_code == 400
        assert "already been processed" in response.json()["detail"]


class TestLedgerEntryTypes:
    """Test that correct ledger entry types are created"""
    
    def test_return_in_ledger_entry_type(self, admin_token):
        """Test return_inventory creates return_in ledger entry"""
        # Create and classify
        tracking_id = f"TEST-LEDGER-RET-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "return_inventory",
                "firm_id": FIRM_ID,
                "item_type": "finished_good",
                "item_id": SKU_ID,
                "quantity": 1
            }
        )
        ledger_number = response.json()["ledger_entry_number"]
        
        # Verify ledger entry type
        response = requests.get(
            f"{BASE_URL}/api/inventory/ledger?firm_id={FIRM_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        ledger_entries = response.json()
        matching = [e for e in ledger_entries if e.get("entry_number") == ledger_number]
        assert len(matching) == 1
        assert matching[0]["entry_type"] == "return_in"
    
    def test_repair_yard_in_ledger_entry_type(self, admin_token):
        """Test repair_yard creates repair_yard_in ledger entry"""
        # Create and classify
        tracking_id = f"TEST-LEDGER-RY-{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tracking_id": tracking_id, "source": "manual_entry"}
        )
        queue_id = response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/incoming-queue/{queue_id}/classify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "classification_type": "repair_yard",
                "firm_id": FIRM_ID,
                "item_type": "finished_good",
                "item_id": SKU_ID,
                "quantity": 1,
                "reason": "Test repair yard entry"
            }
        )
        ledger_number = response.json()["ledger_entry_number"]
        
        # Verify ledger entry type
        response = requests.get(
            f"{BASE_URL}/api/inventory/ledger?firm_id={FIRM_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        ledger_entries = response.json()
        matching = [e for e in ledger_entries if e.get("entry_number") == ledger_number]
        assert len(matching) == 1
        assert matching[0]["entry_type"] == "repair_yard_in"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
