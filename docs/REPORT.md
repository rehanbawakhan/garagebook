---
title: "GarageBook – Multi-Vehicle Garage & Service Management System"
---

**Level 3 Project – Database Management Systems**
Department of Computer Science and Engineering, PES University, Electronic City Campus · Academic Year 2026–2027

| | |
|---|---|
| Project Title | GarageBook – Multi-Vehicle Garage & Service Management System |
| Team ID | ________ |
| Team Members (Name – USN) | 1. ________  2. ________ |
| Faculty Guide | ________ |
| GitHub Repository | ________ |

# STAGE 1: PROBLEM DEFINITION AND PROJECT PLANNING
*(Retain the text submitted for Stage 1 here. Summary below.)*

GarageBook lets vehicle owners keep the complete life record of every vehicle they own, and lets workshops run service jobs, parts inventory, inspection reports and billing on the same platform. Two roles: **Owner** and **Workshop**. Primary database: MySQL. Secondary: MongoDB.

# STAGE 2: DATABASE DESIGN AND SQL IMPLEMENTATION

## 1. Introduction
Families and small fleets own several vehicles, but their service bills, insurance papers, fuel entries and repair history are scattered across paper, chats and memory. GarageBook keeps all of it in one relational database and links it to the workshops that do the work.

## 2. Problem Statement
Owners cannot easily answer: *what has this vehicle cost me in total? when does the insurance expire? which parts were replaced and at what price?* Workshops struggle to keep stock in sync with jobs and to produce consistent invoices. Manual records cause stock mismatches, billing errors and missed renewals. The application needs strong integrity (stock never negative, invoices consistent with parts used) which is a natural fit for a relational database with triggers and transactions.

## 3. Objectives and Scope
**Objectives**

1. Model vehicles, services, parts, invoices and running costs in a normalised relational schema.
2. Keep stock and billing consistent automatically using triggers, a stored procedure and transactions.
3. Give owners a per-vehicle cost summary and renewal alerts.
4. Give workshops job tracking, inventory, invoicing and analytics.
5. Store variable-shape inspection reports in a document database.

**Scope.** In: login for two roles, vehicle and record management, service/parts/invoice workflow, full-text complaint search, analytics. Out: online payments, notifications by SMS/email, mobile app.

## 4. Functional Requirements
| ID | Requirement |
|---|---|
| F1 | Owner and workshop registration and login (hashed passwords) |
| F2 | Owner adds/deletes vehicles; sees cost summary per vehicle |
| F3 | Owner records expenses, fuel, insurance, documents, tyres, complaints |
| F4 | Owner sees service history with parts, invoice and inspection report; pays invoices |
| F5 | Owner gets alerts for insurance/documents expiring within 30 days |
| F6 | Workshop books a vehicle in by registration number, starts or cancels jobs |
| F7 | Workshop adds/removes parts from inventory; stock changes automatically |
| F8 | Workshop generates an invoice (labour + parts + tax) atomically |
| F9 | Workshop manages inventory and sees low-stock warnings |
| F10 | Workshop saves a vehicle-type specific inspection report (MongoDB) |
| F11 | Full-text search over repair complaints |
| F12 | Workshop analytics (SQL views, GROUP BY/HAVING, subquery, Mongo aggregations) |

## 5. Technology Selection and Justification
| Need | Choice | Reason |
|---|---|---|
| Transactional core | **MySQL 8** | Strong FK/CHECK/UNIQUE enforcement, triggers, stored procedures, InnoDB transactions, FULLTEXT |
| Inspection reports | **MongoDB** | Checklist fields differ per vehicle type (car vs bike) and can grow without ALTER TABLE; reports are read/written as one document; aggregation pipeline suits analytics |
| API / UI | Next.js 15 Route Handlers | Single codebase, server-side DB access, credentials never reach the browser |

Vector search was considered and not used: the data is structured, and full-text search covers the complaint-text use case.

## 6.1 ER Diagram
See `GarageBook_ERD` (Chen notation, PDF/PNG/draw.io) submitted with this report. Insert the image here.
Entities: Owner, Vehicle, Workshop, Part, Service, Invoice, Insurance, Document, Expense, Fuel_Log, Tyre, Repair_Complaint; associative entities Workshop_Inventory (Workshop–Part, M:N) and Service_Part (Service–Part, M:N).

Key cardinalities: Owner 1:N Vehicle · Vehicle 1:N Service · Workshop 1:N Service · Service 1:1 Invoice · Service M:N Part · Workshop M:N Part · Vehicle 1:N each of Expense, Insurance, Document, Fuel_Log, Tyre, Repair_Complaint · Service 1:N Repair_Complaint (optional).

## 6.2 Relational Schema
Primary keys underlined by convention, FK marked →.

```
OWNER(owner_id PK, name, email UNIQUE, phone, password_hash)
WORKSHOP(workshop_id PK, name, email UNIQUE, address, phone, rating, password_hash)
PART(part_id PK, part_name, part_number UNIQUE, category)
VEHICLE(vehicle_id PK, owner_id → OWNER, make, model, year, registration_no UNIQUE, vehicle_type)
SERVICE(service_id PK, vehicle_id → VEHICLE, workshop_id → WORKSHOP, service_date, description, status, total_cost)
INVOICE(invoice_id PK, service_id → SERVICE UNIQUE, invoice_date, labor_cost, parts_cost, tax, total_amount, status)
WORKSHOP_INVENTORY(workshop_id → WORKSHOP, part_id → PART, stock_quantity, unit_price, reorder_level; PK(workshop_id, part_id))
SERVICE_PART(service_id → SERVICE, part_id → PART, quantity_used, price_at_use; PK(service_id, part_id))
EXPENSE(expense_id PK, vehicle_id → VEHICLE, expense_type, amount, expense_date, description)
INSURANCE(insurance_id PK, vehicle_id → VEHICLE, provider, policy_number UNIQUE, start_date, end_date, premium_amount, coverage_type)
DOCUMENT(document_id PK, vehicle_id → VEHICLE, doc_type, doc_number, issue_date, expiry_date)
FUEL_LOG(fuel_id PK, vehicle_id → VEHICLE, fuel_date, liters, cost, odometer_reading)
TYRE(tyre_id PK, vehicle_id → VEHICLE, brand, position, install_date, expected_life_km, status)
REPAIR_COMPLAINT(complaint_id PK, vehicle_id → VEHICLE, service_id → SERVICE NULL, complaint_text, complaint_date)
```
The schema is in 3NF: price is copied to `price_at_use` deliberately so later price changes do not alter past invoices (historical snapshot, not a redundancy error).

## 6.3 Data Dictionary
| Table | Attribute | Type | Key | Constraints |
|---|---|---|---|---|
| owner | owner_id | INT | PK | AUTO_INCREMENT |
| owner | name | VARCHAR(100) | | NOT NULL |
| owner | email | VARCHAR(120) | | NOT NULL, UNIQUE |
| owner | phone | VARCHAR(15) | | NOT NULL |
| owner | password_hash | VARCHAR(255) | | NOT NULL (bcrypt) |
| workshop | workshop_id | INT | PK | AUTO_INCREMENT |
| workshop | name, address, phone | VARCHAR | | NOT NULL |
| workshop | email | VARCHAR(120) | | UNIQUE (added by ALTER) |
| workshop | password_hash | VARCHAR(255) | | added by ALTER (bcrypt) |
| workshop | rating | DECIMAL(2,1) | | DEFAULT 0.0, CHECK 0–5 |
| part | part_id | INT | PK | AUTO_INCREMENT |
| part | part_name | VARCHAR(100) | | NOT NULL |
| part | part_number | VARCHAR(50) | | NOT NULL, UNIQUE |
| part | category | VARCHAR(50) | | |
| vehicle | vehicle_id | INT | PK | AUTO_INCREMENT |
| vehicle | owner_id | INT | FK→owner | NOT NULL, ON DELETE CASCADE |
| vehicle | make, model | VARCHAR(50) | | NOT NULL |
| vehicle | year | SMALLINT | | NOT NULL, CHECK 1980–2100 |
| vehicle | registration_no | VARCHAR(20) | | NOT NULL, UNIQUE |
| vehicle | vehicle_type | VARCHAR(30) | | NOT NULL |
| service | service_id | INT | PK | AUTO_INCREMENT |
| service | vehicle_id | INT | FK→vehicle | NOT NULL, ON DELETE CASCADE |
| service | workshop_id | INT | FK→workshop | NOT NULL, ON DELETE RESTRICT |
| service | service_date | DATE | | NOT NULL |
| service | description | VARCHAR(255) | | |
| service | status | ENUM | | Pending/In Progress/Completed/Cancelled, DEFAULT Pending |
| service | total_cost | DECIMAL(10,2) | | DEFAULT 0, CHECK ≥ 0 |
| invoice | invoice_id | INT | PK | AUTO_INCREMENT |
| invoice | service_id | INT | FK→service | NOT NULL, UNIQUE (1:1), ON DELETE CASCADE |
| invoice | invoice_date | DATE | | NOT NULL |
| invoice | labor_cost, parts_cost, tax | DECIMAL(10,2) | | DEFAULT 0, CHECK ≥ 0 |
| invoice | total_amount | DECIMAL(10,2) | | NOT NULL, CHECK ≥ 0 |
| invoice | status | ENUM | | Unpaid/Paid/Refunded, DEFAULT Unpaid |
| workshop_inventory | workshop_id, part_id | INT | PK, FK | composite PK, ON DELETE CASCADE |
| workshop_inventory | stock_quantity | INT | | NOT NULL, DEFAULT 0, CHECK ≥ 0 |
| workshop_inventory | unit_price | DECIMAL(10,2) | | NOT NULL, CHECK ≥ 0 |
| workshop_inventory | reorder_level | INT | | NOT NULL, DEFAULT 3 (added by ALTER) |
| service_part | service_id, part_id | INT | PK, FK | composite PK; part FK ON DELETE RESTRICT |
| service_part | quantity_used | INT | | NOT NULL, DEFAULT 1, CHECK > 0 |
| service_part | price_at_use | DECIMAL(10,2) | | NOT NULL, CHECK ≥ 0 |
| expense | expense_id | INT | PK | AUTO_INCREMENT |
| expense | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| expense | expense_type | VARCHAR(50) | | NOT NULL |
| expense | amount | DECIMAL(10,2) | | NOT NULL, CHECK ≥ 0 |
| expense | expense_date | DATE | | NOT NULL |
| insurance | insurance_id | INT | PK | AUTO_INCREMENT |
| insurance | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| insurance | provider | VARCHAR(100) | | NOT NULL |
| insurance | policy_number | VARCHAR(50) | | NOT NULL, UNIQUE |
| insurance | start_date, end_date | DATE | | NOT NULL, CHECK end_date > start_date |
| insurance | premium_amount | DECIMAL(10,2) | | CHECK ≥ 0 |
| document | document_id | INT | PK | AUTO_INCREMENT |
| document | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| document | doc_type, doc_number | VARCHAR(50) | | NOT NULL |
| document | issue_date | DATE | | NOT NULL |
| document | expiry_date | DATE | | nullable |
| fuel_log | fuel_id | INT | PK | AUTO_INCREMENT |
| fuel_log | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| fuel_log | liters | DECIMAL(6,2) | | NOT NULL, CHECK > 0 |
| fuel_log | cost | DECIMAL(10,2) | | NOT NULL, CHECK ≥ 0 |
| fuel_log | odometer_reading | INT | | CHECK ≥ 0 |
| tyre | tyre_id | INT | PK | AUTO_INCREMENT |
| tyre | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| tyre | position | ENUM | | Front-Left/Front-Right/Rear-Left/Rear-Right, NOT NULL |
| tyre | status | ENUM | | Active/Worn/Replaced, DEFAULT Active |
| tyre | expected_life_km | INT | | CHECK > 0 |
| repair_complaint | complaint_id | INT | PK | AUTO_INCREMENT |
| repair_complaint | vehicle_id | INT | FK→vehicle | NOT NULL, CASCADE |
| repair_complaint | service_id | INT | FK→service | NULL, ON DELETE SET NULL |
| repair_complaint | complaint_text | VARCHAR(500) | | NOT NULL, FULLTEXT index |
| repair_complaint | complaint_date | DATE | | NOT NULL |

## 6.4 Relationships and Integrity Constraints
- **Primary keys:** surrogate AUTO_INCREMENT keys; composite keys on the two junction tables.
- **Foreign keys:** every child table references its parent. Deleting an owner cascades to vehicles and everything under them. Workshops and parts referenced by history use RESTRICT so history cannot be orphaned. `repair_complaint.service_id` uses SET NULL because a complaint can outlive its service.
- **UNIQUE:** email, registration number, policy number, part number, one invoice per service.
- **CHECK:** non-negative money, quantity > 0, year range, rating 0–5, insurance end > start.
- **DEFAULT / ENUM:** status columns restrict values to valid states.
- **Trigger-enforced rules:** stock cannot go negative; paid invoices cannot be edited.

## 6.5 NoSQL Data Model (MongoDB)
Database `garagebook`, collection `service_reports`, one document per service.

```json
{ "service_id": 3, "vehicle_id": 1, "workshop_id": 1, "vehicle_type": "Car",
  "condition_score": 7, "issues": ["Worn brake pads"], "notes": "",
  "checks": { "brake_pad_mm": 1.5, "tyre_tread_mm": 4, "oil_level": "OK", "ac_working": true, "battery_voltage": 12.5 },
  "created_at": "...", "updated_at": "..." }
```
A bike report has a different `checks` object (`chain_slack_mm`, `sprocket_wear`, `brake_shoe_mm`). SQL stores only the `service_id` link, so MongoDB documents are joined in the API layer.

Indexes: unique `service_id`; `{vehicle_type, created_at}`; `{workshop_id, created_at}`; multikey `issues`.
Retrieval: lookup by `service_id`; aggregations for analytics. No embeddings or vector search are used.

## 7.1 DDL Operations
Files: `db/01_schema.sql` (CREATE and DROP), `db/02_additions.sql` (ALTER, CREATE INDEX, CREATE VIEW, etc).
- **CREATE:** 14 tables with keys and constraints.
- **ALTER:** `workshop` gets `email`, `password_hash` and a UNIQUE constraint so workshops can log in; `workshop_inventory` gets `reorder_level`.
- **DROP:** `DROP TABLE IF EXISTS` in reverse dependency order in the schema script; `DROP VIEW/TRIGGER/PROCEDURE/FUNCTION IF EXISTS` so the additions script can be re-run.
- **Indexes:** `idx_service_vehicle_date`, `idx_service_workshop_status`, `idx_expense_vehicle_date`, `idx_insurance_end_date`, `idx_fuel_vehicle_date`, FULLTEXT `ft_complaint_text`.

*[Insert screenshots: `SHOW TABLES`, `DESC` of altered tables, `SHOW INDEX FROM service`.]*

## 7.2 Sample Data
Loaded by `npm run db:seed`: 2 owners, 2 workshops, 6 parts, 8 inventory rows, 3 vehicles, 5 services (4 invoiced via the stored procedure), insurance, expenses, fuel, tyres, documents and 6 complaints. *[Insert screenshot of `SELECT * FROM vehicle; SELECT * FROM service;`.]*

## 7.3 DML Operations
INSERT, UPDATE and DELETE examples are in `db/03_dml_queries.sql` (sections INSERT/UPDATE/DELETE). The application performs the same operations through the UI (e.g. add vehicle, add expense, remove part). *[Insert screenshots.]*

## 7.4 Advanced SQL Queries
All in `db/03_dml_queries.sql`.

| # | Query | Concepts |
|---|---|---|
| Q1 | Service history with vehicle, workshop and invoice | 3-table JOIN, LEFT JOIN, ORDER BY |
| Q2 | Spend per expense type | GROUP BY, COUNT, SUM, AVG |
| Q3 | Parts used more than once | GROUP BY, HAVING, JOIN |
| Q4 | Services costing above average | Scalar subquery |
| Q5 | Vehicles never serviced | Correlated NOT EXISTS subquery |

*[Insert output screenshots for each.]*

## 8. Stage 2 Testing
| Test Case | Input / Operation | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| TC01 | Insert valid vehicle | Row inserted | | |
| TC02 | Insert owner with existing email | Rejected (UNIQUE, error 1062) | | |
| TC03 | Insert vehicle with year 1900 | Rejected (CHECK) | | |
| TC04 | Insert vehicle with unknown owner_id | Rejected (FK, error 1452) | | |
| TC05 | Run Q1 JOIN | Correct service history rows | | |
| TC06 | Run Q3 GROUP BY/HAVING | Only parts used > 1 | | |
| TC07 | Delete an owner | Their vehicles are deleted (CASCADE) | | |

*Fill "Actual Result" from `npm run test:db` output and Workbench screenshots.*

## 9. Stage 2 Conclusion
A 14-table normalised schema with keys, constraints and indexes was designed, created and populated, and exercised with JOIN, aggregation, HAVING and subquery queries. Pending for Stage 3: advanced features, web application, authentication and MongoDB integration.

# STAGE 3: ADVANCED DATABASE FEATURES AND APPLICATION INTEGRATION

## 10. System Architecture
```
 Browser (Next.js pages: React)
        │  fetch JSON
        ▼
 Next.js Route Handlers (/api/*)  ── auth guard (JWT cookie, role check) ── zod validation
        │                    │
        ▼                    ▼
   MySQL 8 (mysql2 pool)   MongoDB (service_reports)
   tables, views, triggers,  inspection reports,
   procedure, FULLTEXT       aggregation pipelines
```
Credentials come from `.env.local`. The browser never talks to a database directly.

## 11. Advanced Database Features
| # | Feature | Purpose | Implementation | Evidence |
|---|---|---|---|---|
| 1 | **Transaction + stored procedure** | Invoice creation and service completion must succeed together | `sp_generate_invoice`: `START TRANSACTION`, `SELECT … FOR UPDATE` on the service, computes parts/tax/total, inserts invoice, marks service Completed, `COMMIT`; EXIT HANDLER does `ROLLBACK` + `RESIGNAL` | Calling it twice: second call fails "Service is already closed", nothing changes |
| 2 | **Triggers** | Keep stock correct automatically | `trg_service_part_deduct_stock` (BEFORE INSERT: checks and deducts, SIGNAL if insufficient), `trg_service_part_restock` (AFTER DELETE), `trg_invoice_lock_paid` (BEFORE UPDATE) | Stock before/after in `03_dml_queries.sql` |
| 3 | **Views + function** | Reusable reporting | `v_vehicle_cost_summary`, `v_workshop_performance`, `v_low_stock`, `v_expiring_insurance`; `fn_vehicle_lifetime_cost` | Owner dashboard and Analytics page read from these |
| 4 | **Indexing** | Speed up date/status lookups | 5 composite B-tree indexes chosen for the app's queries | `EXPLAIN` on service history query |
| 5 | **Full-text search** | Find similar complaints | `FULLTEXT(complaint_text)`, `MATCH … AGAINST … IN NATURAL LANGUAGE MODE` | Search box on Owner and Workshop pages |
| 6 | **MongoDB aggregation** | Analytics on flexible documents | `$group` (avg condition by vehicle type), `$unwind` + `$group` (top issues), `$dateToString` + `$group` (reports per month) | Analytics page |
| 7 | **Application-level transaction** | Add inventory atomically | `pool.getConnection()`, BEGIN, create part if new, upsert stock (`ON DUPLICATE KEY UPDATE`), COMMIT/ROLLBACK | Inventory page |

*[Insert screenshots for each.]*

## 12. Web Application Implementation
**12.1 User Interface.** Pages: Login, Register, Owner dashboard, Vehicle detail (tabs for expenses, fuel, insurance, documents, tyres, complaints), Workshop services, Service detail (parts, inspection report, invoice), Inventory, Analytics. *[Insert screenshots.]*

**12.2 Database–Application Integration.** Pages call `/api/*` Route Handlers with `fetch`. Each handler is wrapped by `guarded(roles, handler)` which checks the session, then runs parameterised SQL through the shared `mysql2` pool or the cached `MongoClient`. Database errors are mapped to readable messages (e.g. trigger error 1644 → "Insufficient stock at this workshop").

**12.3 Application Functionalities.**

*Owner:* add vehicles; see lifetime cost per vehicle; log expenses, fuel, insurance, documents, tyres, complaints; view service history with parts and inspection report; pay invoices; expiry alerts; complaint search.
*Workshop:* book vehicles in; add/remove parts (stock follows automatically); inspection report form that changes with vehicle type; one-click invoice; inventory with low-stock flags; analytics dashboard.

## 13. Authentication and Authorization
- Register/login with email and password; roles **owner** and **workshop**.
- Passwords hashed with bcrypt (cost 10). Login compares against a dummy hash for unknown emails to avoid timing-based user enumeration.
- Session: signed JWT (`jose`, HS256) in an httpOnly, SameSite=Lax cookie, 8 hours; `Secure` in production.
- Authorization: every API route declares allowed roles; `/owner/*` and `/workshop/*` layouts redirect other roles.
- Data isolation: every owner query filters by the session's `owner_id`; every workshop query filters by `workshop_id`. An owner requesting another owner's vehicle gets 404.

## 14. Data Validation, Integrity and Security
- **Application validation:** zod schemas on every request body (types, ranges, lengths).
- **Database validation:** NOT NULL, UNIQUE, CHECK, FK, ENUM, triggers (see 6.4). Even if the app were bypassed, the DB rejects bad data.
- **Consistency:** stock/invoice changes go through triggers and a transaction.
- **Secrets:** `.env.local` (git-ignored); `.env.example` has placeholders only.
- **SQL injection:** all values are bound parameters; table/column names only come from a fixed whitelist.
- **Price integrity:** `price_at_use` is read from inventory on the server; the client cannot set it.
- **Closed jobs:** parts cannot be added or removed after a service is Completed/Cancelled.

## 15. Vector Database / Semantic Search
Not used. Complaint text is short and searched with MySQL full-text search. Future work could embed complaints for semantic matching.

## 16. Git/GitHub Repository
Repository URL: ________ . Structure and setup are in `README.md`. Commands: `npm install`, copy `.env.example` to `.env.local`, `npm run db:additions`, `npm run db:seed`, `npm run dev`.

## 17. Final Testing
| Test Case | Feature Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| TC01 | Owner login | Redirected to /owner | | |
| TC02 | Wrong password | Error, no session | | |
| TC03 | Owner opens /workshop | Redirected away | | |
| TC04 | Owner requests another owner's vehicle by URL | 404 | | |
| TC05 | Add expense through UI | Row appears in `expense` | | |
| TC06 | Add part with quantity above stock | Error "Insufficient stock", stock unchanged | | |
| TC07 | Add part within stock | Stock reduced by quantity | | |
| TC08 | Remove part from open service | Stock restored | | |
| TC09 | Generate invoice | Invoice row, service Completed, totals correct | | |
| TC10 | Generate invoice twice | Second attempt rejected | | |
| TC11 | Edit amounts on paid invoice | Rejected by trigger | | |
| TC12 | Complaint search "brake" | Matching complaints, ranked | | |
| TC13 | Save inspection report | Document in MongoDB | | |
| TC14 | Analytics page | Views and Mongo aggregations render | | |
| TC15 | Database test suite | `npm run test:db`: 14 pass | | |

## 18. Individual Team Contributions
| Team Member | Database Work | Application Work | Other Contributions |
|---|---|---|---|
| ________ | | | |
| ________ | | | |

## 19. Conclusion and Future Enhancements
GarageBook demonstrates a normalised 14-table MySQL design with constraints, indexes, views, a function, triggers, a transactional stored procedure and full-text search, combined with MongoDB for flexible inspection reports and aggregation, behind a role-based Next.js application.

*Limitations:* no online payment, no file uploads for documents, single workshop login per workshop, no email reminders.
*Future:* payment gateway, reminder notifications, photo attachments, semantic search over complaints, owner-to-workshop booking requests.

## 20. References
MySQL 8.0 Reference Manual; MongoDB Manual (aggregation pipeline); Next.js documentation (Route Handlers); `mysql2`, `mongodb`, `bcryptjs`, `jose`, `zod` package documentation.

# Appendix
A. Full scripts: `db/01_schema.sql`, `db/02_additions.sql`, `db/03_dml_queries.sql`.
B. API list: `/api/auth/{register,login,logout}`, `/api/vehicles`, `/api/vehicles/[id]`, `/api/vehicles/[id]/records/[kind]`, `/api/vehicles/[id]/history`, `/api/invoices/[id]/pay`, `/api/complaints/search`, `/api/owner/alerts`, `/api/workshop/{services,inventory,analytics}` and sub-routes.
C. `.env.example` (no secrets): `MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MONGODB_URI, MONGODB_DB, JWT_SECRET`.

# FINAL SUBMISSION CHECKLIST
- [x] ER diagram and relational schema included
- [x] Schema and constraints implemented
- [ ] DDL/DML execution screenshots inserted
- [x] Four or more advanced concepts implemented
- [ ] Application screenshots inserted
- [x] Two roles, validation and security addressed
- [ ] GitHub URL and contributions filled in
