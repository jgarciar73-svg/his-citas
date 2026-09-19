SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pacientes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  telefono VARCHAR(20) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pacientes_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doctores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  especialidad VARCHAR(80) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS citas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  paciente_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fin DATETIME NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  estado ENUM('pendiente','confirmada','cancelada','atendida') NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Este índice sirve tanto para pintar el calendario como para buscar solapes por doctor.
  KEY idx_citas_doctor_horario (doctor_id, inicio, fin),
  CONSTRAINT fk_citas_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes (id),
  CONSTRAINT fk_citas_doctor FOREIGN KEY (doctor_id) REFERENCES doctores (id),
  CONSTRAINT ck_citas_horario CHECK (fin > inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
