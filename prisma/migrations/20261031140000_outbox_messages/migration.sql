-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "service_order_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "traceparent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_created_at_idx" ON "outbox_messages"("published_at", "created_at");

