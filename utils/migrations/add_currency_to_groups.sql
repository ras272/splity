-- Agregar columna de moneda a la tabla groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- Agregar comentario a la columna
COMMENT ON COLUMN groups.currency IS 'La moneda principal del grupo (ej: USD, EUR, PYG)'; 