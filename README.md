# GarageBook

**Multi-vehicle garage and service management system** – DBMS Level 3 mini project (PES University, 2026–27).

GarageBook keeps the full life record of every vehicle an owner has, and lets workshops run service jobs, parts inventory, inspection reports and billing on the same platform.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-6-47A248?logo=mongodb&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

---

## Features

**Owner**
- Add and manage several vehicles, each with a lifetime cost summary
- Record expenses, fuel logs, insurance, documents, tyres and repair complaints
- View full service history: parts used, invoice and inspection report
- Pay invoices
- Alerts for insurance and documents expiring within 30 days

**Workshop**
- Book a vehicle in by registration number; start, complete or cancel jobs
- Add parts to a job – stock is deducted and restored automatically by triggers
- Generate an invoice (labour + parts + tax) in a single transaction
- Manage inventory with low-stock warnings
- Save vehicle-type specific inspection reports (car vs bike checklists)
- Analytics dashboard (SQL views, GROUP BY/HAVING, subqueries, MongoDB aggregations)

**Both**
- Full-text search over repair complaints

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router, Route Handlers), React 19, TypeScript |
| Primary database | MySQL 8 (`mysql2`) – 14 tables, triggers, procedure, function, views, FULLTEXT |
| Secondary database | MongoDB (`mongodb` driver) – inspection reports |
| Auth | bcrypt password hashing, JWT in an httpOnly cookie (`jose`) |
| Validation | `zod` in the API + CHECK / UNIQUE / FK constraints in the database |

### Why two databases?
- **MySQL** holds all relational, transactional data where integrity matters (stock must never go negative, invoices must match parts used).
- **MongoDB** holds per-service inspection reports. A car checklist (brake pads, oil, AC) differs from a bike checklist (chain slack, sprocket wear), so the document shape varies – a natural fit for a document store. Analytics on it use aggregation pipelines.

## Architecture

```
 Browser (React pages)
        │  fetch JSON
        ▼
 Next.js Route Handlers (/api/*) ── auth guard (JWT cookie + role) ── zod validation
        │                         │
        ▼                         ▼
   MySQL 8                     MongoDB
   tables, views, triggers,    service_reports collection,
   procedure, FULLTEXT         aggregation pipelines
```
The browser never talks to a database directly; all credentials come from `.env.local`.

## Database design

**Entities:** Owner, Vehicle, Workshop, Part, Service, Invoice, Insurance, Document, Expense, Fuel_Log, Tyre, Repair_Complaint, plus associative tables Workshop_Inventory (Workshop ⇄ Part) and Service_Part (Service ⇄ Part).

```
OWNER(owner_id PK, name, email UNIQUE, phone, password_hash)
WORKSHOP(workshop_id PK, name, email UNIQUE, address, phone, rating, password_hash)
PART(part_id PK, part_name, part_number UNIQUE, category)
VEHICLE(vehicle_id PK, owner_id → OWNER, make, model, year, registration_no UNIQUE, vehicle_type)
SERVICE(service_id PK, vehicle_id → VEHICLE, workshop_id → WORKSHOP, service_date, description, status, total_cost)
INVOICE(invoice_id PK, service_id → SERVICE UNIQUE, invoice_date, labor_cost, parts_cost, tax, total_amount, status)
WORKSHOP_INVENTORY(workshop_id → WORKSHOP, part_id → PART, stock_quantity, unit_price, reorder_level)
SERVICE_PART(service_id → SERVICE, part_id → PART, quantity_used, price_at_use)
EXPENSE / INSURANCE / DOCUMENT / FUEL_LOG / TYRE / REPAIR_COMPLAINT  (each → VEHICLE)
```

The schema is in 3NF. `price_at_use` is a deliberate historical snapshot so later price changes don't alter past invoices.

### Advanced features

| # | Feature | Objects |
|---|---|---|
| 1 | Transaction + stored procedure (row lock, rollback on error) | `sp_generate_invoice` |
| 2 | Triggers | `trg_service_part_deduct_stock`, `trg_service_part_restock`, `trg_invoice_lock_paid` |
| 3 | Views | `v_vehicle_cost_summary`, `v_workshop_performance`, `v_low_stock`, `v_expiring_insurance` |
| 4 | Stored function | `fn_vehicle_lifetime_cost` |
| 5 | Composite indexes + FULLTEXT search | `idx_service_vehicle_date`, `ft_complaint_text`, … |
| 6 | MongoDB aggregation pipelines | 3 pipelines on the workshop analytics page |

## Getting started

### Prerequisites
- Node.js ≥ 20.6
- MySQL 8 running locally
- MongoDB running locally

### Setup

```bash
git clone https://github.com/rehanbawakhan/garagebook.git
cd garagebook
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

Edit `.env.local` with your MySQL credentials and a long random `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Create the database and run

```bash
npm run db:schema      # creates the 14 base tables (drops existing ones first!)
npm run db:additions   # ALTERs, indexes, full-text, views, triggers, function, procedure
npm run db:seed        # demo data with bcrypt-hashed passwords
npm run dev            # http://localhost:3000
```

Already have the tables? Skip `db:schema`. If you inserted sample rows by hand earlier, use `npm run db:reset` instead of `db:seed`.

> Use the npm scripts rather than `mysql < file` – they behave the same on Windows PowerShell.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Owner | rehan@example.com | Owner@123 |
| Workshop | speedy@example.com | Workshop@123 |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:schema` | Run `db/01_schema.sql` |
| `npm run db:additions` | Run `db/02_additions.sql` |
| `npm run db:seed` | Insert demo data |
| `npm run db:reset` | Clear data and re-seed |
| `npm run test:db` | 14 database-level tests (constraints, triggers, procedure, views, full-text, cascade) |

## Project structure

```
app/
  api/               Route Handlers (auth, vehicles, records, workshop services, invoices, analytics)
  owner/             owner pages (dashboard, vehicle detail)
  workshop/          workshop pages (jobs, service detail, inventory, analytics)
  login/, register/  auth pages
components/          shared React components
lib/                 MySQL pool, MongoDB client, auth, validation helpers
db/
  01_schema.sql      base tables
  02_additions.sql   indexes, views, triggers, function, procedure
  03_dml_queries.sql DML and query evidence
scripts/             run-sql, seed, test-db
docs/                project report (Markdown + Word)
```

## Security

- Configuration from environment variables only – `.env.local` is git-ignored
- Passwords hashed with bcrypt (cost 10)
- httpOnly JWT session cookie with role-based route guards
- Parameterised SQL queries everywhere
- Ownership checks on every owner/workshop query
- Input validated with zod, backed by database CHECK / UNIQUE / FK constraints

## Documentation

The full project report (ER model, data dictionary, queries, testing) is in [`docs/REPORT.md`](docs/REPORT.md) and [`docs/GarageBook_Report.docx`](docs/GarageBook_Report.docx).
