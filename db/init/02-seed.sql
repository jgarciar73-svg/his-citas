SET NAMES utf8mb4;

-- Datos de ejemplo. Los números de identificación son inventados.
INSERT INTO pacientes (nombre, apellido, dni, telefono) VALUES
  ('Ana', 'López', '1000000010101', '5555-0101'),
  ('Luis', 'Hernández', '1000000020101', '5555-0102'),
  ('Rosa', 'Méndez', '1000000030101', '5555-0103'),
  ('Jorge', 'Pineda', '1000000040101', '5555-0104'),
  ('Carmen', 'Ordóñez', '1000000050101', '5555-0105');

INSERT INTO doctores (nombre, apellido, especialidad) VALUES
  ('Lucía', 'Morales', 'Medicina Interna'),
  ('Andrés', 'Castillo', 'Pediatría'),
  ('Sofía', 'Ramírez', 'Ginecología y Obstetricia'),
  ('Mario', 'Estrada', 'Cirugía General');

-- Las fechas son relativas al día en que se crea el contenedor, para que
-- el calendario tenga citas a la vista sin tocar el script.
INSERT INTO citas (paciente_id, doctor_id, inicio, fin, motivo, estado) VALUES
  (1, 1, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '08:00:00'), TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '08:30:00'), 'Control de hipertensión', 'atendida'),
  (2, 2, TIMESTAMP(CURDATE(), '09:00:00'), TIMESTAMP(CURDATE(), '09:30:00'), 'Control de niño sano', 'confirmada'),
  (3, 3, TIMESTAMP(CURDATE(), '10:00:00'), TIMESTAMP(CURDATE(), '11:00:00'), 'Control prenatal', 'pendiente'),
  (4, 4, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '08:30:00'), TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '09:30:00'), 'Evaluación prequirúrgica', 'confirmada'),
  (5, 1, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '14:00:00'), TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '14:30:00'), 'Dolor abdominal', 'pendiente'),
  (2, 1, TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '11:00:00'), TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '11:30:00'), 'Consulta de seguimiento', 'cancelada');
