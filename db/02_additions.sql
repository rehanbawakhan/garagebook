-- ============================================================
-- GarageBook: additions on top of the 14 base tables
-- Run AFTER 01_schema.sql (or on your existing garagebook_db).
-- Safe to re-run: `npm run db:additions` skips "already exists" errors.
-- Demonstrates: ALTER, indexes, full-text, views, trigger, function,
--               stored procedure + transaction.
-- ============================================================
USE garagebook_db;

-- ------------------------------------------------------------
-- 1. ALTER: workshops need to log in; inventory needs a reorder level
-- ------------------------------------------------------------
ALTER TABLE workshop ADD COLUMN email VARCHAR(120) NULL AFTER name;
ALTER TABLE workshop ADD COLUMN password_hash VARCHAR(255) NULL;
ALTER TABLE workshop ADD CONSTRAINT uq_workshop_email UNIQUE (email);
ALTER TABLE workshop_inventory ADD COLUMN reorder_level INT NOT NULL DEFAULT 3;

-- ------------------------------------------------------------
-- 2. INDEXES (composite, chosen for the app's real queries)
-- ------------------------------------------------------------
CREATE INDEX idx_service_vehicle_date ON service (vehicle_id, service_date);
CREATE INDEX idx_service_workshop_status ON service (workshop_id, status);
CREATE INDEX idx_expense_vehicle_date ON expense (vehicle_id, expense_date);
CREATE INDEX idx_insurance_end_date ON insurance (end_date);
CREATE INDEX idx_fuel_vehicle_date ON fuel_log (vehicle_id, fuel_date);

-- ------------------------------------------------------------
-- 3. FULL-TEXT SEARCH on repair complaints
-- ------------------------------------------------------------
CREATE FULLTEXT INDEX ft_complaint_text ON repair_complaint (complaint_text);

-- ------------------------------------------------------------
-- 4. Remove old objects so the script can be re-run
-- ------------------------------------------------------------
DROP VIEW IF EXISTS v_vehicle_cost_summary;
DROP VIEW IF EXISTS v_workshop_performance;
DROP VIEW IF EXISTS v_low_stock;
DROP VIEW IF EXISTS v_expiring_insurance;
DROP TRIGGER IF EXISTS trg_service_part_deduct_stock;
DROP TRIGGER IF EXISTS trg_service_part_restock;
DROP TRIGGER IF EXISTS trg_invoice_lock_paid;
DROP PROCEDURE IF EXISTS sp_generate_invoice;
DROP FUNCTION IF EXISTS fn_vehicle_lifetime_cost;

-- ------------------------------------------------------------
-- 5. FUNCTION: lifetime cost of a vehicle
-- ------------------------------------------------------------
DELIMITER $$
CREATE FUNCTION fn_vehicle_lifetime_cost(p_vehicle_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_expenses DECIMAL(12,2);
    DECLARE v_services DECIMAL(12,2);
    DECLARE v_fuel     DECIMAL(12,2);
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
        FROM expense WHERE vehicle_id = p_vehicle_id;
    SELECT COALESCE(SUM(total_cost), 0) INTO v_services
        FROM service WHERE vehicle_id = p_vehicle_id AND status = 'Completed';
    SELECT COALESCE(SUM(cost), 0) INTO v_fuel
        FROM fuel_log WHERE vehicle_id = p_vehicle_id;
    RETURN v_expenses + v_services + v_fuel;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- 6. VIEWS
-- ------------------------------------------------------------
CREATE VIEW v_vehicle_cost_summary AS
SELECT v.vehicle_id,
       v.owner_id,
       v.registration_no,
       v.make,
       v.model,
       v.year,
       v.vehicle_type,
       (SELECT COALESCE(SUM(e.amount), 0) FROM expense e WHERE e.vehicle_id = v.vehicle_id) AS total_expenses,
       (SELECT COALESCE(SUM(f.cost), 0)   FROM fuel_log f WHERE f.vehicle_id = v.vehicle_id) AS total_fuel,
       (SELECT COALESCE(SUM(s.total_cost), 0) FROM service s
            WHERE s.vehicle_id = v.vehicle_id AND s.status = 'Completed') AS total_service,
       fn_vehicle_lifetime_cost(v.vehicle_id) AS lifetime_cost
FROM vehicle v;

CREATE VIEW v_workshop_performance AS
SELECT w.workshop_id,
       w.name,
       w.rating,
       COUNT(s.service_id)                       AS services_completed,
       COALESCE(ROUND(AVG(s.total_cost), 2), 0)  AS avg_service_cost,
       COALESCE(SUM(i.total_amount), 0)          AS total_revenue,
       COALESCE(ROUND(AVG(DATEDIFF(i.invoice_date, s.service_date)), 1), 0) AS avg_turnaround_days
FROM workshop w
LEFT JOIN service s ON s.workshop_id = w.workshop_id AND s.status = 'Completed'
LEFT JOIN invoice i ON i.service_id = s.service_id
GROUP BY w.workshop_id, w.name, w.rating;

CREATE VIEW v_low_stock AS
SELECT wi.workshop_id,
       w.name AS workshop_name,
       wi.part_id,
       p.part_name,
       p.part_number,
       wi.stock_quantity,
       wi.reorder_level
FROM workshop_inventory wi
JOIN workshop w ON w.workshop_id = wi.workshop_id
JOIN part p     ON p.part_id     = wi.part_id
WHERE wi.stock_quantity <= wi.reorder_level;

CREATE VIEW v_expiring_insurance AS
SELECT i.insurance_id,
       i.vehicle_id,
       v.owner_id,
       v.registration_no,
       i.provider,
       i.policy_number,
       i.end_date,
       DATEDIFF(i.end_date, CURDATE()) AS days_left
FROM insurance i
JOIN vehicle v ON v.vehicle_id = i.vehicle_id
WHERE DATEDIFF(i.end_date, CURDATE()) BETWEEN 0 AND 30;

-- ------------------------------------------------------------
-- 7. TRIGGERS
-- ------------------------------------------------------------
-- 7a. Using a part checks the workshop's stock and deducts it.
DELIMITER $$
CREATE TRIGGER trg_service_part_deduct_stock
BEFORE INSERT ON service_part
FOR EACH ROW
BEGIN
    DECLARE v_workshop INT;
    DECLARE v_stock INT;
    SELECT workshop_id INTO v_workshop FROM service WHERE service_id = NEW.service_id;
    SELECT stock_quantity INTO v_stock FROM workshop_inventory
        WHERE workshop_id = v_workshop AND part_id = NEW.part_id FOR UPDATE;
    IF v_stock IS NULL OR v_stock < NEW.quantity_used THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock at this workshop';
    END IF;
    UPDATE workshop_inventory
        SET stock_quantity = stock_quantity - NEW.quantity_used
        WHERE workshop_id = v_workshop AND part_id = NEW.part_id;
END$$

-- 7b. Removing a part from a service returns it to stock.
CREATE TRIGGER trg_service_part_restock
AFTER DELETE ON service_part
FOR EACH ROW
BEGIN
    DECLARE v_workshop INT;
    SELECT workshop_id INTO v_workshop FROM service WHERE service_id = OLD.service_id;
    UPDATE workshop_inventory
        SET stock_quantity = stock_quantity + OLD.quantity_used
        WHERE workshop_id = v_workshop AND part_id = OLD.part_id;
END$$

-- 7c. A paid invoice's amounts can no longer change.
CREATE TRIGGER trg_invoice_lock_paid
BEFORE UPDATE ON invoice
FOR EACH ROW
BEGIN
    IF OLD.status = 'Paid' AND
       (NEW.total_amount <> OLD.total_amount OR NEW.labor_cost <> OLD.labor_cost
        OR NEW.parts_cost <> OLD.parts_cost OR NEW.tax <> OLD.tax) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paid invoices cannot be modified';
    END IF;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- 8. STORED PROCEDURE with a TRANSACTION
--    Invoice + service completion succeed together or not at all.
-- ------------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE sp_generate_invoice(
    IN p_service_id INT,
    IN p_labor DECIMAL(10,2),
    IN p_tax_rate DECIMAL(5,2)
)
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_parts DECIMAL(10,2);
    DECLARE v_tax DECIMAL(10,2);
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_invoice_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_labor < 0 OR p_tax_rate < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Labor cost and tax rate must not be negative';
    END IF;

    START TRANSACTION;

    SELECT status INTO v_status FROM service WHERE service_id = p_service_id FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service not found';
    END IF;
    IF v_status IN ('Completed', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service is already closed';
    END IF;

    SELECT COALESCE(SUM(quantity_used * price_at_use), 0) INTO v_parts
        FROM service_part WHERE service_id = p_service_id;

    SET v_tax   = ROUND((p_labor + v_parts) * p_tax_rate / 100, 2);
    SET v_total = p_labor + v_parts + v_tax;

    INSERT INTO invoice (service_id, invoice_date, labor_cost, parts_cost, tax, total_amount, status)
    VALUES (p_service_id, CURDATE(), p_labor, v_parts, v_tax, v_total, 'Unpaid');
    SET v_invoice_id = LAST_INSERT_ID();

    UPDATE service SET total_cost = v_total, status = 'Completed'
        WHERE service_id = p_service_id;

    COMMIT;

    SELECT v_invoice_id AS invoice_id, v_parts AS parts_cost, v_tax AS tax, v_total AS total_amount;
END$$
DELIMITER ;
