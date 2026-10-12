CREATE TABLE "barber_link_codes" (
    "code" TEXT NOT NULL,
    "barber_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barber_link_codes_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "barber_link_codes_barber_id_idx" ON "barber_link_codes"("barber_id");

ALTER TABLE "barber_link_codes" ADD CONSTRAINT "barber_link_codes_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
