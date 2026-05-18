/**
 * tenant-setup.ts
 *
 * Provisionamiento de un nuevo tenant: crea el PG schema, las tablas del
 * schema "tenant" del Prisma Schema y los roles + permisos por defecto.
 *
 * Se ejecuta:
 *   - Al crear un nuevo tenant (registro de empresa)
 *   - En el proceso de onboarding inicial
 *
 * Estrategia de creación de tablas:
 *   Ejecutamos el DDL directamente via $executeRawUnsafe dentro de una
 *   transacción, ya que Prisma no soporta migraciones cross-schema dinámicas.
 *   El SQL replica fielmente los modelos del schema "tenant" en prisma/schema.prisma.
 *
 * IMPORTANTE: Este archivo debe mantenerse sincronizado con prisma/schema.prisma.
 * Cuando se modifiquen modelos del schema "tenant", actualizar el SQL aquí.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import prisma from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Factory de cliente Prisma con adapter (Prisma v7 requiere adapter)
// ---------------------------------------------------------------------------
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.")
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// ---------------------------------------------------------------------------
// Módulos y acciones disponibles en el sistema (sincronizar con Permission model)
// ---------------------------------------------------------------------------
const SYSTEM_PERMISSIONS = [
  // Clientes
  { module: "customers", action: "create" },
  { module: "customers", action: "read" },
  { module: "customers", action: "update" },
  { module: "customers", action: "delete" },
  { module: "customers", action: "export" },
  // Proveedores
  { module: "suppliers", action: "create" },
  { module: "suppliers", action: "read" },
  { module: "suppliers", action: "update" },
  { module: "suppliers", action: "delete" },
  { module: "suppliers", action: "export" },
  // Productos
  { module: "products", action: "create" },
  { module: "products", action: "read" },
  { module: "products", action: "update" },
  { module: "products", action: "delete" },
  { module: "products", action: "export" },
  // Inventario
  { module: "inventory", action: "create" },
  { module: "inventory", action: "read" },
  { module: "inventory", action: "update" },
  { module: "inventory", action: "delete" },
  { module: "inventory", action: "export" },
  // Facturación
  { module: "invoices", action: "create" },
  { module: "invoices", action: "read" },
  { module: "invoices", action: "update" },
  { module: "invoices", action: "delete" },
  { module: "invoices", action: "cancel" },
  { module: "invoices", action: "export" },
  // Ventas
  { module: "sales", action: "create" },
  { module: "sales", action: "read" },
  { module: "sales", action: "update" },
  { module: "sales", action: "delete" },
  { module: "sales", action: "approve" },
  { module: "sales", action: "export" },
  // Compras
  { module: "purchases", action: "create" },
  { module: "purchases", action: "read" },
  { module: "purchases", action: "update" },
  { module: "purchases", action: "delete" },
  { module: "purchases", action: "approve" },
  { module: "purchases", action: "export" },
  // Tesorería
  { module: "treasury", action: "create" },
  { module: "treasury", action: "read" },
  { module: "treasury", action: "update" },
  { module: "treasury", action: "delete" },
  { module: "treasury", action: "export" },
  // Reportes
  { module: "reports", action: "read" },
  { module: "reports", action: "export" },
  // Configuración
  { module: "config", action: "read" },
  { module: "config", action: "update" },
  // Usuarios
  { module: "users", action: "create" },
  { module: "users", action: "read" },
  { module: "users", action: "update" },
  { module: "users", action: "delete" },
]

// Roles del sistema — no pueden eliminarse
const SYSTEM_ROLES = [
  {
    name: "Admin",
    description: "Acceso total al sistema",
    isDefault: false,
    isSystem: true,
    // El Admin recibe TODOS los permisos
    allPermissions: true,
  },
  {
    name: "Supervisor",
    description: "Acceso a la mayoría de funciones, sin configuración",
    isDefault: false,
    isSystem: true,
    allPermissions: false,
    // Excluye módulos de configuración y eliminación de usuarios
    excludeModules: ["config"],
    excludeActions: ["delete"],
  },
  {
    name: "Vendedor",
    description: "Gestión de clientes, ventas y facturación",
    isDefault: true,
    isSystem: true,
    allPermissions: false,
    onlyModules: ["customers", "invoices", "sales", "products", "reports"],
    onlyActions: ["create", "read", "update", "export"],
  },
  {
    name: "Depósito",
    description: "Gestión de inventario y recepciones de compras",
    isDefault: false,
    isSystem: true,
    allPermissions: false,
    onlyModules: ["inventory", "products", "purchases"],
    onlyActions: ["create", "read", "update", "export"],
  },
  {
    name: "Contabilidad",
    description: "Acceso a facturación, compras, tesorería y reportes",
    isDefault: false,
    isSystem: true,
    allPermissions: false,
    onlyModules: ["invoices", "purchases", "treasury", "reports", "customers", "suppliers"],
    onlyActions: ["read", "export", "create", "update"],
  },
  {
    name: "Solo lectura",
    description: "Solo puede consultar información, sin modificaciones",
    isDefault: false,
    isSystem: true,
    allPermissions: false,
    onlyActions: ["read"],
  },
]

// ---------------------------------------------------------------------------
// DDL — Tipos ENUM del schema tenant
// ---------------------------------------------------------------------------
function buildEnumsDDL(schema: string): string {
  return `
    -- Enums del schema tenant
    DO $$ BEGIN
      CREATE TYPE "${schema}"."VatCondition" AS ENUM (
        'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'CONSUMIDOR_FINAL', 'EXENTO'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."DocumentType" AS ENUM (
        'CUIT', 'CUIL', 'DNI', 'PASSPORT', 'OTHER'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PersonType" AS ENUM ('INDIVIDUAL', 'COMPANY');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."AddressType" AS ENUM ('FISCAL', 'DELIVERY', 'BILLING', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."StockMovementType" AS ENUM (
        'PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
        'LOSS', 'RETURN', 'INVENTORY_COUNT'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."BatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DEPLETED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."SerialStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'SOLD', 'DEFECTIVE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."VoucherType" AS ENUM (
        'FACTURA_A', 'FACTURA_B', 'FACTURA_C',
        'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C',
        'NOTA_DEBITO_A', 'NOTA_DEBITO_B', 'NOTA_DEBITO_C',
        'REMITO', 'PRESUPUESTO', 'ORDEN_COMPRA', 'RECIBO'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'PAID', 'PARTIAL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."SaleOrderStatus" AS ENUM (
        'PENDING', 'CONFIRMED', 'PREPARING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PurchaseOrderStatus" AS ENUM (
        'DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PurchaseRequestStatus" AS ENUM (
        'PENDING', 'APPROVED', 'REJECTED', 'ORDERED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."SupplierInvoiceStatus" AS ENUM (
        'PENDING', 'RECONCILED', 'PAID', 'CANCELLED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."TaxType" AS ENUM (
        'IVA', 'PERCEPCION_IVA', 'PERCEPCION_IIBB', 'MUNICIPAL', 'OTHER'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PaymentMethodType" AS ENUM (
        'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER',
        'CHECK', 'MERCADO_PAGO', 'CURRENT_ACCOUNT', 'OTHER'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PaymentDirection" AS ENUM ('CUSTOMER', 'SUPPLIER', 'INTERNAL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."CheckType" AS ENUM ('OWN', 'THIRD_PARTY');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."CheckStatus" AS ENUM (
        'IN_WALLET', 'DEPOSITED', 'ENDORSED', 'REJECTED', 'CANCELLED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "${schema}"."CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `
}

// ---------------------------------------------------------------------------
// DDL — Tablas del schema tenant (en orden de dependencias)
// ---------------------------------------------------------------------------
function buildTablesDDL(schema: string): string {
  return `
    SET search_path TO "${schema}", public;

    -- Configuración general del tenant
    CREATE TABLE IF NOT EXISTS "TenantConfig" (
      "id" TEXT PRIMARY KEY,
      "companyName" TEXT NOT NULL,
      "tradeName" TEXT,
      "documentType" "${schema}"."DocumentType" NOT NULL DEFAULT 'CUIT',
      "documentNumber" TEXT NOT NULL,
      "vatCondition" "${schema}"."VatCondition" NOT NULL DEFAULT 'RESPONSABLE_INSCRIPTO',
      "grossIncomeNumber" TEXT,
      "address" TEXT,
      "city" TEXT,
      "state" TEXT,
      "country" TEXT NOT NULL DEFAULT 'Argentina',
      "postalCode" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "website" TEXT,
      "logoUrl" TEXT,
      "primaryColor" TEXT DEFAULT '#2563eb',
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
      "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
      "afipEnvironment" TEXT DEFAULT 'testing',
      "afipCertificate" TEXT,
      "afipPrivateKey" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Roles del tenant
    CREATE TABLE IF NOT EXISTS "Role" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "name")
    );

    -- Permisos por rol
    CREATE TABLE IF NOT EXISTS "RolePermission" (
      "roleId" TEXT NOT NULL REFERENCES "${schema}"."Role"("id") ON DELETE CASCADE,
      "permissionId" TEXT NOT NULL,
      PRIMARY KEY ("roleId", "permissionId")
    );

    -- Sucursales
    CREATE TABLE IF NOT EXISTS "Branch" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "address" TEXT,
      "city" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "isMain" BOOLEAN NOT NULL DEFAULT FALSE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "name")
    );

    -- Depósitos
    CREATE TABLE IF NOT EXISTS "Warehouse" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "branchId" TEXT NOT NULL REFERENCES "${schema}"."Branch"("id"),
      "name" TEXT NOT NULL,
      "description" TEXT,
      "address" TEXT,
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "name")
    );

    -- Alícuotas impositivas
    CREATE TABLE IF NOT EXISTS "TaxRate" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" "${schema}"."TaxType" NOT NULL,
      "rate" DECIMAL(8,6) NOT NULL,
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "name")
    );

    -- Condiciones de pago
    CREATE TABLE IF NOT EXISTS "PaymentCondition" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "days" INTEGER NOT NULL DEFAULT 0,
      "description" TEXT,
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "name")
    );

    -- Unidades de medida
    CREATE TABLE IF NOT EXISTS "UnitOfMeasure" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "abbreviation" TEXT NOT NULL,
      "isBase" BOOLEAN NOT NULL DEFAULT FALSE,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "abbreviation")
    );

    -- Categorías de clientes
    CREATE TABLE IF NOT EXISTS "CustomerCategory" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "color" TEXT DEFAULT '#6366f1',
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "name")
    );

    -- Listas de precios (definida antes de Customer por la FK)
    CREATE TABLE IF NOT EXISTS "PriceList" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "validFrom" TIMESTAMPTZ,
      "validTo" TIMESTAMPTZ,
      "notes" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "name")
    );

    -- Clientes
    CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "categoryId" TEXT REFERENCES "${schema}"."CustomerCategory"("id"),
      "priceListId" TEXT REFERENCES "${schema}"."PriceList"("id"),
      "type" "${schema}"."PersonType" NOT NULL DEFAULT 'COMPANY',
      "firstName" TEXT,
      "lastName" TEXT,
      "companyName" TEXT,
      "documentType" "${schema}"."DocumentType" NOT NULL DEFAULT 'CUIT',
      "documentNumber" TEXT,
      "vatCondition" "${schema}"."VatCondition" NOT NULL DEFAULT 'CONSUMIDOR_FINAL',
      "grossIncomeNumber" TEXT,
      "creditLimit" DECIMAL(12,2),
      "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "phone" TEXT,
      "email" TEXT,
      "website" TEXT,
      "notes" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      "updatedById" TEXT
    );
    CREATE INDEX IF NOT EXISTS "Customer_tenantId_documentNumber_idx" ON "${schema}"."Customer" ("tenantId", "documentNumber");
    CREATE INDEX IF NOT EXISTS "Customer_tenantId_companyName_idx" ON "${schema}"."Customer" ("tenantId", "companyName");
    CREATE INDEX IF NOT EXISTS "Customer_tenantId_isActive_idx" ON "${schema}"."Customer" ("tenantId", "isActive");

    -- Direcciones de clientes
    CREATE TABLE IF NOT EXISTS "CustomerAddress" (
      "id" TEXT PRIMARY KEY,
      "customerId" TEXT NOT NULL REFERENCES "${schema}"."Customer"("id"),
      "type" "${schema}"."AddressType" NOT NULL DEFAULT 'FISCAL',
      "street" TEXT NOT NULL,
      "number" TEXT,
      "floor" TEXT,
      "apartment" TEXT,
      "city" TEXT,
      "state" TEXT,
      "postalCode" TEXT,
      "country" TEXT NOT NULL DEFAULT 'Argentina',
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Contactos de clientes
    CREATE TABLE IF NOT EXISTS "CustomerContact" (
      "id" TEXT PRIMARY KEY,
      "customerId" TEXT NOT NULL REFERENCES "${schema}"."Customer"("id"),
      "name" TEXT NOT NULL,
      "role" TEXT,
      "phone" TEXT,
      "mobile" TEXT,
      "email" TEXT,
      "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Proveedores
    CREATE TABLE IF NOT EXISTS "Supplier" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "type" "${schema}"."PersonType" NOT NULL DEFAULT 'COMPANY',
      "firstName" TEXT,
      "lastName" TEXT,
      "companyName" TEXT,
      "documentType" "${schema}"."DocumentType" NOT NULL DEFAULT 'CUIT',
      "documentNumber" TEXT,
      "vatCondition" "${schema}"."VatCondition" NOT NULL DEFAULT 'RESPONSABLE_INSCRIPTO',
      "paymentConditionId" TEXT REFERENCES "${schema}"."PaymentCondition"("id"),
      "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "creditLimit" DECIMAL(12,2),
      "phone" TEXT,
      "email" TEXT,
      "website" TEXT,
      "notes" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      "updatedById" TEXT
    );
    CREATE INDEX IF NOT EXISTS "Supplier_tenantId_documentNumber_idx" ON "${schema}"."Supplier" ("tenantId", "documentNumber");
    CREATE INDEX IF NOT EXISTS "Supplier_tenantId_companyName_idx" ON "${schema}"."Supplier" ("tenantId", "companyName");

    -- Direcciones de proveedores
    CREATE TABLE IF NOT EXISTS "SupplierAddress" (
      "id" TEXT PRIMARY KEY,
      "supplierId" TEXT NOT NULL REFERENCES "${schema}"."Supplier"("id"),
      "type" "${schema}"."AddressType" NOT NULL DEFAULT 'FISCAL',
      "street" TEXT NOT NULL,
      "number" TEXT,
      "floor" TEXT,
      "apartment" TEXT,
      "city" TEXT,
      "state" TEXT,
      "postalCode" TEXT,
      "country" TEXT NOT NULL DEFAULT 'Argentina',
      "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Contactos de proveedores
    CREATE TABLE IF NOT EXISTS "SupplierContact" (
      "id" TEXT PRIMARY KEY,
      "supplierId" TEXT NOT NULL REFERENCES "${schema}"."Supplier"("id"),
      "name" TEXT NOT NULL,
      "role" TEXT,
      "phone" TEXT,
      "mobile" TEXT,
      "email" TEXT,
      "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Categorías de productos (auto-referencial)
    CREATE TABLE IF NOT EXISTS "ProductCategory" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "parentId" TEXT REFERENCES "${schema}"."ProductCategory"("id"),
      "name" TEXT NOT NULL,
      "slug" TEXT,
      "description" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "name", "parentId")
    );

    -- Productos
    CREATE TABLE IF NOT EXISTS "Product" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "categoryId" TEXT REFERENCES "${schema}"."ProductCategory"("id"),
      "unitId" TEXT REFERENCES "${schema}"."UnitOfMeasure"("id"),
      "internalCode" TEXT,
      "barcode" TEXT,
      "sku" TEXT,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "trackStock" BOOLEAN NOT NULL DEFAULT TRUE,
      "trackBatches" BOOLEAN NOT NULL DEFAULT FALSE,
      "trackSerials" BOOLEAN NOT NULL DEFAULT FALSE,
      "allowNegative" BOOLEAN NOT NULL DEFAULT FALSE,
      "minStock" DECIMAL(12,4),
      "maxStock" DECIMAL(12,4),
      "reorderPoint" DECIMAL(12,4),
      "costPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "averageCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "lastCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "defaultMargin" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "weight" DECIMAL(10,4),
      "weightUnit" TEXT DEFAULT 'kg',
      "status" "${schema}"."ProductStatus" NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      "updatedById" TEXT,
      UNIQUE ("tenantId", "internalCode"),
      UNIQUE ("tenantId", "barcode")
    );
    CREATE INDEX IF NOT EXISTS "Product_tenantId_name_idx" ON "${schema}"."Product" ("tenantId", "name");
    CREATE INDEX IF NOT EXISTS "Product_tenantId_status_idx" ON "${schema}"."Product" ("tenantId", "status");

    -- Imágenes de productos
    CREATE TABLE IF NOT EXISTS "ProductImage" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "url" TEXT NOT NULL,
      "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
      "order" INTEGER NOT NULL DEFAULT 0,
      "altText" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Stock por producto y depósito
    CREATE TABLE IF NOT EXISTS "Stock" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "warehouseId" TEXT NOT NULL REFERENCES "${schema}"."Warehouse"("id"),
      "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "reservedQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("productId", "warehouseId")
    );

    -- Lotes
    CREATE TABLE IF NOT EXISTS "Batch" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "warehouseId" TEXT NOT NULL REFERENCES "${schema}"."Warehouse"("id"),
      "batchNumber" TEXT NOT NULL,
      "expiryDate" TIMESTAMPTZ,
      "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "initialQty" DECIMAL(12,4) NOT NULL,
      "unitCost" DECIMAL(12,4),
      "status" "${schema}"."BatchStatus" NOT NULL DEFAULT 'ACTIVE',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("productId", "warehouseId", "batchNumber")
    );

    -- Números de serie
    CREATE TABLE IF NOT EXISTS "SerialNumber" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "warehouseId" TEXT REFERENCES "${schema}"."Warehouse"("id"),
      "serial" TEXT NOT NULL,
      "status" "${schema}"."SerialStatus" NOT NULL DEFAULT 'IN_STOCK',
      "unitCost" DECIMAL(12,4),
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("productId", "serial")
    );

    -- Movimientos de stock
    CREATE TABLE IF NOT EXISTS "StockMovement" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "warehouseId" TEXT NOT NULL REFERENCES "${schema}"."Warehouse"("id"),
      "type" "${schema}"."StockMovementType" NOT NULL,
      "quantity" DECIMAL(12,4) NOT NULL,
      "previousStock" DECIMAL(12,4) NOT NULL,
      "newStock" DECIMAL(12,4) NOT NULL,
      "unitCost" DECIMAL(12,4),
      "referenceType" TEXT,
      "referenceId" TEXT,
      "batchId" TEXT REFERENCES "${schema}"."Batch"("id"),
      "serialId" TEXT REFERENCES "${schema}"."SerialNumber"("id"),
      "reason" TEXT,
      "notes" TEXT,
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdById" TEXT
    );
    CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_productId_date_idx" ON "${schema}"."StockMovement" ("tenantId", "productId", "date");
    CREATE INDEX IF NOT EXISTS "StockMovement_referenceType_referenceId_idx" ON "${schema}"."StockMovement" ("referenceType", "referenceId");

    -- Historial de precios de proveedor/producto
    CREATE TABLE IF NOT EXISTS "SupplierProductHistory" (
      "id" TEXT PRIMARY KEY,
      "supplierId" TEXT NOT NULL REFERENCES "${schema}"."Supplier"("id"),
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "price" DECIMAL(12,4) NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "purchaseOrderId" TEXT
    );
    CREATE INDEX IF NOT EXISTS "SupplierProductHistory_supplierId_productId_idx" ON "${schema}"."SupplierProductHistory" ("supplierId", "productId");

    -- Ítems de listas de precios
    CREATE TABLE IF NOT EXISTS "PriceListItem" (
      "id" TEXT PRIMARY KEY,
      "priceListId" TEXT NOT NULL REFERENCES "${schema}"."PriceList"("id") ON DELETE CASCADE,
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "price" DECIMAL(12,4) NOT NULL,
      "margin" DECIMAL(6,4),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("priceListId", "productId")
    );

    -- Descuentos por volumen
    CREATE TABLE IF NOT EXISTS "VolumeDiscount" (
      "id" TEXT PRIMARY KEY,
      "priceListItemId" TEXT NOT NULL REFERENCES "${schema}"."PriceListItem"("id") ON DELETE CASCADE,
      "minQuantity" DECIMAL(12,4) NOT NULL,
      "maxQuantity" DECIMAL(12,4),
      "discountPercent" DECIMAL(6,4),
      "fixedPrice" DECIMAL(12,4)
    );

    -- Precios especiales por cliente
    CREATE TABLE IF NOT EXISTS "CustomerSpecialPrice" (
      "id" TEXT PRIMARY KEY,
      "customerId" TEXT NOT NULL REFERENCES "${schema}"."Customer"("id"),
      "productId" TEXT NOT NULL REFERENCES "${schema}"."Product"("id"),
      "price" DECIMAL(12,4) NOT NULL,
      "validFrom" TIMESTAMPTZ,
      "validTo" TIMESTAMPTZ,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("customerId", "productId")
    );

    -- Puntos de venta AFIP
    CREATE TABLE IF NOT EXISTS "PointOfSale" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "branchId" TEXT REFERENCES "${schema}"."Branch"("id"),
      "number" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "address" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "number")
    );

    -- Series de numeración por tipo de comprobante
    CREATE TABLE IF NOT EXISTS "VoucherSeries" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "pointOfSaleId" TEXT NOT NULL REFERENCES "${schema}"."PointOfSale"("id"),
      "voucherType" "${schema}"."VoucherType" NOT NULL,
      "currentNumber" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "pointOfSaleId", "voucherType")
    );

    -- Vendedores
    CREATE TABLE IF NOT EXISTS "Salesperson" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "userId" TEXT,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "commissionRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );

    -- Facturas (depende de Customer, PointOfSale, Salesperson)
    CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "pointOfSaleId" TEXT NOT NULL REFERENCES "${schema}"."PointOfSale"("id"),
      "voucherType" "${schema}"."VoucherType" NOT NULL,
      "number" INTEGER NOT NULL,
      "fullNumber" TEXT NOT NULL,
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "dueDate" TIMESTAMPTZ,
      "customerId" TEXT REFERENCES "${schema}"."Customer"("id"),
      "customerSnapshot" JSONB,
      "paymentConditionId" TEXT REFERENCES "${schema}"."PaymentCondition"("id"),
      "salespersonId" TEXT REFERENCES "${schema}"."Salesperson"("id"),
      "originInvoiceId" TEXT REFERENCES "${schema}"."Invoice"("id"),
      "saleOrderId" TEXT,
      "subtotal" DECIMAL(12,2) NOT NULL,
      "discountPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "taxableBase" DECIMAL(12,2) NOT NULL,
      "taxAmount" DECIMAL(12,2) NOT NULL,
      "total" DECIMAL(12,2) NOT NULL,
      "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
      "status" "${schema}"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
      "cae" TEXT,
      "caeExpiry" TIMESTAMPTZ,
      "afipResult" JSONB,
      "notes" TEXT,
      "internalNotes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      "updatedById" TEXT,
      UNIQUE ("tenantId", "pointOfSaleId", "voucherType", "number")
    );
    CREATE INDEX IF NOT EXISTS "Invoice_tenantId_customerId_idx" ON "${schema}"."Invoice" ("tenantId", "customerId");
    CREATE INDEX IF NOT EXISTS "Invoice_tenantId_date_idx" ON "${schema}"."Invoice" ("tenantId", "date");
    CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_idx" ON "${schema}"."Invoice" ("tenantId", "status");

    -- Ítems de factura
    CREATE TABLE IF NOT EXISTS "InvoiceItem" (
      "id" TEXT PRIMARY KEY,
      "invoiceId" TEXT NOT NULL REFERENCES "${schema}"."Invoice"("id") ON DELETE CASCADE,
      "productId" TEXT REFERENCES "${schema}"."Product"("id"),
      "description" TEXT NOT NULL,
      "quantity" DECIMAL(12,4) NOT NULL,
      "unitPrice" DECIMAL(12,4) NOT NULL,
      "discountPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "discountAmount" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "taxRateId" TEXT REFERENCES "${schema}"."TaxRate"("id"),
      "taxPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "taxAmount" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "subtotal" DECIMAL(12,4) NOT NULL,
      "total" DECIMAL(12,4) NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0
    );

    -- Resumen de impuestos por factura
    CREATE TABLE IF NOT EXISTS "InvoiceTax" (
      "id" TEXT PRIMARY KEY,
      "invoiceId" TEXT NOT NULL REFERENCES "${schema}"."Invoice"("id") ON DELETE CASCADE,
      "taxRateId" TEXT NOT NULL REFERENCES "${schema}"."TaxRate"("id"),
      "base" DECIMAL(12,2) NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL
    );

    -- Órdenes de venta
    CREATE TABLE IF NOT EXISTS "SaleOrder" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "number" TEXT NOT NULL,
      "customerId" TEXT NOT NULL REFERENCES "${schema}"."Customer"("id"),
      "salespersonId" TEXT REFERENCES "${schema}"."Salesperson"("id"),
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expectedDelivery" TIMESTAMPTZ,
      "deliveryAddress" JSONB,
      "status" "${schema}"."SaleOrderStatus" NOT NULL DEFAULT 'PENDING',
      "subtotal" DECIMAL(12,2) NOT NULL,
      "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "taxAmount" DECIMAL(12,2) NOT NULL,
      "total" DECIMAL(12,2) NOT NULL,
      "notes" TEXT,
      "internalNotes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      UNIQUE ("tenantId", "number")
    );
    CREATE INDEX IF NOT EXISTS "SaleOrder_tenantId_customerId_idx" ON "${schema}"."SaleOrder" ("tenantId", "customerId");
    CREATE INDEX IF NOT EXISTS "SaleOrder_tenantId_status_idx" ON "${schema}"."SaleOrder" ("tenantId", "status");

    -- Ítems de orden de venta
    CREATE TABLE IF NOT EXISTS "SaleOrderItem" (
      "id" TEXT PRIMARY KEY,
      "saleOrderId" TEXT NOT NULL REFERENCES "${schema}"."SaleOrder"("id") ON DELETE CASCADE,
      "productId" TEXT REFERENCES "${schema}"."Product"("id"),
      "description" TEXT NOT NULL,
      "quantity" DECIMAL(12,4) NOT NULL,
      "deliveredQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "unitPrice" DECIMAL(12,4) NOT NULL,
      "discountPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "taxPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "subtotal" DECIMAL(12,4) NOT NULL,
      "taxAmount" DECIMAL(12,4) NOT NULL,
      "total" DECIMAL(12,4) NOT NULL,
      "warehouseId" TEXT,
      "order" INTEGER NOT NULL DEFAULT 0
    );

    -- Solicitudes de compra
    CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "number" TEXT NOT NULL,
      "requesterId" TEXT,
      "warehouseId" TEXT,
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "status" "${schema}"."PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      UNIQUE ("tenantId", "number")
    );

    -- Ítems de solicitud de compra
    CREATE TABLE IF NOT EXISTS "PurchaseRequestItem" (
      "id" TEXT PRIMARY KEY,
      "purchaseRequestId" TEXT NOT NULL REFERENCES "${schema}"."PurchaseRequest"("id") ON DELETE CASCADE,
      "productId" TEXT REFERENCES "${schema}"."Product"("id"),
      "description" TEXT NOT NULL,
      "quantity" DECIMAL(12,4) NOT NULL,
      "estimatedPrice" DECIMAL(12,4),
      "notes" TEXT
    );

    -- Órdenes de compra
    CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "number" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL REFERENCES "${schema}"."Supplier"("id"),
      "purchaseRequestId" TEXT REFERENCES "${schema}"."PurchaseRequest"("id"),
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expectedDelivery" TIMESTAMPTZ,
      "status" "${schema}"."PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
      "subtotal" DECIMAL(12,2) NOT NULL,
      "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "total" DECIMAL(12,2) NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT,
      UNIQUE ("tenantId", "number")
    );
    CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_supplierId_idx" ON "${schema}"."PurchaseOrder" ("tenantId", "supplierId");

    -- Ítems de orden de compra
    CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
      "id" TEXT PRIMARY KEY,
      "purchaseOrderId" TEXT NOT NULL REFERENCES "${schema}"."PurchaseOrder"("id") ON DELETE CASCADE,
      "productId" TEXT REFERENCES "${schema}"."Product"("id"),
      "taxRateId" TEXT REFERENCES "${schema}"."TaxRate"("id"),
      "description" TEXT NOT NULL,
      "quantity" DECIMAL(12,4) NOT NULL,
      "receivedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "unitPrice" DECIMAL(12,4) NOT NULL,
      "taxPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "subtotal" DECIMAL(12,4) NOT NULL,
      "taxAmount" DECIMAL(12,4) NOT NULL DEFAULT 0,
      "total" DECIMAL(12,4) NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0
    );

    -- Remitos de recepción
    CREATE TABLE IF NOT EXISTS "PurchaseReceipt" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "purchaseOrderId" TEXT REFERENCES "${schema}"."PurchaseOrder"("id"),
      "supplierId" TEXT REFERENCES "${schema}"."Supplier"("id"),
      "warehouseId" TEXT NOT NULL REFERENCES "${schema}"."Warehouse"("id"),
      "number" TEXT NOT NULL,
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdById" TEXT,
      UNIQUE ("tenantId", "number")
    );

    -- Ítems de remito de recepción
    CREATE TABLE IF NOT EXISTS "PurchaseReceiptItem" (
      "id" TEXT PRIMARY KEY,
      "purchaseReceiptId" TEXT NOT NULL REFERENCES "${schema}"."PurchaseReceipt"("id") ON DELETE CASCADE,
      "purchaseOrderItemId" TEXT REFERENCES "${schema}"."PurchaseOrderItem"("id"),
      "productId" TEXT,
      "quantity" DECIMAL(12,4) NOT NULL,
      "unitCost" DECIMAL(12,4),
      "batchNumber" TEXT,
      "expiryDate" TIMESTAMPTZ,
      "serialNumbers" TEXT[] NOT NULL DEFAULT '{}'
    );

    -- Facturas de proveedor
    CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "supplierId" TEXT NOT NULL REFERENCES "${schema}"."Supplier"("id"),
      "purchaseOrderId" TEXT REFERENCES "${schema}"."PurchaseOrder"("id"),
      "invoiceNumber" TEXT NOT NULL,
      "invoiceDate" TIMESTAMPTZ NOT NULL,
      "dueDate" TIMESTAMPTZ,
      "subtotal" DECIMAL(12,2) NOT NULL,
      "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "total" DECIMAL(12,2) NOT NULL,
      "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "status" "${schema}"."SupplierInvoiceStatus" NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "createdById" TEXT
    );
    CREATE INDEX IF NOT EXISTS "SupplierInvoice_tenantId_supplierId_idx" ON "${schema}"."SupplierInvoice" ("tenantId", "supplierId");
    CREATE INDEX IF NOT EXISTS "SupplierInvoice_tenantId_status_idx" ON "${schema}"."SupplierInvoice" ("tenantId", "status");

    -- Medios de pago
    CREATE TABLE IF NOT EXISTS "PaymentMethod" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" "${schema}"."PaymentMethodType" NOT NULL,
      "surchargePercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "order" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "name")
    );

    -- Cajas
    CREATE TABLE IF NOT EXISTS "CashRegister" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "branchId" TEXT NOT NULL REFERENCES "${schema}"."Branch"("id"),
      "name" TEXT NOT NULL,
      "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "branchId", "name")
    );

    -- Sesiones de caja
    CREATE TABLE IF NOT EXISTS "CashSession" (
      "id" TEXT PRIMARY KEY,
      "cashRegisterId" TEXT NOT NULL REFERENCES "${schema}"."CashRegister"("id"),
      "userId" TEXT,
      "openedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "closedAt" TIMESTAMPTZ,
      "openingBalance" DECIMAL(12,2) NOT NULL,
      "closingBalance" DECIMAL(12,2),
      "expectedBalance" DECIMAL(12,2),
      "difference" DECIMAL(12,2),
      "status" "${schema}"."CashSessionStatus" NOT NULL DEFAULT 'OPEN',
      "notes" TEXT
    );

    -- Cuentas bancarias
    CREATE TABLE IF NOT EXISTS "BankAccount" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "bankName" TEXT NOT NULL,
      "accountType" "${schema}"."BankAccountType" NOT NULL DEFAULT 'CHECKING',
      "accountNumber" TEXT,
      "cbu" TEXT,
      "alias" TEXT,
      "currency" TEXT NOT NULL DEFAULT 'ARS',
      "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Cheques
    CREATE TABLE IF NOT EXISTS "Check" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "type" "${schema}"."CheckType" NOT NULL,
      "number" TEXT NOT NULL,
      "bankName" TEXT NOT NULL,
      "bankBranch" TEXT,
      "accountNumber" TEXT,
      "amount" DECIMAL(12,2) NOT NULL,
      "issueDate" TIMESTAMPTZ NOT NULL,
      "dueDate" TIMESTAMPTZ NOT NULL,
      "customerId" TEXT REFERENCES "${schema}"."Customer"("id"),
      "drawerName" TEXT,
      "supplierId" TEXT REFERENCES "${schema}"."Supplier"("id"),
      "status" "${schema}"."CheckStatus" NOT NULL DEFAULT 'IN_WALLET',
      "endorsedTo" TEXT,
      "rejectedReason" TEXT,
      "bankAccountId" TEXT REFERENCES "${schema}"."BankAccount"("id"),
      "bankTransactionId" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "Check_tenantId_status_idx" ON "${schema}"."Check" ("tenantId", "status");
    CREATE INDEX IF NOT EXISTS "Check_tenantId_dueDate_idx" ON "${schema}"."Check" ("tenantId", "dueDate");

    -- Pagos/cobros
    CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "cashSessionId" TEXT REFERENCES "${schema}"."CashSession"("id"),
      "direction" "${schema}"."PaymentDirection" NOT NULL,
      "customerId" TEXT REFERENCES "${schema}"."Customer"("id"),
      "supplierId" TEXT REFERENCES "${schema}"."Supplier"("id"),
      "date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "total" DECIMAL(12,2) NOT NULL,
      "reference" TEXT,
      "notes" TEXT,
      "status" "${schema}"."PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdById" TEXT
    );
    CREATE INDEX IF NOT EXISTS "Payment_tenantId_customerId_idx" ON "${schema}"."Payment" ("tenantId", "customerId");
    CREATE INDEX IF NOT EXISTS "Payment_tenantId_supplierId_idx" ON "${schema}"."Payment" ("tenantId", "supplierId");
    CREATE INDEX IF NOT EXISTS "Payment_tenantId_date_idx" ON "${schema}"."Payment" ("tenantId", "date");

    -- Detalle de pago por medio
    CREATE TABLE IF NOT EXISTS "PaymentItem" (
      "id" TEXT PRIMARY KEY,
      "paymentId" TEXT NOT NULL REFERENCES "${schema}"."Payment"("id") ON DELETE CASCADE,
      "paymentMethodId" TEXT NOT NULL REFERENCES "${schema}"."PaymentMethod"("id"),
      "amount" DECIMAL(12,2) NOT NULL,
      "cardBrand" TEXT,
      "cardLastFour" TEXT,
      "cardInstallments" INTEGER,
      "posTerminalRef" TEXT,
      "bankRef" TEXT,
      "checkId" TEXT REFERENCES "${schema}"."Check"("id")
    );

    -- Movimientos bancarios
    CREATE TABLE IF NOT EXISTS "BankTransaction" (
      "id" TEXT PRIMARY KEY,
      "bankAccountId" TEXT NOT NULL REFERENCES "${schema}"."BankAccount"("id"),
      "date" TIMESTAMPTZ NOT NULL,
      "type" TEXT NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "balance" DECIMAL(12,2) NOT NULL,
      "description" TEXT,
      "reference" TEXT,
      "isReconciled" BOOLEAN NOT NULL DEFAULT FALSE,
      "paymentId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "BankTransaction_bankAccountId_date_idx" ON "${schema}"."BankTransaction" ("bankAccountId", "date");

    -- Vínculo factura-pago
    CREATE TABLE IF NOT EXISTS "InvoicePaymentLink" (
      "id" TEXT PRIMARY KEY,
      "invoiceId" TEXT NOT NULL REFERENCES "${schema}"."Invoice"("id"),
      "paymentId" TEXT NOT NULL REFERENCES "${schema}"."Payment"("id"),
      "amount" DECIMAL(12,2) NOT NULL,
      UNIQUE ("invoiceId", "paymentId")
    );

    -- Auditoría
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "userId" TEXT,
      "entity" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "before" JSONB,
      "after" JSONB,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_entity_entityId_idx" ON "${schema}"."AuditLog" ("tenantId", "entity", "entityId");
    CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "${schema}"."AuditLog" ("tenantId", "createdAt");

    RESET search_path;
  `
}

// ---------------------------------------------------------------------------
// Función principal de provisionamiento
// ---------------------------------------------------------------------------

/**
 * Provisiona un nuevo schema de tenant en PostgreSQL.
 *
 * Pasos:
 *   1. Crea el schema PG si no existe
 *   2. Crea los tipos ENUM del schema tenant
 *   3. Crea todas las tablas del schema tenant
 *   4. Inserta permisos globales en el schema public (si no existen)
 *   5. Crea roles por defecto en el schema tenant
 *   6. Asigna permisos a cada rol según su configuración
 *
 * @param tenantId   ID del tenant (usado en columnas tenantId de cada tabla)
 * @param dbSchema   Nombre del PG schema a crear (ej: "tenant_abc123")
 */
export async function provisionTenantSchema(
  tenantId: string,
  dbSchema: string
): Promise<void> {
  // Validar que el nombre del schema es seguro (solo alfanuméricos y _)
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(dbSchema)) {
    throw new Error(
      `Nombre de schema inválido: "${dbSchema}". ` +
        "Debe empezar con letra minúscula y solo contener letras, números y guiones bajos."
    )
  }

  const client = createClient()

  try {
    // -------------------------------------------------------------------------
    // Paso 1: Crear el schema PG
    // -------------------------------------------------------------------------
    await client.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`
    )

    // -------------------------------------------------------------------------
    // Paso 2 y 3: Crear ENUMs y tablas (en una transacción)
    // -------------------------------------------------------------------------
    const enumsDDL = buildEnumsDDL(dbSchema)
    const tablesDDL = buildTablesDDL(dbSchema)

    // Ejecutamos el DDL en una sola transacción para atomicidad
    await client.$transaction([
      client.$executeRawUnsafe(enumsDDL),
      client.$executeRawUnsafe(tablesDDL),
    ])

    // -------------------------------------------------------------------------
    // Paso 4: Asegurar que existen los permisos globales en el schema public
    // -------------------------------------------------------------------------
    for (const perm of SYSTEM_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { module_action: { module: perm.module, action: perm.action } },
        create: { module: perm.module, action: perm.action },
        update: {},
      })
    }

    // Obtener todos los permisos para mapear module+action → id
    const allPermissions = await prisma.permission.findMany()
    const permMap = new Map(
      allPermissions.map((p) => [`${p.module}:${p.action}`, p.id])
    )

    // -------------------------------------------------------------------------
    // Paso 5 y 6: Crear roles y asignar permisos en el schema tenant
    // -------------------------------------------------------------------------
    for (const roleDef of SYSTEM_ROLES) {
      // Calcular qué permisos corresponden a este rol
      let rolePermIds: string[]

      if (roleDef.allPermissions) {
        rolePermIds = allPermissions.map((p) => p.id)
      } else {
        rolePermIds = allPermissions
          .filter((p) => {
            // Filtrar por módulos permitidos (si se especifica)
            if ("onlyModules" in roleDef && roleDef.onlyModules) {
              if (!roleDef.onlyModules.includes(p.module)) return false
            }
            // Filtrar por módulos excluidos
            if ("excludeModules" in roleDef && roleDef.excludeModules) {
              if (roleDef.excludeModules.includes(p.module)) return false
            }
            // Filtrar por acciones permitidas (si se especifica)
            if ("onlyActions" in roleDef && roleDef.onlyActions) {
              if (!roleDef.onlyActions.includes(p.action)) return false
            }
            // Filtrar por acciones excluidas
            if ("excludeActions" in roleDef && roleDef.excludeActions) {
              if (roleDef.excludeActions.includes(p.action)) return false
            }
            return true
          })
          .map((p) => p.id)
      }

      // Insertar rol en el schema tenant
      const roleId = generateCuid()
      await client.$executeRawUnsafe(
        `INSERT INTO "${dbSchema}"."Role" ("id", "tenantId", "name", "description", "isDefault", "isSystem", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT ("tenantId", "name") DO NOTHING`,
        roleId,
        tenantId,
        roleDef.name,
        roleDef.description,
        roleDef.isDefault,
        roleDef.isSystem
      )

      // Obtener el ID del rol (puede ser diferente si ya existía)
      const existingRole = await client.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "${dbSchema}"."Role" WHERE "tenantId" = $1 AND "name" = $2`,
        tenantId,
        roleDef.name
      )
      const actualRoleId = existingRole[0]?.id
      if (!actualRoleId) continue

      // Insertar permisos del rol
      for (const permId of rolePermIds) {
        await client.$executeRawUnsafe(
          `INSERT INTO "${dbSchema}"."RolePermission" ("roleId", "permissionId")
           VALUES ($1, $2)
           ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
          actualRoleId,
          permId
        )
      }
    }

    // -------------------------------------------------------------------------
    // Datos iniciales opcionales: alícuotas IVA, medios de pago, etc.
    // -------------------------------------------------------------------------
    await seedDefaultData(client, dbSchema, tenantId)
  } finally {
    await client.$disconnect()
  }
}

// ---------------------------------------------------------------------------
// Datos semilla por defecto
// ---------------------------------------------------------------------------

async function seedDefaultData(
  client: PrismaClient,
  dbSchema: string,
  tenantId: string
): Promise<void> {
  const id = generateCuid

  // Alícuotas IVA estándar Argentina
  const taxRates = [
    { name: "IVA 21%", type: "IVA", rate: "0.210000", isDefault: true },
    { name: "IVA 10.5%", type: "IVA", rate: "0.105000", isDefault: false },
    { name: "IVA 27%", type: "IVA", rate: "0.270000", isDefault: false },
    { name: "IVA 0%", type: "IVA", rate: "0.000000", isDefault: false },
    { name: "Exento de IVA", type: "IVA", rate: "0.000000", isDefault: false },
  ]

  for (const tr of taxRates) {
    await client.$executeRawUnsafe(
      `INSERT INTO "${dbSchema}"."TaxRate" ("id", "tenantId", "name", "type", "rate", "isDefault", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::${dbSchema}."TaxType", $5, $6, TRUE, NOW(), NOW())
       ON CONFLICT ("tenantId", "name") DO NOTHING`,
      id(),
      tenantId,
      tr.name,
      tr.type,
      tr.rate,
      tr.isDefault
    )
  }

  // Condiciones de pago estándar
  const paymentConditions = [
    { name: "Contado", days: 0, isDefault: true },
    { name: "30 días", days: 30, isDefault: false },
    { name: "60 días", days: 60, isDefault: false },
    { name: "90 días", days: 90, isDefault: false },
    { name: "30/60/90 días", days: 90, isDefault: false },
  ]

  for (const pc of paymentConditions) {
    await client.$executeRawUnsafe(
      `INSERT INTO "${dbSchema}"."PaymentCondition" ("id", "tenantId", "name", "days", "isDefault", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       ON CONFLICT ("tenantId", "name") DO NOTHING`,
      id(),
      tenantId,
      pc.name,
      pc.days,
      pc.isDefault
    )
  }

  // Unidades de medida comunes
  const units = [
    { name: "Unidad", abbreviation: "und", isBase: true },
    { name: "Kilogramo", abbreviation: "kg", isBase: false },
    { name: "Gramo", abbreviation: "g", isBase: false },
    { name: "Litro", abbreviation: "lt", isBase: false },
    { name: "Metro", abbreviation: "m", isBase: false },
    { name: "Metro cuadrado", abbreviation: "m2", isBase: false },
    { name: "Caja", abbreviation: "cja", isBase: false },
    { name: "Docena", abbreviation: "doc", isBase: false },
  ]

  for (const u of units) {
    await client.$executeRawUnsafe(
      `INSERT INTO "${dbSchema}"."UnitOfMeasure" ("id", "tenantId", "name", "abbreviation", "isBase", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       ON CONFLICT ("tenantId", "abbreviation") DO NOTHING`,
      id(),
      tenantId,
      u.name,
      u.abbreviation,
      u.isBase
    )
  }

  // Medios de pago por defecto
  const paymentMethods = [
    { name: "Efectivo", type: "CASH", surcharge: "0", order: 1 },
    { name: "Tarjeta de débito", type: "DEBIT_CARD", surcharge: "0", order: 2 },
    { name: "Tarjeta de crédito", type: "CREDIT_CARD", surcharge: "0.03", order: 3 },
    { name: "Transferencia bancaria", type: "BANK_TRANSFER", surcharge: "0", order: 4 },
    { name: "Cheque", type: "CHECK", surcharge: "0", order: 5 },
    { name: "Mercado Pago", type: "MERCADO_PAGO", surcharge: "0.05", order: 6 },
    { name: "Cuenta corriente", type: "CURRENT_ACCOUNT", surcharge: "0", order: 7 },
  ]

  for (const pm of paymentMethods) {
    await client.$executeRawUnsafe(
      `INSERT INTO "${dbSchema}"."PaymentMethod" ("id", "tenantId", "name", "type", "surchargePercent", "isActive", "order", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::${dbSchema}."PaymentMethodType", $5, TRUE, $6, NOW(), NOW())
       ON CONFLICT ("tenantId", "name") DO NOTHING`,
      id(),
      tenantId,
      pm.name,
      pm.type,
      pm.surcharge,
      pm.order
    )
  }

  // Lista de precios por defecto
  await client.$executeRawUnsafe(
    `INSERT INTO "${dbSchema}"."PriceList" ("id", "tenantId", "name", "currency", "isDefault", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Lista General', 'ARS', TRUE, TRUE, NOW(), NOW())
     ON CONFLICT ("tenantId", "name") DO NOTHING`,
    id(),
    tenantId
  )
}

// ---------------------------------------------------------------------------
// Generador de CUID simple (evitar dependencia extra)
// ---------------------------------------------------------------------------

/** Genera un ID único tipo CUID2 sin dependencias externas */
function generateCuid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  const random2 = Math.random().toString(36).substring(2, 10)
  return `c${timestamp}${random}${random2}`.substring(0, 25)
}
