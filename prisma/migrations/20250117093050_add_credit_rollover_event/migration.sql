DO $$
BEGIN
  ALTER TYPE "CreditLedgerEventType" ADD VALUE 'ROLLOVER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
