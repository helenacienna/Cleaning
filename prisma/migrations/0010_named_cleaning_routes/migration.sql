CREATE TABLE "cleaning_routes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "facility_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaning_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cleaning_route_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "route_id" UUID NOT NULL,
  "task_template_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaning_route_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cleaning_routes_facility_id_name_key" ON "cleaning_routes"("facility_id", "name");
CREATE INDEX "cleaning_routes_facility_id_is_default_idx" ON "cleaning_routes"("facility_id", "is_default");
CREATE UNIQUE INDEX "cleaning_route_items_route_id_task_template_id_key" ON "cleaning_route_items"("route_id", "task_template_id");
CREATE INDEX "cleaning_route_items_task_template_id_idx" ON "cleaning_route_items"("task_template_id");

ALTER TABLE "cleaning_routes" ADD CONSTRAINT "cleaning_routes_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cleaning_route_items" ADD CONSTRAINT "cleaning_route_items_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "cleaning_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cleaning_route_items" ADD CONSTRAINT "cleaning_route_items_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
