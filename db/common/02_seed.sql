ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = APPUSER;

-- Seed Users (12 users)
INSERT INTO users (id, name, email) VALUES (1, 'Alice Johnson', 'alice.johnson@example.com');
INSERT INTO users (id, name, email) VALUES (2, 'Bob Smith', 'bob.smith@example.com');
INSERT INTO users (id, name, email) VALUES (3, 'Charlie Brown', 'charlie.brown@example.com');
INSERT INTO users (id, name, email) VALUES (4, 'Diana Prince', 'diana.prince@example.com');
INSERT INTO users (id, name, email) VALUES (5, 'Evan Wright', 'evan.wright@example.com');
INSERT INTO users (id, name, email) VALUES (6, 'Fiona Gallagher', 'fiona.gallagher@example.com');
INSERT INTO users (id, name, email) VALUES (7, 'George Miller', 'george.miller@example.com');
INSERT INTO users (id, name, email) VALUES (8, 'Hannah Abbott', 'hannah.abbott@example.com');
INSERT INTO users (id, name, email) VALUES (9, 'Ian Malcolm', 'ian.malcolm@example.com');
INSERT INTO users (id, name, email) VALUES (10, 'Julia Roberts', 'julia.roberts@example.com');
INSERT INTO users (id, name, email) VALUES (11, 'Kevin Bacon', 'kevin.bacon@example.com');
INSERT INTO users (id, name, email) VALUES (12, 'Laura Croft', 'laura.croft@example.com');

-- Seed Products (18 products)
INSERT INTO products (id, name, price) VALUES (1, 'Ergonomic Mechanical Keyboard', 129.99);
INSERT INTO products (id, name, price) VALUES (2, 'Wireless Vertical Mouse', 49.50);
INSERT INTO products (id, name, price) VALUES (3, '4K Ultra HD IPS Monitor', 379.00);
INSERT INTO products (id, name, price) VALUES (4, 'Noise-Cancelling Headphones', 199.95);
INSERT INTO products (id, name, price) VALUES (5, 'Adjustable Standing Desk Converter', 159.00);
INSERT INTO products (id, name, price) VALUES (6, 'USB-C Dual HDMI Docking Station', 89.99);
INSERT INTO products (id, name, price) VALUES (7, 'Full HD 1080p Webcam', 59.90);
INSERT INTO products (id, name, price) VALUES (8, 'Studio Condenser Microphone', 119.00);
INSERT INTO products (id, name, price) VALUES (9, 'Cat6 Ethernet Cable (50ft)', 18.50);
INSERT INTO products (id, name, price) VALUES (10, 'High-Speed Aluminum Flash Drive 256GB', 34.99);
INSERT INTO products (id, name, price) VALUES (11, 'Smart Surge Protector Strip', 29.95);
INSERT INTO products (id, name, price) VALUES (12, 'Ergonomic Memory Foam Lumbar Cushion', 39.00);
INSERT INTO products (id, name, price) VALUES (13, 'Portable SSD 1TB USB 3.2', 109.99);
INSERT INTO products (id, name, price) VALUES (14, 'Bluetooth 5.3 Audio Receiver', 24.50);
INSERT INTO products (id, name, price) VALUES (15, 'Multi-Angle Laptop Stand', 44.00);
INSERT INTO products (id, name, price) VALUES (16, 'Desk LED Monitor Light Bar', 49.99);
INSERT INTO products (id, name, price) VALUES (17, 'Extended Anti-Fray Mouse Pad XXL', 22.00);
INSERT INTO products (id, name, price) VALUES (18, 'Braided USB-C to Lightning Cable', 15.99);

-- Seed Orders (25 orders)
INSERT INTO orders (id, user_id, status, total) VALUES (1, 1, 'COMPLETED', 179.49);
INSERT INTO orders (id, user_id, status, total) VALUES (2, 2, 'PROCESSING', 49.50);
INSERT INTO orders (id, user_id, status, total) VALUES (3, 3, 'COMPLETED', 379.00);
INSERT INTO orders (id, user_id, status, total) VALUES (4, 4, 'PENDING', 199.95);
INSERT INTO orders (id, user_id, status, total) VALUES (5, 5, 'COMPLETED', 248.99);
INSERT INTO orders (id, user_id, status, total) VALUES (6, 6, 'SHIPPED', 59.90);
INSERT INTO orders (id, user_id, status, total) VALUES (7, 7, 'COMPLETED', 119.00);
INSERT INTO orders (id, user_id, status, total) VALUES (8, 8, 'PENDING', 53.49);
INSERT INTO orders (id, user_id, status, total) VALUES (9, 9, 'COMPLETED', 29.95);
INSERT INTO orders (id, user_id, status, total) VALUES (10, 10, 'COMPLETED', 148.99);
INSERT INTO orders (id, user_id, status, total) VALUES (11, 1, 'PROCESSING', 89.99);
INSERT INTO orders (id, user_id, status, total) VALUES (12, 2, 'SHIPPED', 109.99);
INSERT INTO orders (id, user_id, status, total) VALUES (13, 3, 'PENDING', 24.50);
INSERT INTO orders (id, user_id, status, total) VALUES (14, 4, 'COMPLETED', 66.00);
INSERT INTO orders (id, user_id, status, total) VALUES (15, 5, 'COMPLETED', 49.99);
INSERT INTO orders (id, user_id, status, total) VALUES (16, 6, 'PENDING', 129.99);
INSERT INTO orders (id, user_id, status, total) VALUES (17, 7, 'PROCESSING', 37.99);
INSERT INTO orders (id, user_id, status, total) VALUES (18, 8, 'COMPLETED', 218.45);
INSERT INTO orders (id, user_id, status, total) VALUES (19, 9, 'SHIPPED', 379.00);
INSERT INTO orders (id, user_id, status, total) VALUES (20, 10, 'COMPLETED', 159.00);
INSERT INTO orders (id, user_id, status, total) VALUES (21, 11, 'PENDING', 74.49);
INSERT INTO orders (id, user_id, status, total) VALUES (22, 12, 'COMPLETED', 144.98);
INSERT INTO orders (id, user_id, status, total) VALUES (23, 11, 'PROCESSING', 18.50);
INSERT INTO orders (id, user_id, status, total) VALUES (24, 12, 'COMPLETED', 34.99);
INSERT INTO orders (id, user_id, status, total) VALUES (25, 1, 'PENDING', 423.94);

COMMIT;
