ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = APPUSER;

-- Users table
CREATE TABLE users (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(150) NOT NULL UNIQUE
);

-- Orders table
CREATE TABLE orders (
    id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL REFERENCES users(id),
    status VARCHAR2(50) NOT NULL,
    total NUMBER(10, 2) NOT NULL
);

-- Products table
CREATE TABLE products (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    price NUMBER(10, 2) NOT NULL
);

-- Audit log table
CREATE TABLE audit_log (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message VARCHAR2(4000) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Database identity table (indicates PRIMARY or SECONDARY)
CREATE TABLE db_identity (
    name VARCHAR2(20) NOT NULL
);

-- Sequence for dynamic user insertion
CREATE SEQUENCE users_seq START WITH 100 INCREMENT BY 1 NOCACHE;

-- Stored procedure for audit logging
CREATE OR REPLACE PROCEDURE add_audit_log(p_message IN VARCHAR2) AS
BEGIN
    INSERT INTO audit_log (message, created_at)
    VALUES (p_message, CURRENT_TIMESTAMP);
    COMMIT;
END;
/
