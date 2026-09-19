CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at", "id");
CREATE INDEX "users_display_name_id_idx" ON "users"("display_name", "id");

CREATE FUNCTION set_user_updated_at() RETURNS trigger AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
WHEN ((OLD."email", OLD."display_name") IS DISTINCT FROM (NEW."email", NEW."display_name"))
EXECUTE FUNCTION set_user_updated_at();
