-- ddl-check/scripts/postgres.sql
\set ON_ERROR_STOP on

\echo '--- Case: 01_1N_User_Post (Postgres) ---'
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(120)
);

CREATE TABLE "Post" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(200)
);

ALTER TABLE "Post"
  ADD COLUMN "user_id" UUID NOT NULL;

ALTER TABLE "Post"
  ADD CONSTRAINT "fk_Post_user_id" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX ON "Post"("user_id");
\echo '--- End Case: 01_1N_User_Post (Postgres) ---'


\echo '--- Case: 02_NM_Product_Category_auto_link (Postgres) ---'
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;

CREATE TABLE "Product" (
  "id" UUID PRIMARY KEY,
  "name" VARCHAR(120)
);

CREATE TABLE "Category" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(120)
);

CREATE TABLE "product_category_link" (
  "product_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  PRIMARY KEY ("product_id", "category_id"),
  CONSTRAINT "fk_product_category_link_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_category_link_category_id" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE
);

CREATE INDEX ON "product_category_link"("product_id");
CREATE INDEX ON "product_category_link"("category_id");
\echo '--- End Case: 02_NM_Product_Category_auto_link (Postgres) ---'


\echo '--- Case: 03_Self_1N_Comment_parent_nullable (Postgres) ---'
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;

CREATE TABLE "Comment" (
  "id" UUID PRIMARY KEY,
  "body" TEXT,
  "parent_comment_id" UUID
);

ALTER TABLE "Comment"
  ADD CONSTRAINT "fk_Comment_parent_comment_id" FOREIGN KEY ("parent_comment_id") REFERENCES "Comment"("id") ON DELETE CASCADE;

CREATE INDEX ON "Comment"("parent_comment_id");
\echo '--- End Case: 03_Self_1N_Comment_parent_nullable (Postgres) ---'
-- Case: 04_Reserved_words_Select_from (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 04_Reserved_words_Select_from (Postgres) ---'

CREATE TABLE "Select" (
  "id" UUID PRIMARY KEY,
  "from" VARCHAR(40)
);

CREATE TABLE "Event" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(120)
);

ALTER TABLE "Event"
  ADD COLUMN "select_id" UUID NOT NULL;

ALTER TABLE "Event"
  ADD CONSTRAINT "fk_Event_select_id" FOREIGN KEY ("select_id") REFERENCES "Select"("id") ON DELETE CASCADE;

CREATE INDEX ON "Event"("select_id");

\echo '--- End Case: 04_Reserved_words_Select_from (Postgres) ---'
-- End Case: 04_Reserved_words_Select_from (Postgres)


-- Case: 05_Lonely_entity_AuditLog (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 05_Lonely_entity_AuditLog (Postgres) ---'

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(120)
);

CREATE TABLE "Project" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(120)
);

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY,
  "action" VARCHAR(80),
  "createdAt" TIMESTAMP
);

ALTER TABLE "Project"
  ADD COLUMN "user_id" UUID NOT NULL;

ALTER TABLE "Project"
  ADD CONSTRAINT "fk_Project_user_id" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX ON "Project"("user_id");

\echo '--- End Case: 05_Lonely_entity_AuditLog (Postgres) ---'
-- End Case: 05_Lonely_entity_AuditLog (Postgres)


-- Case: 06_FK_cycle_with_nullable (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 06_FK_cycle_with_nullable (Postgres) ---'

CREATE TABLE "A" (
  "id" UUID PRIMARY KEY
);

CREATE TABLE "B" (
  "id" UUID PRIMARY KEY
);

CREATE TABLE "C" (
  "id" UUID PRIMARY KEY
);

ALTER TABLE "B"
  ADD COLUMN "a_id" UUID;

ALTER TABLE "B"
  ADD CONSTRAINT "fk_B_a_id" FOREIGN KEY ("a_id") REFERENCES "A"("id") ON DELETE CASCADE;

CREATE INDEX ON "B"("a_id");

ALTER TABLE "C"
  ADD COLUMN "b_id" UUID NOT NULL;

ALTER TABLE "C"
  ADD CONSTRAINT "fk_C_b_id" FOREIGN KEY ("b_id") REFERENCES "B"("id") ON DELETE CASCADE;

CREATE INDEX ON "C"("b_id");

ALTER TABLE "A"
  ADD COLUMN "c_id" UUID NOT NULL;

ALTER TABLE "A"
  ADD CONSTRAINT "fk_A_c_id" FOREIGN KEY ("c_id") REFERENCES "C"("id") ON DELETE CASCADE;

CREATE INDEX ON "A"("c_id");

\echo '--- End Case: 06_FK_cycle_with_nullable (Postgres) ---'
-- End Case: 06_FK_cycle_with_nullable (Postgres)
-- Case: 07_MiniShop_Order_OrderItem_Product_Customer (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 07_MiniShop_Order_OrderItem_Product_Customer (Postgres) ---'

CREATE TABLE "Customer" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(120),
  "name" VARCHAR(80)
);

CREATE TABLE "Product" (
  "id" UUID PRIMARY KEY,
  "sku" VARCHAR(40),
  "title" VARCHAR(120),
  "price" DECIMAL(10,2)
);

CREATE TABLE "Order" (
  "id" UUID PRIMARY KEY,
  "createdAt" TIMESTAMP,
  "status" VARCHAR(40),
  "total" DECIMAL(10,2)
);

CREATE TABLE "OrderItem" (
  "id" UUID PRIMARY KEY,
  "quantity" INT,
  "unitPrice" DECIMAL(10,2)
);

ALTER TABLE "Order"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Order"
  ADD CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Order"("customer_id");

ALTER TABLE "OrderItem"
  ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "fk_OrderItem_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE;

CREATE INDEX ON "OrderItem"("order_id");

ALTER TABLE "OrderItem"
  ADD COLUMN "product_id" UUID NOT NULL;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "fk_OrderItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT;

CREATE INDEX ON "OrderItem"("product_id");

\echo '--- End Case: 07_MiniShop_Order_OrderItem_Product_Customer (Postgres) ---'


-- Case: 08_MiniShop_Address_Order_Payment_1to1 (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 08_MiniShop_Address_Order_Payment_1to1 (Postgres) ---'

CREATE TABLE "Customer" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(120),
  "name" VARCHAR(80)
);

CREATE TABLE "Address" (
  "id" UUID PRIMARY KEY,
  "line1" VARCHAR(120),
  "city" VARCHAR(60),
  "country" VARCHAR(60)
);

CREATE TABLE "Order" (
  "id" UUID PRIMARY KEY,
  "createdAt" TIMESTAMP,
  "status" VARCHAR(40),
  "total" DECIMAL(10,2)
);

CREATE TABLE "Payment" (
  "id" UUID PRIMARY KEY,
  "method" VARCHAR(40),
  "status" VARCHAR(40),
  "amount" DECIMAL(10,2),
  "paidAt" TIMESTAMP
);

ALTER TABLE "Address"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Address"
  ADD CONSTRAINT "fk_Address_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Address"("customer_id");

ALTER TABLE "Order"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Order"
  ADD CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Order"("customer_id");

ALTER TABLE "Order"
  ADD COLUMN "shipping_address_id" UUID NOT NULL;

ALTER TABLE "Order"
  ADD CONSTRAINT "fk_Order_shipping_address_id" FOREIGN KEY ("shipping_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT;

CREATE INDEX ON "Order"("shipping_address_id");

ALTER TABLE "Payment"
  ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "fk_Payment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "uq_Payment_order_id" UNIQUE ("order_id");

\echo '--- End Case: 08_MiniShop_Address_Order_Payment_1to1 (Postgres) ---'


-- Case: 09_BigShop_Ecommerce_Model (Postgres)
DROP SCHEMA IF EXISTS ddlcheck CASCADE;
CREATE SCHEMA ddlcheck;
SET search_path TO ddlcheck;
\echo '--- Case: 09_BigShop_Ecommerce_Model (Postgres) ---'

CREATE TABLE "Customer" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(120),
  "name" VARCHAR(80),
  "phone" VARCHAR(30)
);

CREATE TABLE "Address" (
  "id" UUID PRIMARY KEY,
  "label" VARCHAR(40),
  "line1" VARCHAR(120),
  "city" VARCHAR(60),
  "country" VARCHAR(60)
);

CREATE TABLE "Brand" (
  "id" UUID PRIMARY KEY,
  "name" VARCHAR(120)
);

CREATE TABLE "Category" (
  "id" UUID PRIMARY KEY,
  "title" VARCHAR(120)
);

CREATE TABLE "Product" (
  "id" UUID PRIMARY KEY,
  "sku" VARCHAR(40),
  "title" VARCHAR(120),
  "price" DECIMAL(10,2),
  "stock" INT,
  "isActive" BOOLEAN
);

CREATE TABLE "Cart" (
  "id" UUID PRIMARY KEY,
  "createdAt" TIMESTAMP
);

CREATE TABLE "CartItem" (
  "id" UUID PRIMARY KEY,
  "quantity" INT
);

CREATE TABLE "Order" (
  "id" UUID PRIMARY KEY,
  "createdAt" TIMESTAMP,
  "status" VARCHAR(40),
  "total" DECIMAL(10,2)
);

CREATE TABLE "OrderItem" (
  "id" UUID PRIMARY KEY,
  "quantity" INT,
  "unitPrice" DECIMAL(10,2)
);

CREATE TABLE "Payment" (
  "id" UUID PRIMARY KEY,
  "method" VARCHAR(40),
  "status" VARCHAR(40),
  "amount" DECIMAL(10,2),
  "paidAt" TIMESTAMP
);

CREATE TABLE "Shipment" (
  "id" UUID PRIMARY KEY,
  "carrier" VARCHAR(60),
  "trackingNo" VARCHAR(80),
  "status" VARCHAR(40),
  "shippedAt" TIMESTAMP
);

CREATE TABLE "Review" (
  "id" UUID PRIMARY KEY,
  "rating" INT,
  "body" TEXT,
  "createdAt" TIMESTAMP
);

ALTER TABLE "Address"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Address"
  ADD CONSTRAINT "fk_Address_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Address"("customer_id");

ALTER TABLE "Product"
  ADD COLUMN "brand_id" UUID NOT NULL;

ALTER TABLE "Product"
  ADD CONSTRAINT "fk_Product_brand_id" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE RESTRICT;

CREATE INDEX ON "Product"("brand_id");

CREATE TABLE "product_category_link" (
  "product_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  PRIMARY KEY ("product_id", "category_id"),
  CONSTRAINT "fk_product_category_link_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_category_link_category_id" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE
);

CREATE INDEX ON "product_category_link"("product_id");
CREATE INDEX ON "product_category_link"("category_id");

ALTER TABLE "Cart"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Cart"
  ADD CONSTRAINT "fk_Cart_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

ALTER TABLE "Cart"
  ADD CONSTRAINT "uq_Cart_customer_id" UNIQUE ("customer_id");

ALTER TABLE "CartItem"
  ADD COLUMN "cart_id" UUID NOT NULL;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "fk_CartItem_cart_id" FOREIGN KEY ("cart_id") REFERENCES "Cart"("id") ON DELETE CASCADE;

CREATE INDEX ON "CartItem"("cart_id");

ALTER TABLE "CartItem"
  ADD COLUMN "product_id" UUID NOT NULL;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "fk_CartItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT;

CREATE INDEX ON "CartItem"("product_id");

ALTER TABLE "Order"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Order"
  ADD CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Order"("customer_id");

ALTER TABLE "Order"
  ADD COLUMN "shipping_address_id" UUID NOT NULL;

ALTER TABLE "Order"
  ADD CONSTRAINT "fk_Order_shipping_address_id" FOREIGN KEY ("shipping_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT;

CREATE INDEX ON "Order"("shipping_address_id");

ALTER TABLE "OrderItem"
  ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "fk_OrderItem_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE;

CREATE INDEX ON "OrderItem"("order_id");

ALTER TABLE "OrderItem"
  ADD COLUMN "product_id" UUID NOT NULL;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "fk_OrderItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT;

CREATE INDEX ON "OrderItem"("product_id");

ALTER TABLE "Payment"
  ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "fk_Payment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "uq_Payment_order_id" UNIQUE ("order_id");

ALTER TABLE "Shipment"
  ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "fk_Shipment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "uq_Shipment_order_id" UNIQUE ("order_id");

ALTER TABLE "Review"
  ADD COLUMN "customer_id" UUID NOT NULL;

ALTER TABLE "Review"
  ADD CONSTRAINT "fk_Review_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE;

CREATE INDEX ON "Review"("customer_id");

ALTER TABLE "Review"
  ADD COLUMN "product_id" UUID NOT NULL;

ALTER TABLE "Review"
  ADD CONSTRAINT "fk_Review_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE;

CREATE INDEX ON "Review"("product_id");

\echo '--- End Case: 09_BigShop_Ecommerce_Model (Postgres) ---'