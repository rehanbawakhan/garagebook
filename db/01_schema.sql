-- GarageBook base schema (14 tables). Fresh install only: this DROPS existing tables.
CREATE DATABASE IF NOT EXISTS garagebook_db;
USE garagebook_db;

-- ============================================================
-- GarageBook — Multi-Vehicle Garage & Service Management System
-- DDL Script (MySQL 8.x syntax)
-- Tables created in dependency order (parents before children)
-- ============================================================

DROP TABLE IF EXISTS repair_complaint;
DROP TABLE IF EXISTS tyre;
DROP TABLE IF EXISTS fuel_log;
DROP TABLE IF EXISTS document;
DROP TABLE IF EXISTS insurance;
DROP TABLE IF EXISTS expense;
DROP TABLE IF EXISTS service_part;
DROP TABLE IF EXISTS workshop_inventory;
DROP TABLE IF EXISTS invoice;
DROP TABLE IF EXISTS service;
DROP TABLE IF EXISTS vehicle;
DROP TABLE IF EXISTS part;
DROP TABLE IF EXISTS workshop;
DROP TABLE IF EXISTS owner;


-- ------------------------------------------------------------
-- 1. owner
-- ------------------------------------------------------------
CREATE TABLE owner (
    owner_id        INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(120) NOT NULL UNIQUE,
    phone           VARCHAR(15)  NOT NULL,
    password_hash   VARCHAR(255) NOT NULL
);


-- ------------------------------------------------------------
-- 2. workshop
-- ------------------------------------------------------------
CREATE TABLE workshop (
    workshop_id     INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    address         VARCHAR(200) NOT NULL,
    phone           VARCHAR(15)  NOT NULL,
    rating          DECIMAL(2,1) DEFAULT 0.0 CHECK (rating BETWEEN 0 AND 5)
);


-- ------------------------------------------------------------
-- 3. part
-- ------------------------------------------------------------
CREATE TABLE part (
    part_id         INT AUTO_INCREMENT PRIMARY KEY,
    part_name       VARCHAR(100) NOT NULL,
    part_number     VARCHAR(50)  NOT NULL UNIQUE,
    category        VARCHAR(50)
);


-- ------------------------------------------------------------
-- 4. vehicle  (FK -> owner)
-- ------------------------------------------------------------
CREATE TABLE vehicle (
    vehicle_id      INT AUTO_INCREMENT PRIMARY KEY,
    owner_id        INT NOT NULL,
    make            VARCHAR(50)  NOT NULL,
    model           VARCHAR(50)  NOT NULL,
    year            SMALLINT     NOT NULL CHECK (year BETWEEN 1980 AND 2100),
    registration_no VARCHAR(20)  NOT NULL UNIQUE,
    vehicle_type    VARCHAR(30)  NOT NULL,
    CONSTRAINT fk_vehicle_owner
        FOREIGN KEY (owner_id) REFERENCES owner(owner_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 5. service  (FK -> vehicle, FK -> workshop)
-- ------------------------------------------------------------
CREATE TABLE service (
    service_id      INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    workshop_id     INT NOT NULL,
    service_date    DATE NOT NULL,
    description     VARCHAR(255),
    status          ENUM('Pending','In Progress','Completed','Cancelled') DEFAULT 'Pending',
    total_cost      DECIMAL(10,2) DEFAULT 0.00 CHECK (total_cost >= 0),
    CONSTRAINT fk_service_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_service_workshop
        FOREIGN KEY (workshop_id) REFERENCES workshop(workshop_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 6. invoice  (FK -> service, 1:1 via UNIQUE)
-- ------------------------------------------------------------
CREATE TABLE invoice (
    invoice_id      INT AUTO_INCREMENT PRIMARY KEY,
    service_id      INT NOT NULL UNIQUE,
    invoice_date    DATE NOT NULL,
    labor_cost      DECIMAL(10,2) DEFAULT 0.00 CHECK (labor_cost >= 0),
    parts_cost      DECIMAL(10,2) DEFAULT 0.00 CHECK (parts_cost >= 0),
    tax             DECIMAL(10,2) DEFAULT 0.00 CHECK (tax >= 0),
    total_amount    DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status          ENUM('Unpaid','Paid','Refunded') DEFAULT 'Unpaid',
    CONSTRAINT fk_invoice_service
        FOREIGN KEY (service_id) REFERENCES service(service_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 7. workshop_inventory  (M:N junction: workshop <-> part)
-- ------------------------------------------------------------
CREATE TABLE workshop_inventory (
    workshop_id     INT NOT NULL,
    part_id         INT NOT NULL,
    stock_quantity  INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    unit_price      DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    PRIMARY KEY (workshop_id, part_id),
    CONSTRAINT fk_inventory_workshop
        FOREIGN KEY (workshop_id) REFERENCES workshop(workshop_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_inventory_part
        FOREIGN KEY (part_id) REFERENCES part(part_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 8. service_part  (M:N junction: service <-> part)
-- ------------------------------------------------------------
CREATE TABLE service_part (
    service_id      INT NOT NULL,
    part_id         INT NOT NULL,
    quantity_used   INT NOT NULL DEFAULT 1 CHECK (quantity_used > 0),
    price_at_use    DECIMAL(10,2) NOT NULL CHECK (price_at_use >= 0),
    PRIMARY KEY (service_id, part_id),
    CONSTRAINT fk_servicepart_service
        FOREIGN KEY (service_id) REFERENCES service(service_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_servicepart_part
        FOREIGN KEY (part_id) REFERENCES part(part_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 9. expense  (FK -> vehicle)
-- ------------------------------------------------------------
CREATE TABLE expense (
    expense_id      INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    expense_type    VARCHAR(50) NOT NULL,
    amount          DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    expense_date    DATE NOT NULL,
    description     VARCHAR(255),
    CONSTRAINT fk_expense_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 10. insurance  (FK -> vehicle)
-- ------------------------------------------------------------
CREATE TABLE insurance (
    insurance_id    INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    provider        VARCHAR(100) NOT NULL,
    policy_number   VARCHAR(50)  NOT NULL UNIQUE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    premium_amount  DECIMAL(10,2) CHECK (premium_amount >= 0),
    coverage_type   VARCHAR(50),
    CONSTRAINT fk_insurance_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_insurance_dates
        CHECK (end_date > start_date)
);


-- ------------------------------------------------------------
-- 11. document  (FK -> vehicle)
-- ------------------------------------------------------------
CREATE TABLE document (
    document_id     INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    doc_type        VARCHAR(50) NOT NULL,
    doc_number      VARCHAR(50) NOT NULL,
    issue_date      DATE NOT NULL,
    expiry_date     DATE,
    CONSTRAINT fk_document_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 12. fuel_log  (FK -> vehicle)
-- ------------------------------------------------------------
CREATE TABLE fuel_log (
    fuel_id         INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    fuel_date       DATE NOT NULL,
    liters          DECIMAL(6,2) NOT NULL CHECK (liters > 0),
    cost            DECIMAL(10,2) NOT NULL CHECK (cost >= 0),
    odometer_reading INT CHECK (odometer_reading >= 0),
    CONSTRAINT fk_fuellog_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 13. tyre  (FK -> vehicle)
-- ------------------------------------------------------------
CREATE TABLE tyre (
    tyre_id         INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    brand           VARCHAR(50) NOT NULL,
    position        ENUM('Front-Left','Front-Right','Rear-Left','Rear-Right') NOT NULL,
    install_date    DATE NOT NULL,
    expected_life_km INT CHECK (expected_life_km > 0),
    status          ENUM('Active','Worn','Replaced') DEFAULT 'Active',
    CONSTRAINT fk_tyre_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ------------------------------------------------------------
-- 14. repair_complaint  (FK -> vehicle, FK -> service [nullable])
-- ------------------------------------------------------------
CREATE TABLE repair_complaint (
    complaint_id    INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    service_id      INT NULL,
    complaint_text  VARCHAR(500) NOT NULL,
    complaint_date  DATE NOT NULL,
    CONSTRAINT fk_complaint_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_complaint_service
        FOREIGN KEY (service_id) REFERENCES service(service_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);
