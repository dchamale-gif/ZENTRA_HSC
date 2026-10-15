-- Liga las citas de la agenda (historia_clinica) con el personal médico real.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.
BEGIN;

ALTER TABLE historia_clinica
    ADD COLUMN IF NOT EXISTS personal_medico_id INTEGER REFERENCES personal_medico(id);

CREATE INDEX IF NOT EXISTS idx_historia_clinica_personal_fecha
    ON historia_clinica (personal_medico_id, fecha, hora);

COMMIT;
