-- ============================================================
-- GarageBook: DML + important queries (run AFTER seeding) for Stage 2 evidence.
-- Run statement by statement in MySQL Workbench / mysql CLI and screenshot the output.
-- ============================================================
USE garagebook_db;

-- ---------- INSERT ----------
INSERT INTO expense (vehicle_id, expense_type, amount, expense_date, description)
VALUES (1, 'Insurance Top-up', 2500.00, CURDATE(), 'Add-on cover');

-- ---------- UPDATE ----------
UPDATE vehicle SET model = 'City ZX' WHERE vehicle_id = 1;
UPDATE workshop_inventory SET unit_price = unit_price * 1.05 WHERE workshop_id = 1 AND part_id = 1;

-- ---------- DELETE ----------
DELETE FROM expense WHERE expense_type = 'Insurance Top-up' AND vehicle_id = 1;

-- ---------- SELECT with JOIN + ORDER BY ----------
-- Q1. Service history with workshop and invoice (3-table JOIN)
SELECT s.service_id, v.registration_no, w.name AS workshop, s.service_date, s.status, i.total_amount, i.status AS invoice_status
FROM service s
JOIN vehicle v  ON v.vehicle_id  = s.vehicle_id
JOIN workshop w ON w.workshop_id = s.workshop_id
LEFT JOIN invoice i ON i.service_id = s.service_id
ORDER BY s.service_date DESC;

-- ---------- GROUP BY + aggregate ----------
-- Q2. Spend per expense type
SELECT expense_type, COUNT(*) AS entries, SUM(amount) AS total, ROUND(AVG(amount),2) AS average
FROM expense GROUP BY expense_type ORDER BY total DESC;

-- ---------- GROUP BY + HAVING ----------
-- Q3. Parts used more than once across all services
SELECT p.part_name, SUM(sp.quantity_used) AS total_used, SUM(sp.quantity_used * sp.price_at_use) AS revenue
FROM service_part sp JOIN part p ON p.part_id = sp.part_id
GROUP BY p.part_id, p.part_name
HAVING SUM(sp.quantity_used) > 1
ORDER BY total_used DESC;

-- ---------- Subquery ----------
-- Q4. Completed services costing more than the average completed service
SELECT service_id, description, total_cost
FROM service
WHERE status = 'Completed'
  AND total_cost > (SELECT AVG(total_cost) FROM service WHERE status = 'Completed');

-- Q5. Vehicles that have never had a service (NOT EXISTS)
SELECT v.registration_no, v.make, v.model
FROM vehicle v
WHERE NOT EXISTS (SELECT 1 FROM service s WHERE s.vehicle_id = v.vehicle_id);

-- ---------- Views / function ----------
SELECT * FROM v_vehicle_cost_summary;
SELECT * FROM v_workshop_performance;
SELECT * FROM v_low_stock;
SELECT * FROM v_expiring_insurance;
SELECT fn_vehicle_lifetime_cost(1) AS lifetime_cost_vehicle_1;

-- ---------- Full-text search ----------
SELECT complaint_id, complaint_text,
       MATCH(complaint_text) AGAINST ('brake noise' IN NATURAL LANGUAGE MODE) AS relevance
FROM repair_complaint
WHERE MATCH(complaint_text) AGAINST ('brake noise' IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC;

-- ---------- Trigger demo (stock deducted, then restored) ----------
SELECT stock_quantity FROM workshop_inventory WHERE workshop_id = 1 AND part_id = 5;
INSERT INTO service (vehicle_id, workshop_id, service_date, description, status) VALUES (1, 1, CURDATE(), 'Demo', 'In Progress');
SET @sid = LAST_INSERT_ID();
INSERT INTO service_part (service_id, part_id, quantity_used, price_at_use) VALUES (@sid, 5, 2, 180);
SELECT stock_quantity FROM workshop_inventory WHERE workshop_id = 1 AND part_id = 5;   -- 2 less
INSERT INTO service_part (service_id, part_id, quantity_used, price_at_use) VALUES (@sid, 4, 50, 400);  -- fails: Insufficient stock
DELETE FROM service_part WHERE service_id = @sid AND part_id = 5;
SELECT stock_quantity FROM workshop_inventory WHERE workshop_id = 1 AND part_id = 5;   -- restored

-- ---------- Stored procedure / transaction demo ----------
INSERT INTO service_part (service_id, part_id, quantity_used, price_at_use) VALUES (@sid, 5, 1, 180);
CALL sp_generate_invoice(@sid, 500, 18);
SELECT * FROM invoice WHERE service_id = @sid;
CALL sp_generate_invoice(@sid, 500, 18);   -- fails: Service is already closed (rolled back)

-- ---------- Constraint demos (each should FAIL) ----------
INSERT INTO owner (name,email,phone,password_hash) VALUES ('Dup','rehan@example.com','1','x');                 -- UNIQUE
INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (1,'A','B',1900,'X1','Car');  -- CHECK
INSERT INTO vehicle (owner_id,make,model,year,registration_no,vehicle_type) VALUES (999,'A','B',2020,'X2','Car'); -- FK
