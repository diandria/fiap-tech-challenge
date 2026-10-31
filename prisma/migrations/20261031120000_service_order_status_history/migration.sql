-- CreateTable
CREATE TABLE "service_order_status_history" (
    "id" UUID NOT NULL,
    "service_order_id" UUID NOT NULL,
    "from_status" "OSStatus",
    "to_status" "OSStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_order_status_history_service_order_id_changed_at_idx" ON "service_order_status_history"("service_order_id", "changed_at");

-- AddForeignKey
ALTER TABLE "service_order_status_history" ADD CONSTRAINT "service_order_status_history_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Orders opened before this table existed get one entry with their current
-- status, dated at the opening, so their history is never empty.
INSERT INTO "service_order_status_history" ("id", "service_order_id", "from_status", "to_status", "changed_at")
SELECT gen_random_uuid(), "id", NULL, "status", "created_at"
FROM "service_orders";
