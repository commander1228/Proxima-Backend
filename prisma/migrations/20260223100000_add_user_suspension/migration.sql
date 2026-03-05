-- Add suspension support to User
-- suspendedUntil: NULL = not suspended, future timestamp = suspended until that time.
-- When the timestamp is in the past the user is treated as active (lazy auto-lift).

ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);

-- Index so admins can quickly list all currently-suspended users
CREATE INDEX "User_suspendedUntil_idx" ON "User"("suspendedUntil");