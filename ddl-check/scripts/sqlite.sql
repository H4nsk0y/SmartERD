-- ddl-check/scripts/sqlite.sql
.bail ON
.echo ON
PRAGMA foreign_keys = ON;

.print '--- Case: 01_1N_User_Post (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Post";
DROP TABLE IF EXISTS "User";
PRAGMA foreign_keys = ON;

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT
);

CREATE TABLE "Post" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "fk_Post_user_id" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Post_user_id" ON "Post"("user_id");
.print '--- End Case: 01_1N_User_Post (SQLite) ---'


.print '--- Case: 02_NM_Product_Category_auto_link (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "product_category_link";
DROP TABLE IF EXISTS "Category";
DROP TABLE IF EXISTS "Product";
PRAGMA foreign_keys = ON;

CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT
);

CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT
);

CREATE TABLE "product_category_link" (
  "product_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  PRIMARY KEY ("product_id", "category_id"),
  CONSTRAINT "fk_product_category_link_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_category_link_category_id" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_pcl_product_id" ON "product_category_link"("product_id");
CREATE INDEX "idx_pcl_category_id" ON "product_category_link"("category_id");
.print '--- End Case: 02_NM_Product_Category_auto_link (SQLite) ---'


.print '--- Case: 03_Self_1N_Comment_parent_nullable (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Comment";
PRAGMA foreign_keys = ON;

CREATE TABLE "Comment" (
  "id" TEXT PRIMARY KEY,
  "body" TEXT,
  "parent_comment_id" TEXT,
  CONSTRAINT "fk_Comment_parent_comment_id" FOREIGN KEY ("parent_comment_id") REFERENCES "Comment"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Comment_parent_comment_id" ON "Comment"("parent_comment_id");
.print '--- End Case: 03_Self_1N_Comment_parent_nullable (SQLite) ---'
.print '--- Case: 04_Reserved_words_Select_from (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Event";
DROP TABLE IF EXISTS "Select";
PRAGMA foreign_keys = ON;

CREATE TABLE "Select" (
  "id" TEXT PRIMARY KEY,
  "from" TEXT
);

CREATE TABLE "Event" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "select_id" TEXT NOT NULL,
  CONSTRAINT "fk_Event_select_id" FOREIGN KEY ("select_id") REFERENCES "Select"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Event_select_id" ON "Event"("select_id");

.print '--- End Case: 04_Reserved_words_Select_from (SQLite) ---'
-- End Case: 04_Reserved_words_Select_from (SQLite)


.print '--- Case: 05_Lonely_entity_AuditLog (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS "AuditLog";
PRAGMA foreign_keys = ON;

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT
);

CREATE TABLE "Project" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "fk_Project_user_id" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Project_user_id" ON "Project"("user_id");

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT,
  "createdAt" TEXT
);

.print '--- End Case: 05_Lonely_entity_AuditLog (SQLite) ---'
-- End Case: 05_Lonely_entity_AuditLog (SQLite)


.print '--- Case: 06_FK_cycle_with_nullable (SQLite) ---'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "A";
DROP TABLE IF EXISTS "B";
DROP TABLE IF EXISTS "C";
PRAGMA foreign_keys = ON;

CREATE TABLE "A" (
  "id" TEXT PRIMARY KEY,
  "c_id" TEXT NOT NULL,
  CONSTRAINT "fk_A_c_id" FOREIGN KEY ("c_id") REFERENCES "C"("id") ON DELETE CASCADE
);

CREATE TABLE "B" (
  "id" TEXT PRIMARY KEY,
  "a_id" TEXT,
  CONSTRAINT "fk_B_a_id" FOREIGN KEY ("a_id") REFERENCES "A"("id") ON DELETE CASCADE
);

CREATE TABLE "C" (
  "id" TEXT PRIMARY KEY,
  "b_id" TEXT NOT NULL,
  CONSTRAINT "fk_C_b_id" FOREIGN KEY ("b_id") REFERENCES "B"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_A_c_id" ON "A"("c_id");
CREATE INDEX "idx_B_a_id" ON "B"("a_id");
CREATE INDEX "idx_C_b_id" ON "C"("b_id");

.print '--- End Case: 06_FK_cycle_with_nullable (SQLite) ---'
-- End Case: 06_FK_cycle_with_nullable (SQLite)
-- Case: 07_MiniShop_Order_OrderItem_Product_Customer (SQLite)
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "Customer";
PRAGMA foreign_keys = ON;
.print '--- Case: 07_MiniShop_Order_OrderItem_Product_Customer (SQLite) ---'

CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT,
  "name" TEXT
);

CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "sku" TEXT,
  "title" TEXT,
  "price" NUMERIC
);

CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TEXT,
  "status" TEXT,
  "total" NUMERIC,
  "customer_id" TEXT NOT NULL,
  CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Order_customer_id" ON "Order"("customer_id");

CREATE TABLE "OrderItem" (
  "id" TEXT PRIMARY KEY,
  "quantity" INTEGER,
  "unitPrice" NUMERIC,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  CONSTRAINT "fk_OrderItem_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_OrderItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_OrderItem_order_id" ON "OrderItem"("order_id");
CREATE INDEX "idx_OrderItem_product_id" ON "OrderItem"("product_id");

.print '--- End Case: 07_MiniShop_Order_OrderItem_Product_Customer (SQLite) ---'


-- Case: 08_MiniShop_Address_Order_Payment_1to1 (SQLite)
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Payment";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "Address";
DROP TABLE IF EXISTS "Customer";
PRAGMA foreign_keys = ON;
.print '--- Case: 08_MiniShop_Address_Order_Payment_1to1 (SQLite) ---'

CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT,
  "name" TEXT
);

CREATE TABLE "Address" (
  "id" TEXT PRIMARY KEY,
  "line1" TEXT,
  "city" TEXT,
  "country" TEXT,
  "customer_id" TEXT NOT NULL,
  CONSTRAINT "fk_Address_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_Address_customer_id" ON "Address"("customer_id");

CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TEXT,
  "status" TEXT,
  "total" NUMERIC,
  "customer_id" TEXT NOT NULL,
  "shipping_address_id" TEXT NOT NULL,
  CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_Order_shipping_address_id" FOREIGN KEY ("shipping_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_Order_customer_id" ON "Order"("customer_id");
CREATE INDEX "idx_Order_shipping_address_id" ON "Order"("shipping_address_id");

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "method" TEXT,
  "status" TEXT,
  "amount" NUMERIC,
  "paidAt" TEXT,
  "order_id" TEXT NOT NULL UNIQUE,
  CONSTRAINT "fk_Payment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE
);

.print '--- End Case: 08_MiniShop_Address_Order_Payment_1to1 (SQLite) ---'


-- Case: 09_BigShop_Ecommerce_Model (SQLite)
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS "Review";
DROP TABLE IF EXISTS "Shipment";
DROP TABLE IF EXISTS "Payment";
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "CartItem";
DROP TABLE IF EXISTS "Cart";
DROP TABLE IF EXISTS "product_category_link";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "Category";
DROP TABLE IF EXISTS "Brand";
DROP TABLE IF EXISTS "Address";
DROP TABLE IF EXISTS "Customer";
PRAGMA foreign_keys = ON;
.print '--- Case: 09_BigShop_Ecommerce_Model (SQLite) ---'

CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT,
  "name" TEXT,
  "phone" TEXT
);

CREATE TABLE "Address" (
  "id" TEXT PRIMARY KEY,
  "label" TEXT,
  "line1" TEXT,
  "city" TEXT,
  "country" TEXT,
  "customer_id" TEXT NOT NULL,
  CONSTRAINT "fk_Address_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_Address_customer_id" ON "Address"("customer_id");

CREATE TABLE "Brand" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT
);

CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT
);

CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY,
  "sku" TEXT,
  "title" TEXT,
  "price" NUMERIC,
  "stock" INTEGER,
  "isActive" INTEGER,
  "brand_id" TEXT NOT NULL,
  CONSTRAINT "fk_Product_brand_id" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE RESTRICT
);
CREATE INDEX "idx_Product_brand_id" ON "Product"("brand_id");

CREATE TABLE "product_category_link" (
  "product_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  PRIMARY KEY ("product_id", "category_id"),
  CONSTRAINT "fk_product_category_link_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_product_category_link_category_id" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_pcl_product_id" ON "product_category_link"("product_id");
CREATE INDEX "idx_pcl_category_id" ON "product_category_link"("category_id");

CREATE TABLE "Cart" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TEXT,
  "customer_id" TEXT NOT NULL UNIQUE,
  CONSTRAINT "fk_Cart_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE
);

CREATE TABLE "CartItem" (
  "id" TEXT PRIMARY KEY,
  "quantity" INTEGER,
  "cart_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  CONSTRAINT "fk_CartItem_cart_id" FOREIGN KEY ("cart_id") REFERENCES "Cart"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_CartItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT
);
CREATE INDEX "idx_CartItem_cart_id" ON "CartItem"("cart_id");
CREATE INDEX "idx_CartItem_product_id" ON "CartItem"("product_id");

CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TEXT,
  "status" TEXT,
  "total" NUMERIC,
  "customer_id" TEXT NOT NULL,
  "shipping_address_id" TEXT NOT NULL,
  CONSTRAINT "fk_Order_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_Order_shipping_address_id" FOREIGN KEY ("shipping_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT
);
CREATE INDEX "idx_Order_customer_id" ON "Order"("customer_id");
CREATE INDEX "idx_Order_shipping_address_id" ON "Order"("shipping_address_id");

CREATE TABLE "OrderItem" (
  "id" TEXT PRIMARY KEY,
  "quantity" INTEGER,
  "unitPrice" NUMERIC,
  "order_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  CONSTRAINT "fk_OrderItem_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_OrderItem_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT
);
CREATE INDEX "idx_OrderItem_order_id" ON "OrderItem"("order_id");
CREATE INDEX "idx_OrderItem_product_id" ON "OrderItem"("product_id");

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "method" TEXT,
  "status" TEXT,
  "amount" NUMERIC,
  "paidAt" TEXT,
  "order_id" TEXT NOT NULL UNIQUE,
  CONSTRAINT "fk_Payment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE
);

CREATE TABLE "Shipment" (
  "id" TEXT PRIMARY KEY,
  "carrier" TEXT,
  "trackingNo" TEXT,
  "status" TEXT,
  "shippedAt" TEXT,
  "order_id" TEXT NOT NULL UNIQUE,
  CONSTRAINT "fk_Shipment_order_id" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE
);

CREATE TABLE "Review" (
  "id" TEXT PRIMARY KEY,
  "rating" INTEGER,
  "body" TEXT,
  "createdAt" TEXT,
  "customer_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  CONSTRAINT "fk_Review_customer_id" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_Review_product_id" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_Review_customer_id" ON "Review"("customer_id");
CREATE INDEX "idx_Review_product_id" ON "Review"("product_id");

.print '--- End Case: 09_BigShop_Ecommerce_Model (SQLite) ---'
