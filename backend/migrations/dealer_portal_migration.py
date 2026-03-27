"""
MuscleGrid Dealer Portal Migration Script
=========================================
Migrates data from legacy MySQL dump to MongoDB

Usage:
  python dealer_portal_migration.py --dry-run        # Report only, no changes
  python dealer_portal_migration.py --execute        # Actual migration

Author: MuscleGrid CRM Team
Date: March 2026
"""

import re
import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
import argparse

# MongoDB
from pymongo import MongoClient
from bson import ObjectId
import bcrypt

# Load environment
from dotenv import load_dotenv
load_dotenv()


@dataclass
class MigrationReport:
    """Tracks migration statistics"""
    users_created: int = 0
    users_skipped: int = 0
    dealers_created: int = 0
    dealers_skipped: int = 0
    applications_created: int = 0
    orders_created: int = 0
    products_created: int = 0
    products_skipped: int = 0
    parties_created: int = 0
    
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    skipped_records: List[Dict] = field(default_factory=list)
    duplicate_emails: List[str] = field(default_factory=list)
    duplicate_phones: List[str] = field(default_factory=list)
    duplicate_gstins: List[str] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "summary": {
                "users_created": self.users_created,
                "users_skipped": self.users_skipped,
                "dealers_created": self.dealers_created,
                "dealers_skipped": self.dealers_skipped,
                "applications_created": self.applications_created,
                "orders_created": self.orders_created,
                "products_created": self.products_created,
                "products_skipped": self.products_skipped,
                "parties_created": self.parties_created,
            },
            "duplicates": {
                "emails": self.duplicate_emails,
                "phones": self.duplicate_phones,
                "gstins": self.duplicate_gstins,
            },
            "errors": self.errors,
            "warnings": self.warnings,
            "skipped_records": self.skipped_records,
        }


class SQLParser:
    """Parse MySQL dump file and extract INSERT data"""
    
    @staticmethod
    def parse_inserts(sql_content: str, table_name: str) -> List[Dict]:
        """Extract INSERT data for a specific table"""
        records = []
        
        # Find the INSERT statement for this table
        pattern = rf"INSERT INTO `{table_name}`\s*\(([^)]+)\)\s*VALUES\s*"
        match = re.search(pattern, sql_content, re.IGNORECASE)
        
        if not match:
            return records
        
        # Get column names
        columns = [col.strip().strip('`') for col in match.group(1).split(',')]
        
        # Find all value groups - simpler approach
        start_pos = match.end()
        
        # Find the end of VALUES (ends with semicolon followed by newline and --)
        values_section = sql_content[start_pos:]
        end_match = re.search(r';\s*\n\s*(?:--|$)', values_section)
        if end_match:
            values_section = values_section[:end_match.start()]
        
        # Parse tuples manually using character-by-character approach
        records = SQLParser._parse_value_tuples(values_section, columns)
        
        return records
    
    @staticmethod
    def _parse_value_tuples(values_str: str, columns: List[str]) -> List[Dict]:
        """Parse all value tuples from VALUES section"""
        records = []
        i = 0
        n = len(values_str)
        
        while i < n:
            # Find start of tuple
            if values_str[i] == '(':
                # Extract this tuple
                tuple_str, end_idx = SQLParser._extract_tuple(values_str, i)
                if tuple_str:
                    values = SQLParser._parse_tuple_values(tuple_str)
                    if len(values) == len(columns):
                        records.append(dict(zip(columns, values)))
                    i = end_idx
                else:
                    i += 1
            else:
                i += 1
        
        return records
    
    @staticmethod
    def _extract_tuple(s: str, start: int) -> Tuple[Optional[str], int]:
        """Extract a single tuple (value1, value2, ...) handling nested parens and quotes"""
        if s[start] != '(':
            return None, start
        
        i = start + 1
        n = len(s)
        depth = 1
        in_string = False
        escape_next = False
        
        while i < n and depth > 0:
            c = s[i]
            
            if escape_next:
                escape_next = False
                i += 1
                continue
            
            if c == '\\':
                escape_next = True
                i += 1
                continue
            
            if c == "'" and not in_string:
                in_string = True
            elif c == "'" and in_string:
                # Check for escaped quote ''
                if i + 1 < n and s[i + 1] == "'":
                    escape_next = True
                else:
                    in_string = False
            elif c == '(' and not in_string:
                depth += 1
            elif c == ')' and not in_string:
                depth -= 1
            
            i += 1
        
        if depth == 0:
            return s[start + 1:i - 1], i
        return None, start
    
    @staticmethod
    def _parse_tuple_values(tuple_str: str) -> List[Any]:
        """Parse comma-separated values from a tuple string"""
        values = []
        i = 0
        n = len(tuple_str)
        current = ""
        in_string = False
        escape_next = False
        has_value = False  # Track if we've seen any content for current value
        
        while i < n:
            c = tuple_str[i]
            
            if escape_next:
                current += c
                escape_next = False
                i += 1
                continue
            
            if c == '\\':
                escape_next = True
                current += c
                i += 1
                continue
            
            if c == "'" and not in_string:
                in_string = True
                has_value = True  # Empty string '' is still a value
                i += 1
                continue
            elif c == "'" and in_string:
                # Check for escaped quote ''
                if i + 1 < n and tuple_str[i + 1] == "'":
                    current += "'"
                    i += 2
                    continue
                else:
                    in_string = False
                    i += 1
                    continue
            
            if c == ',' and not in_string:
                val = current.strip()
                if has_value or val:
                    values.append(SQLParser._clean_value(val))
                else:
                    values.append(None)
                current = ""
                has_value = False
                i += 1
                continue
            
            if c not in ' \t\n':
                has_value = True
            current += c
            i += 1
        
        # Don't forget the last value
        val = current.strip()
        if has_value or val:
            values.append(SQLParser._clean_value(val))
        
        return values
    
    @staticmethod
    def _clean_value(value: str) -> Any:
        """Clean and convert a single value"""
        if value.upper() == 'NULL':
            return None
        # Remove remaining escape sequences
        value = value.replace("\\'", "'").replace("\\n", "\n").replace("\\r", "").replace("\\\\", "\\")
        try:
            if '.' in value:
                return float(value)
            return int(value)
        except (ValueError, TypeError):
            return value


class DealerMigration:
    """Main migration class"""
    
    def __init__(self, sql_file: str, dry_run: bool = True):
        self.sql_file = sql_file
        self.dry_run = dry_run
        self.report = MigrationReport()
        
        # Load SQL content
        with open(sql_file, 'r', encoding='utf-8') as f:
            self.sql_content = f.read()
        
        # Connect to MongoDB
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'musclegrid_crm')
        self.client = MongoClient(mongo_url)
        self.db = self.client[db_name]
        
        # ID mappings (legacy_id -> new_id)
        self.user_id_map: Dict[int, str] = {}
        self.dealer_id_map: Dict[int, str] = {}
        self.product_id_map: Dict[int, str] = {}
    
    def run(self) -> MigrationReport:
        """Execute full migration"""
        print(f"\n{'='*60}")
        print(f"MuscleGrid Dealer Portal Migration")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE EXECUTION'}")
        print(f"{'='*60}\n")
        
        # Step 1: Pre-check for duplicates
        print("Step 1: Checking for duplicates...")
        self._check_duplicates()
        
        # Step 2: Migrate products
        print("\nStep 2: Migrating products...")
        self._migrate_products()
        
        # Step 3: Migrate users
        print("\nStep 3: Migrating users...")
        self._migrate_users()
        
        # Step 4: Migrate dealers (with Party creation)
        print("\nStep 4: Migrating dealers...")
        self._migrate_dealers()
        
        # Step 5: Migrate dealer applications
        print("\nStep 5: Migrating dealer applications...")
        self._migrate_applications()
        
        # Step 6: Migrate orders (historical only)
        print("\nStep 6: Migrating orders (historical)...")
        self._migrate_orders()
        
        # Print summary
        self._print_summary()
        
        # Save report
        report_path = self._save_report()
        print(f"\nReport saved to: {report_path}")
        
        return self.report
    
    def _check_duplicates(self):
        """Pre-check for existing records that would cause duplicates"""
        legacy_users = SQLParser.parse_inserts(self.sql_content, 'users')
        legacy_dealers = SQLParser.parse_inserts(self.sql_content, 'dealers')
        
        # Check emails
        for user in legacy_users:
            if user.get('role') == 'admin':
                continue
            email = user.get('email', '').lower()
            if email and self.db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}):
                self.report.duplicate_emails.append(email)
        
        # Check phones and GSTINs
        for dealer in legacy_dealers:
            phone = str(dealer.get('phone', '') or '').replace(' ', '')
            gstin = str(dealer.get('gst_number', '') or '')
            
            if phone:
                # Check in users and parties
                if self.db.users.find_one({"phone": phone}):
                    self.report.duplicate_phones.append(phone)
                if self.db.parties.find_one({"phone": phone}):
                    self.report.duplicate_phones.append(f"{phone} (party)")
            
            if gstin:
                if self.db.parties.find_one({"gstin": gstin}):
                    self.report.duplicate_gstins.append(gstin)
        
        # Print duplicate summary
        if self.report.duplicate_emails:
            print(f"  ⚠️  {len(self.report.duplicate_emails)} duplicate emails found")
        if self.report.duplicate_phones:
            print(f"  ⚠️  {len(self.report.duplicate_phones)} duplicate phones found")
        if self.report.duplicate_gstins:
            print(f"  ⚠️  {len(self.report.duplicate_gstins)} duplicate GSTINs found")
    
    def _migrate_products(self):
        """Migrate dealer products"""
        products = SQLParser.parse_inserts(self.sql_content, 'products')
        
        for prod in products:
            legacy_id = prod.get('id')
            sku = prod.get('sku', '')
            
            # Check if product with same SKU exists
            existing = self.db.dealer_products.find_one({"sku": sku})
            if existing:
                self.product_id_map[legacy_id] = str(existing['_id'])
                self.report.products_skipped += 1
                print(f"  ⏭️  Product SKU '{sku}' already exists, skipping")
                continue
            
            product_doc = {
                "legacy_product_id": legacy_id,
                "name": prod.get('name'),
                "sku": sku,
                "category": prod.get('category'),
                "mrp": float(prod.get('mrp', 0)),
                "dealer_price": float(prod.get('dealer_price', 0)),
                "gst_rate": int(prod.get('gst_rate', 18)),
                "warranty_months": int(prod.get('warranty_months', 12)),
                "is_active": bool(prod.get('is_active', 1)),
                "created_at": datetime.now(timezone.utc),
                "source": "legacy_migration"
            }
            
            if not self.dry_run:
                result = self.db.dealer_products.insert_one(product_doc)
                self.product_id_map[legacy_id] = str(result.inserted_id)
            else:
                self.product_id_map[legacy_id] = f"NEW_{legacy_id}"
            
            self.report.products_created += 1
            print(f"  ✅ Product: {prod.get('name')}")
    
    def _migrate_users(self):
        """Migrate dealer users"""
        users = SQLParser.parse_inserts(self.sql_content, 'users')
        
        for user in users:
            legacy_id = user.get('id')
            role = user.get('role', 'dealer')
            
            # Skip admin users
            if role == 'admin':
                print(f"  ⏭️  Skipping admin user: {user.get('email')}")
                continue
            
            email = user.get('email', '').lower()
            
            # Check if email already exists
            if email in self.report.duplicate_emails:
                existing = self.db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
                if existing:
                    self.user_id_map[legacy_id] = str(existing['_id'])
                    self.report.users_skipped += 1
                    self.report.skipped_records.append({
                        "type": "user",
                        "legacy_id": legacy_id,
                        "email": email,
                        "reason": "Duplicate email - linked to existing user"
                    })
                    print(f"  ⏭️  User '{email}' already exists, linking")
                    continue
            
            # Parse name
            name = str(user.get('name', '') or '')
            name_parts = name.split(' ', 1)
            first_name = name_parts[0] if name_parts else name
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            user_doc = {
                "legacy_user_id": legacy_id,
                "email": email,
                "password_hash": user.get('password', ''),  # PHP bcrypt hash
                "first_name": first_name,
                "last_name": last_name,
                "role": "dealer",
                "is_active": True,
                "force_password_change": bool(user.get('force_password_change', 0)),
                "created_at": datetime.now(timezone.utc),
                "source": "legacy_migration"
            }
            
            if not self.dry_run:
                result = self.db.users.insert_one(user_doc)
                self.user_id_map[legacy_id] = str(result.inserted_id)
            else:
                self.user_id_map[legacy_id] = f"NEW_{legacy_id}"
            
            self.report.users_created += 1
            print(f"  ✅ User: {email}")
    
    def _migrate_dealers(self):
        """Migrate dealers with Party creation"""
        dealers = SQLParser.parse_inserts(self.sql_content, 'dealers')
        
        for dealer in dealers:
            legacy_id = dealer.get('id')
            legacy_user_id = dealer.get('user_id')
            firm_name = dealer.get('firm_name', '')
            gstin = dealer.get('gst_number', '')
            
            # Get mapped user_id
            user_id = self.user_id_map.get(legacy_user_id)
            if not user_id:
                self.report.warnings.append(f"Dealer {legacy_id}: No user mapping for user_id {legacy_user_id}")
                continue
            
            # Check for duplicate GSTIN
            if gstin and gstin in self.report.duplicate_gstins:
                self.report.skipped_records.append({
                    "type": "dealer_party",
                    "legacy_id": legacy_id,
                    "firm_name": firm_name,
                    "gstin": gstin,
                    "reason": "Duplicate GSTIN - needs manual party linkage"
                })
                # Still create dealer but skip party
            
            # Map status
            status_map = {
                'pending': 'pending',
                'approved': 'approved',
                'rejected': 'rejected',
                'suspended': 'suspended'
            }
            deposit_status_map = {
                'not_paid': 'not_paid',
                'pending': 'pending_review',
                'approved': 'approved',
                'rejected': 'rejected',
                '': 'not_paid'
            }
            
            dealer_doc = {
                "legacy_dealer_id": legacy_id,
                "user_id": user_id,
                "firm_name": firm_name,
                "contact_person": dealer.get('contact_person'),
                "phone": str(dealer.get('phone', '') or '').replace(' ', ''),
                "email": None,  # Will link to user email
                "gst_number": gstin,
                "address": {
                    "line1": str(dealer.get('address_line1', '') or ''),
                    "line2": str(dealer.get('address_line2', '') or ''),
                    "city": str(dealer.get('city', '') or ''),
                    "district": str(dealer.get('district', '') or ''),
                    "state": str(dealer.get('state', '') or ''),
                    "pincode": str(dealer.get('pincode', '') or '')
                },
                "status": status_map.get(dealer.get('status'), 'pending'),
                "security_deposit": {
                    "amount": float(dealer.get('security_deposit_amount', 100000)),
                    "status": deposit_status_map.get(dealer.get('security_deposit_status'), 'not_paid'),
                    "proof_path": dealer.get('security_deposit_proof_path'),
                    "approved_at": dealer.get('security_deposit_approved_at'),
                    "remarks": dealer.get('security_deposit_remarks')
                },
                "created_at": datetime.now(timezone.utc),
                "source": "legacy_migration"
            }
            
            if not self.dry_run:
                result = self.db.dealers.insert_one(dealer_doc)
                self.dealer_id_map[legacy_id] = str(result.inserted_id)
                
                # Create Party (type: dealer) unless GSTIN duplicate
                if not (gstin and gstin in self.report.duplicate_gstins):
                    party_doc = {
                        "name": firm_name,
                        "party_type": "dealer",
                        "gstin": gstin,
                        "phone": str(dealer.get('phone', '') or ''),
                        "address": dealer_doc["address"],
                        "linked_dealer_id": str(result.inserted_id),
                        "opening_balance": 0,
                        "current_balance": 0,
                        "created_at": datetime.now(timezone.utc),
                        "source": "legacy_migration"
                    }
                    self.db.parties.insert_one(party_doc)
                    self.report.parties_created += 1
            else:
                self.dealer_id_map[legacy_id] = f"NEW_{legacy_id}"
            
            self.report.dealers_created += 1
            print(f"  ✅ Dealer: {firm_name} ({dealer.get('status')})")
    
    def _migrate_applications(self):
        """Migrate dealer applications"""
        applications = SQLParser.parse_inserts(self.sql_content, 'dealer_applications')
        
        for app in applications:
            legacy_id = app.get('id')
            
            app_doc = {
                "legacy_application_id": legacy_id,
                "firm_name": app.get('firm_name'),
                "contact_person": app.get('contact_person'),
                "email": app.get('email'),
                "phone": app.get('mobile'),
                "address": {
                    "line1": app.get('address_line1', ''),
                    "line2": app.get('address_line2', ''),
                    "city": app.get('city', ''),
                    "district": app.get('district', ''),
                    "state": app.get('state', ''),
                    "pincode": app.get('pincode', '')
                },
                "gstin": app.get('gstin'),
                "business_type": app.get('business_type'),
                "expected_monthly_volume": app.get('expected_monthly_volume'),
                "primary_interest": app.get('primary_interest'),
                "notes": app.get('notes'),
                "status": app.get('status', 'new'),
                "admin_notes": app.get('admin_notes'),
                "created_at": datetime.now(timezone.utc),
                "source": "legacy_migration"
            }
            
            if not self.dry_run:
                self.db.dealer_applications.insert_one(app_doc)
            
            self.report.applications_created += 1
        
        print(f"  ✅ {self.report.applications_created} applications migrated")
    
    def _migrate_orders(self):
        """Migrate orders as HISTORICAL records only"""
        orders = SQLParser.parse_inserts(self.sql_content, 'orders')
        order_items = SQLParser.parse_inserts(self.sql_content, 'order_items')
        
        # Group items by order_id
        items_by_order: Dict[int, List[Dict]] = {}
        for item in order_items:
            order_id = item.get('order_id')
            if order_id not in items_by_order:
                items_by_order[order_id] = []
            items_by_order[order_id].append(item)
        
        for order in orders:
            legacy_id = order.get('id')
            legacy_dealer_id = order.get('dealer_id')
            
            dealer_id = self.dealer_id_map.get(legacy_dealer_id)
            if not dealer_id:
                self.report.warnings.append(f"Order {legacy_id}: No dealer mapping for dealer_id {legacy_dealer_id}")
                continue
            
            # Build items array
            items_arr = []
            for item in items_by_order.get(legacy_id, []):
                product_id = self.product_id_map.get(item.get('product_id'))
                items_arr.append({
                    "product_id": product_id,
                    "legacy_product_id": item.get('product_id'),
                    "quantity": int(item.get('quantity', 0)),
                    "unit_price": float(item.get('unit_price', 0)),
                    "line_total": float(item.get('line_total', 0))
                })
            
            order_doc = {
                "legacy_order_id": legacy_id,
                "order_number": order.get('order_number'),
                "dealer_id": dealer_id,
                "legacy_dealer_id": legacy_dealer_id,
                "status": order.get('status', 'pending'),
                "total_amount": float(order.get('total_amount', 0)),
                "payment_status": order.get('payment_status', 'pending'),
                "payment_received_at": order.get('payment_received_at'),
                "payment_proof_path": order.get('payment_proof_path'),
                "dispatch": {
                    "date": order.get('dispatch_date'),
                    "courier": order.get('dispatch_courier'),
                    "awb": order.get('dispatch_awb'),
                    "remarks": order.get('dispatch_remarks')
                },
                "proforma": {
                    "number": order.get('proforma_number'),
                    "date": order.get('proforma_date')
                },
                "final_invoice": {
                    "number": order.get('final_invoice_number'),
                    "date": order.get('final_invoice_date'),
                    "file_path": order.get('final_invoice_file_path')
                },
                "items": items_arr,
                "created_at": datetime.now(timezone.utc),
                "source": "legacy_migration",
                "is_historical": True,  # CRITICAL: Historical record only
                "inventory_impacted": False,  # No stock deduction
                "accounting_impacted": False  # No sales entries
            }
            
            if not self.dry_run:
                self.db.dealer_orders.insert_one(order_doc)
            
            self.report.orders_created += 1
        
        print(f"  ✅ {self.report.orders_created} orders migrated (HISTORICAL)")
    
    def _print_summary(self):
        """Print migration summary"""
        print(f"\n{'='*60}")
        print("MIGRATION SUMMARY")
        print(f"{'='*60}")
        print(f"{'Mode:':<25} {'DRY RUN' if self.dry_run else 'EXECUTED'}")
        print(f"{'='*60}")
        print(f"{'Products created:':<25} {self.report.products_created}")
        print(f"{'Products skipped:':<25} {self.report.products_skipped}")
        print(f"{'Users created:':<25} {self.report.users_created}")
        print(f"{'Users skipped (dup):':<25} {self.report.users_skipped}")
        print(f"{'Dealers created:':<25} {self.report.dealers_created}")
        print(f"{'Parties created:':<25} {self.report.parties_created}")
        print(f"{'Applications migrated:':<25} {self.report.applications_created}")
        print(f"{'Orders (historical):':<25} {self.report.orders_created}")
        print(f"{'='*60}")
        
        if self.report.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.report.warnings)}):")
            for w in self.report.warnings[:10]:
                print(f"  - {w}")
        
        if self.report.errors:
            print(f"\n❌ ERRORS ({len(self.report.errors)}):")
            for e in self.report.errors[:10]:
                print(f"  - {e}")
        
        if self.report.skipped_records:
            print(f"\n⏭️  SKIPPED RECORDS ({len(self.report.skipped_records)}):")
            for r in self.report.skipped_records[:10]:
                print(f"  - {r['type']}: {r.get('firm_name') or r.get('email')} - {r['reason']}")
    
    def _save_report(self) -> str:
        """Save migration report to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        mode = "dryrun" if self.dry_run else "executed"
        filename = f"/app/backend/migrations/migration_report_{mode}_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(self.report.to_dict(), f, indent=2, default=str)
        
        return filename


def main():
    parser = argparse.ArgumentParser(description='MuscleGrid Dealer Portal Migration')
    parser.add_argument('--dry-run', action='store_true', default=True,
                        help='Run in dry-run mode (default: True)')
    parser.add_argument('--execute', action='store_true',
                        help='Actually execute the migration')
    parser.add_argument('--source', type=str, default='/app/backend/migrations/dealer_data.sql',
                        help='Path to SQL dump file')
    
    args = parser.parse_args()
    
    dry_run = not args.execute
    
    if not dry_run:
        confirm = input("\n⚠️  WARNING: This will modify the database. Type 'YES' to confirm: ")
        if confirm != 'YES':
            print("Migration cancelled.")
            return
    
    migration = DealerMigration(args.source, dry_run=dry_run)
    migration.run()


if __name__ == '__main__':
    main()
