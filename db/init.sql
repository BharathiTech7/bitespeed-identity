CREATE TABLE IF NOT EXISTS "Contact" (
  "id" SERIAL PRIMARY KEY,
  "phoneNumber" VARCHAR(255),
  "email" VARCHAR(255),
  "linkedId" INTEGER,
  "linkPrecedence" VARCHAR(20) NOT NULL DEFAULT 'primary',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMP,
  FOREIGN KEY ("linkedId") REFERENCES "Contact"("id")
);

CREATE INDEX IF NOT EXISTS "idx_contact_email" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "idx_contact_phoneNumber" ON "Contact"("phoneNumber");
CREATE INDEX IF NOT EXISTS "idx_contact_linkedId" ON "Contact"("linkedId");
