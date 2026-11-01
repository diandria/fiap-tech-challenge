-- Progress per service is recorded by the Execution Service (repair tasks).
-- AlterTable
ALTER TABLE "service_order_services" DROP COLUMN "finished_at",
DROP COLUMN "started_at";

