-- Allow owner-scoped task history alongside existing private Notebook content.
-- RLS remains owner_id = auth.uid(); no company-level task visibility.
-- Safe to rerun if a deployment tool has already applied the constraint.
BEGIN;
ALTER TABLE public.private_documents
  DROP CONSTRAINT IF EXISTS private_documents_document_key_check;
ALTER TABLE public.private_documents
  ADD CONSTRAINT private_documents_document_key_check
  CHECK (document_key IN ('notebook','tasks'));
COMMIT;
