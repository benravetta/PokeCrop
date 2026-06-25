-- Launch Human Expert Review at £29.99 and enable the product.

UPDATE public.human_pregrade_settings
SET
  enabled = true,
  price_minor_units = 2999,
  product_description = 'A human expert reviews your card images and returns a written pre-grading report with grade probabilities and condition notes.',
  updated_at = now()
WHERE id = 1;

ALTER TABLE public.human_pregrade_settings
  ALTER COLUMN price_minor_units SET DEFAULT 2999;
