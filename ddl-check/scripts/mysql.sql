-- ddl-check/scripts/mysql.sql

SELECT '--- Case: 01_1N_User_Post (MySQL) ---' AS marker;
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;

CREATE TABLE `User` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `Post` (
  `id` CHAR(36) PRIMARY KEY,
  `title` VARCHAR(200)
) ENGINE=InnoDB;

ALTER TABLE `Post`
  ADD `user_id` CHAR(36) NOT NULL;

ALTER TABLE `Post`
  ADD CONSTRAINT `fk_Post_user_id` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_post_user_id` ON `Post`(`user_id`);
SELECT '--- End Case: 01_1N_User_Post (MySQL) ---' AS marker;


SELECT '--- Case: 02_NM_Product_Category_auto_link (MySQL) ---' AS marker;
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;

CREATE TABLE `Product` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `Category` (
  `id` CHAR(36) PRIMARY KEY,
  `title` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `product_category_link` (
  `product_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`product_id`, `category_id`),
  CONSTRAINT `fk_product_category_link_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_category_link_category_id` FOREIGN KEY (`category_id`) REFERENCES `Category`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX `idx_pcl_product_id` ON `product_category_link`(`product_id`);
CREATE INDEX `idx_pcl_category_id` ON `product_category_link`(`category_id`);
SELECT '--- End Case: 02_NM_Product_Category_auto_link (MySQL) ---' AS marker;


SELECT '--- Case: 03_Self_1N_Comment_parent_nullable (MySQL) ---' AS marker;
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;

CREATE TABLE `Comment` (
  `id` CHAR(36) PRIMARY KEY,
  `body` TEXT,
  `parent_comment_id` CHAR(36)
) ENGINE=InnoDB;

ALTER TABLE `Comment`
  ADD CONSTRAINT `fk_Comment_parent_comment_id` FOREIGN KEY (`parent_comment_id`) REFERENCES `Comment`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_comment_parent_comment_id` ON `Comment`(`parent_comment_id`);
SELECT '--- End Case: 03_Self_1N_Comment_parent_nullable (MySQL) ---' AS marker;
-- Case: 04_Reserved_words_Select_from (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 04_Reserved_words_Select_from (MySQL) ---' AS marker;

CREATE TABLE `Select` (
  `id` CHAR(36) PRIMARY KEY,
  `from` VARCHAR(40)
) ENGINE=InnoDB;

CREATE TABLE `Event` (
  `id` CHAR(36) PRIMARY KEY,
  `title` VARCHAR(120)
) ENGINE=InnoDB;

ALTER TABLE `Event`
  ADD `select_id` CHAR(36) NOT NULL;

ALTER TABLE `Event`
  ADD CONSTRAINT `fk_Event_select_id` FOREIGN KEY (`select_id`) REFERENCES `Select`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_event_select_id` ON `Event`(`select_id`);

SELECT '--- End Case: 04_Reserved_words_Select_from (MySQL) ---' AS marker;
-- End Case: 04_Reserved_words_Select_from (MySQL)


-- Case: 05_Lonely_entity_AuditLog (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 05_Lonely_entity_AuditLog (MySQL) ---' AS marker;

CREATE TABLE `User` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `Project` (
  `id` CHAR(36) PRIMARY KEY,
  `title` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `AuditLog` (
  `id` CHAR(36) PRIMARY KEY,
  `action` VARCHAR(80),
  `createdAt` TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE `Project`
  ADD `user_id` CHAR(36) NOT NULL;

ALTER TABLE `Project`
  ADD CONSTRAINT `fk_Project_user_id` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_project_user_id` ON `Project`(`user_id`);

SELECT '--- End Case: 05_Lonely_entity_AuditLog (MySQL) ---' AS marker;
-- End Case: 05_Lonely_entity_AuditLog (MySQL)


-- Case: 06_FK_cycle_with_nullable (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 06_FK_cycle_with_nullable (MySQL) ---' AS marker;

CREATE TABLE `A` (
  `id` CHAR(36) PRIMARY KEY
) ENGINE=InnoDB;

CREATE TABLE `B` (
  `id` CHAR(36) PRIMARY KEY
) ENGINE=InnoDB;

CREATE TABLE `C` (
  `id` CHAR(36) PRIMARY KEY
) ENGINE=InnoDB;

ALTER TABLE `B`
  ADD `a_id` CHAR(36);

ALTER TABLE `B`
  ADD CONSTRAINT `fk_B_a_id` FOREIGN KEY (`a_id`) REFERENCES `A`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_b_a_id` ON `B`(`a_id`);

ALTER TABLE `C`
  ADD `b_id` CHAR(36) NOT NULL;

ALTER TABLE `C`
  ADD CONSTRAINT `fk_C_b_id` FOREIGN KEY (`b_id`) REFERENCES `B`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_c_b_id` ON `C`(`b_id`);

ALTER TABLE `A`
  ADD `c_id` CHAR(36) NOT NULL;

ALTER TABLE `A`
  ADD CONSTRAINT `fk_A_c_id` FOREIGN KEY (`c_id`) REFERENCES `C`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_a_c_id` ON `A`(`c_id`);

SELECT '--- End Case: 06_FK_cycle_with_nullable (MySQL) ---' AS marker;
-- End Case: 06_FK_cycle_with_nullable (MySQL)
-- Case: 07_MiniShop_Order_OrderItem_Product_Customer (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 07_MiniShop_Order_OrderItem_Product_Customer (MySQL) ---' AS marker;

CREATE TABLE `Customer` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(120),
  `name` VARCHAR(80)
) ENGINE=InnoDB;

CREATE TABLE `Product` (
  `id` CHAR(36) PRIMARY KEY,
  `sku` VARCHAR(40),
  `title` VARCHAR(120),
  `price` DECIMAL(10,2)
) ENGINE=InnoDB;

CREATE TABLE `Order` (
  `id` CHAR(36) PRIMARY KEY,
  `createdAt` TIMESTAMP NULL,
  `status` VARCHAR(40),
  `total` DECIMAL(10,2)
) ENGINE=InnoDB;

CREATE TABLE `OrderItem` (
  `id` CHAR(36) PRIMARY KEY,
  `quantity` INT,
  `unitPrice` DECIMAL(10,2)
) ENGINE=InnoDB;

ALTER TABLE `Order`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Order`
  ADD CONSTRAINT `fk_Order_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Order_customer_id` ON `Order`(`customer_id`);

ALTER TABLE `OrderItem`
  ADD `order_id` CHAR(36) NOT NULL;

ALTER TABLE `OrderItem`
  ADD CONSTRAINT `fk_OrderItem_order_id` FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_OrderItem_order_id` ON `OrderItem`(`order_id`);

ALTER TABLE `OrderItem`
  ADD `product_id` CHAR(36) NOT NULL;

ALTER TABLE `OrderItem`
  ADD CONSTRAINT `fk_OrderItem_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_OrderItem_product_id` ON `OrderItem`(`product_id`);

SELECT '--- End Case: 07_MiniShop_Order_OrderItem_Product_Customer (MySQL) ---' AS marker;


-- Case: 08_MiniShop_Address_Order_Payment_1to1 (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 08_MiniShop_Address_Order_Payment_1to1 (MySQL) ---' AS marker;

CREATE TABLE `Customer` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(120),
  `name` VARCHAR(80)
) ENGINE=InnoDB;

CREATE TABLE `Address` (
  `id` CHAR(36) PRIMARY KEY,
  `line1` VARCHAR(120),
  `city` VARCHAR(60),
  `country` VARCHAR(60)
) ENGINE=InnoDB;

CREATE TABLE `Order` (
  `id` CHAR(36) PRIMARY KEY,
  `createdAt` TIMESTAMP NULL,
  `status` VARCHAR(40),
  `total` DECIMAL(10,2)
) ENGINE=InnoDB;

CREATE TABLE `Payment` (
  `id` CHAR(36) PRIMARY KEY,
  `method` VARCHAR(40),
  `status` VARCHAR(40),
  `amount` DECIMAL(10,2),
  `paidAt` TIMESTAMP NULL
) ENGINE=InnoDB;

ALTER TABLE `Address`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Address`
  ADD CONSTRAINT `fk_Address_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Address_customer_id` ON `Address`(`customer_id`);

ALTER TABLE `Order`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Order`
  ADD CONSTRAINT `fk_Order_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Order_customer_id` ON `Order`(`customer_id`);

ALTER TABLE `Order`
  ADD `shipping_address_id` CHAR(36) NOT NULL;

ALTER TABLE `Order`
  ADD CONSTRAINT `fk_Order_shipping_address_id` FOREIGN KEY (`shipping_address_id`) REFERENCES `Address`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_Order_shipping_address_id` ON `Order`(`shipping_address_id`);

ALTER TABLE `Payment`
  ADD `order_id` CHAR(36) NOT NULL;

ALTER TABLE `Payment`
  ADD CONSTRAINT `fk_Payment_order_id` FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `uq_Payment_order_id` UNIQUE (`order_id`);

SELECT '--- End Case: 08_MiniShop_Address_Order_Payment_1to1 (MySQL) ---' AS marker;


-- Case: 09_BigShop_Ecommerce_Model (MySQL)
DROP DATABASE IF EXISTS ddlcheck;
CREATE DATABASE ddlcheck;
USE ddlcheck;
SELECT '--- Case: 09_BigShop_Ecommerce_Model (MySQL) ---' AS marker;

CREATE TABLE `Customer` (
  `id` CHAR(36) PRIMARY KEY,
  `email` VARCHAR(120),
  `name` VARCHAR(80),
  `phone` VARCHAR(30)
) ENGINE=InnoDB;

CREATE TABLE `Address` (
  `id` CHAR(36) PRIMARY KEY,
  `label` VARCHAR(40),
  `line1` VARCHAR(120),
  `city` VARCHAR(60),
  `country` VARCHAR(60)
) ENGINE=InnoDB;

CREATE TABLE `Brand` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `Category` (
  `id` CHAR(36) PRIMARY KEY,
  `title` VARCHAR(120)
) ENGINE=InnoDB;

CREATE TABLE `Product` (
  `id` CHAR(36) PRIMARY KEY,
  `sku` VARCHAR(40),
  `title` VARCHAR(120),
  `price` DECIMAL(10,2),
  `stock` INT,
  `isActive` BOOLEAN
) ENGINE=InnoDB;

CREATE TABLE `Cart` (
  `id` CHAR(36) PRIMARY KEY,
  `createdAt` TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE `CartItem` (
  `id` CHAR(36) PRIMARY KEY,
  `quantity` INT
) ENGINE=InnoDB;

CREATE TABLE `Order` (
  `id` CHAR(36) PRIMARY KEY,
  `createdAt` TIMESTAMP NULL,
  `status` VARCHAR(40),
  `total` DECIMAL(10,2)
) ENGINE=InnoDB;

CREATE TABLE `OrderItem` (
  `id` CHAR(36) PRIMARY KEY,
  `quantity` INT,
  `unitPrice` DECIMAL(10,2)
) ENGINE=InnoDB;

CREATE TABLE `Payment` (
  `id` CHAR(36) PRIMARY KEY,
  `method` VARCHAR(40),
  `status` VARCHAR(40),
  `amount` DECIMAL(10,2),
  `paidAt` TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE `Shipment` (
  `id` CHAR(36) PRIMARY KEY,
  `carrier` VARCHAR(60),
  `trackingNo` VARCHAR(80),
  `status` VARCHAR(40),
  `shippedAt` TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE `Review` (
  `id` CHAR(36) PRIMARY KEY,
  `rating` INT,
  `body` TEXT,
  `createdAt` TIMESTAMP NULL
) ENGINE=InnoDB;

ALTER TABLE `Address`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Address`
  ADD CONSTRAINT `fk_Address_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Address_customer_id` ON `Address`(`customer_id`);

ALTER TABLE `Product`
  ADD `brand_id` CHAR(36) NOT NULL;

ALTER TABLE `Product`
  ADD CONSTRAINT `fk_Product_brand_id` FOREIGN KEY (`brand_id`) REFERENCES `Brand`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_Product_brand_id` ON `Product`(`brand_id`);

CREATE TABLE `product_category_link` (
  `product_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`product_id`, `category_id`),
  CONSTRAINT `fk_product_category_link_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_category_link_category_id` FOREIGN KEY (`category_id`) REFERENCES `Category`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX `idx_pcl_product_id` ON `product_category_link`(`product_id`);
CREATE INDEX `idx_pcl_category_id` ON `product_category_link`(`category_id`);

ALTER TABLE `Cart`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Cart`
  ADD CONSTRAINT `fk_Cart_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

ALTER TABLE `Cart`
  ADD CONSTRAINT `uq_Cart_customer_id` UNIQUE (`customer_id`);

ALTER TABLE `CartItem`
  ADD `cart_id` CHAR(36) NOT NULL;

ALTER TABLE `CartItem`
  ADD CONSTRAINT `fk_CartItem_cart_id` FOREIGN KEY (`cart_id`) REFERENCES `Cart`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_CartItem_cart_id` ON `CartItem`(`cart_id`);

ALTER TABLE `CartItem`
  ADD `product_id` CHAR(36) NOT NULL;

ALTER TABLE `CartItem`
  ADD CONSTRAINT `fk_CartItem_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_CartItem_product_id` ON `CartItem`(`product_id`);

ALTER TABLE `Order`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Order`
  ADD CONSTRAINT `fk_Order_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Order_customer_id` ON `Order`(`customer_id`);

ALTER TABLE `Order`
  ADD `shipping_address_id` CHAR(36) NOT NULL;

ALTER TABLE `Order`
  ADD CONSTRAINT `fk_Order_shipping_address_id` FOREIGN KEY (`shipping_address_id`) REFERENCES `Address`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_Order_shipping_address_id` ON `Order`(`shipping_address_id`);

ALTER TABLE `OrderItem`
  ADD `order_id` CHAR(36) NOT NULL;

ALTER TABLE `OrderItem`
  ADD CONSTRAINT `fk_OrderItem_order_id` FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_OrderItem_order_id` ON `OrderItem`(`order_id`);

ALTER TABLE `OrderItem`
  ADD `product_id` CHAR(36) NOT NULL;

ALTER TABLE `OrderItem`
  ADD CONSTRAINT `fk_OrderItem_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT;

CREATE INDEX `idx_OrderItem_product_id` ON `OrderItem`(`product_id`);

ALTER TABLE `Payment`
  ADD `order_id` CHAR(36) NOT NULL;

ALTER TABLE `Payment`
  ADD CONSTRAINT `fk_Payment_order_id` FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `uq_Payment_order_id` UNIQUE (`order_id`);

ALTER TABLE `Shipment`
  ADD `order_id` CHAR(36) NOT NULL;

ALTER TABLE `Shipment`
  ADD CONSTRAINT `fk_Shipment_order_id` FOREIGN KEY (`order_id`) REFERENCES `Order`(`id`) ON DELETE CASCADE;

ALTER TABLE `Shipment`
  ADD CONSTRAINT `uq_Shipment_order_id` UNIQUE (`order_id`);

ALTER TABLE `Review`
  ADD `customer_id` CHAR(36) NOT NULL;

ALTER TABLE `Review`
  ADD CONSTRAINT `fk_Review_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `Customer`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Review_customer_id` ON `Review`(`customer_id`);

ALTER TABLE `Review`
  ADD `product_id` CHAR(36) NOT NULL;

ALTER TABLE `Review`
  ADD CONSTRAINT `fk_Review_product_id` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE;

CREATE INDEX `idx_Review_product_id` ON `Review`(`product_id`);

SELECT '--- End Case: 09_BigShop_Ecommerce_Model (MySQL) ---' AS marker;
