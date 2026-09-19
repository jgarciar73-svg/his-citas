// Calendario de citas. Este archivo solo arma la interfaz y llama a Api (api.js).
// Las reglas de negocio (doble reserva, cambios de estado permitidos) las decide el servidor.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const el = {
    calendario: $('calendario'),
    aviso: $('aviso'),
    resumen: $('resumen'),
    btnNueva: $('btn-nueva'),
    filtroDoctor: $('filtro-doctor'),
    filtroDesde: $('filtro-desde'),
    filtroHasta: $('filtro-hasta'),
    limpiarFiltros: $('limpiar-filtros'),

    dlgNueva: $('dlg-nueva'),
    formNueva: $('form-nueva'),
    nuevaError: $('nueva-error'),
    nuevaPaciente: $('nueva-paciente'),
    nuevaDoctor: $('nueva-doctor'),
    nuevaFecha: $('nueva-fecha'),
    nuevaInicio: $('nueva-inicio'),
    nuevaFin: $('nueva-fin'),
    nuevaMotivo: $('nueva-motivo'),
    nuevaGuardar: $('nueva-guardar'),
    nuevaDescartar: $('nueva-descartar'),

    dlgDetalle: $('dlg-detalle'),
    detalleError: $('detalle-error'),
    detalleDatos: $('detalle-datos'),
    detalleConfirmacion: $('detalle-confirmar-cancelacion'),
    detalleAcciones: $('detalle-acciones'),
    detalleCerrar: $('detalle-cerrar'),
    detalleConfirmar: $('detalle-confirmar'),
    detalleAtender: $('detalle-atender'),
    detalleCancelar: $('detalle-cancelar'),
    detalleVolver: $('detalle-volver'),
    detalleCancelarSi: $('detalle-cancelar-si'),
  };

  const ETIQUETAS_ESTADO = {
    pendiente: 'Pendiente',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    atendida: 'Atendida',
  };

  let calendario = null;
  let citaAbierta = null;

  // ---------- Fechas en hora local ----------

  const dos = (n) => String(n).padStart(2, '0');
  const fechaLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const horaLocal = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const isoLocal = (d) => `${fechaLocal(d)}T${horaLocal(d)}:${dos(d.getSeconds())}`;

  function fechaLarga(iso) {
    return new Date(iso).toLocaleDateString('es-GT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // ---------- Avisos ----------

  function mostrarAviso(texto, tipo = 'info') {
    const caja = document.createElement('div');
    caja.className = tipo === 'error' ? 'aviso aviso-error' : 'aviso';
    caja.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

    const mensaje = document.createElement('p');
    mensaje.textContent = texto;

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.textContent = 'Cerrar';
    cerrar.addEventListener('click', () => caja.remove());

    caja.append(mensaje, cerrar);
    el.aviso.append(caja);
    setTimeout(() => caja.remove(), tipo === 'error' ? 9000 : 3500);
  }

  function mostrarErrorEnPanel(zona, texto) {
    zona.textContent = texto;
    zona.hidden = false;
  }

  // ---------- Catálogos (doctores y pacientes) ----------

  function llenarSelect(select, filas, etiqueta) {
    filas.forEach((fila) => {
      const opcion = document.createElement('option');
      opcion.value = fila.id;
      opcion.textContent = etiqueta(fila);
      select.append(opcion);
    });
  }

  async function cargarCatalogos() {
    const [doctores, pacientes] = await Promise.all([Api.listarDoctores(), Api.listarPacientes()]);
    const etiquetaDoctor = (d) => `${d.nombre} ${d.apellido} (${d.especialidad})`;

    llenarSelect(el.filtroDoctor, doctores, etiquetaDoctor);

    el.nuevaDoctor.append(new Option('Elige un doctor', ''));
    llenarSelect(el.nuevaDoctor, doctores, etiquetaDoctor);

    el.nuevaPaciente.append(new Option('Elige un paciente', ''));
    llenarSelect(el.nuevaPaciente, pacientes, (p) => `${p.nombre} ${p.apellido}`);
  }

  // ---------- Citas como eventos del calendario ----------

  function citaAEvento(cita) {
    return {
      id: String(cita.id),
      title: cita.paciente_nombre,
      start: cita.inicio,
      end: cita.fin,
      classNames: [`estado-${cita.estado}`],
      // El servidor dice si la cita se puede mover. Las canceladas y atendidas quedan fijas.
      editable: cita.reprogramable,
      extendedProps: { cita },
    };
  }

  function nodo(etiqueta, clase, texto) {
    const n = document.createElement(etiqueta);
    n.className = clase;
    n.textContent = texto;
    return n;
  }

  function dibujarEvento(info) {
    const cita = info.event.extendedProps.cita;
    // Mientras se elige un espacio, FullCalendar dibuja una cita provisional sin datos de cita.
    if (!cita) return { domNodes: [nodo('div', 'ev', info.timeText)] };
    const caja = nodo('div', 'ev', '');
    // Una cita de 30 minutos o menos solo tiene alto para una línea: se muestra solo la hora de inicio.
    const corta = info.event.end && info.event.end - info.event.start <= 30 * 60000;
    if (corta) caja.classList.add('ev-corto');
    caja.append(
      nodo('span', 'ev-hora', corta ? horaLocal(info.event.start) : info.timeText),
      nodo('span', 'ev-nombre', cita.paciente_nombre),
      nodo('span', 'ev-doctor', cita.doctor_nombre)
    );
    return { domNodes: [caja] };
  }

  function describirEvento(info) {
    const c = info.event.extendedProps.cita;
    if (!c) return;
    info.el.title = [
      `${c.paciente_nombre}`,
      `${c.doctor_nombre}, ${c.doctor_especialidad}`,
      `${c.inicio.slice(11, 16)} a ${c.fin.slice(11, 16)}`,
      c.motivo,
      `Estado: ${ETIQUETAS_ESTADO[c.estado]}`,
    ].join('\n');
  }

  function actualizarResumen(eventos) {
    const n = eventos.length;
    if (n === 0) {
      el.resumen.textContent = 'No hay citas en esta vista. Haz clic en un espacio del calendario para agendar una.';
    } else if (n === 1) {
      el.resumen.textContent = '1 cita en esta vista.';
    } else {
      el.resumen.textContent = `${n} citas en esta vista.`;
    }
  }

  // ---------- Carga de citas según filtros ----------

  function diaSiguienteIso(fecha) {
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return `${fechaLocal(d)}T00:00:00`;
  }

  async function cargarEventos(info, exito, fallo) {
    const desdeFiltro = el.filtroDesde.value;
    const hastaFiltro = el.filtroHasta.value;

    if (desdeFiltro && hastaFiltro && hastaFiltro < desdeFiltro) {
      const error = new Error('La fecha "Hasta" no puede ser anterior a la fecha "Desde".');
      mostrarAviso(error.message, 'error');
      fallo(error);
      return;
    }

    // Se pide solo lo que cruza la vista actual y el rango elegido en los filtros.
    let desde = isoLocal(info.start);
    let hasta = isoLocal(info.end);
    if (desdeFiltro && `${desdeFiltro}T00:00:00` > desde) desde = `${desdeFiltro}T00:00:00`;
    if (hastaFiltro && diaSiguienteIso(hastaFiltro) < hasta) hasta = diaSiguienteIso(hastaFiltro);
    if (desde >= hasta) {
      exito([]);
      return;
    }

    try {
      const citas = await Api.listarCitas({ doctor_id: el.filtroDoctor.value, desde, hasta });
      exito(citas.map(citaAEvento));
    } catch (error) {
      mostrarAviso(error.message, 'error');
      fallo(error);
    }
  }

  // ---------- Crear cita ----------

  function abrirNueva({ fecha, inicio, fin }) {
    el.formNueva.reset();
    el.nuevaError.hidden = true;
    el.nuevaDoctor.value = el.filtroDoctor.value;
    el.nuevaFecha.value = fecha;
    el.nuevaInicio.value = inicio;
    el.nuevaFin.value = fin;
    el.dlgNueva.showModal();
    el.nuevaPaciente.focus();
  }

  function alSeleccionarEspacio(info) {
    let inicio = info.start;
    let fin = info.end;
    if (info.allDay) {
      // En la vista de mes se elige un día completo: se propone una consulta de 30 minutos a las 8:00.
      inicio = new Date(info.start);
      inicio.setHours(8, 0, 0, 0);
      fin = new Date(inicio.getTime() + 30 * 60000);
    }
    abrirNueva({ fecha: fechaLocal(inicio), inicio: horaLocal(inicio), fin: horaLocal(fin) });
    calendario.unselect();
  }

  async function guardarNueva(evento) {
    evento.preventDefault();
    el.nuevaError.hidden = true;
    if (!el.formNueva.reportValidity()) return;

    const doctorId = Number(el.nuevaDoctor.value);
    const fecha = el.nuevaFecha.value;
    el.nuevaGuardar.disabled = true;
    try {
      const cita = await Api.crearCita({
        paciente_id: Number(el.nuevaPaciente.value),
        doctor_id: doctorId,
        inicio: `${fecha}T${el.nuevaInicio.value}`,
        fin: `${fecha}T${el.nuevaFin.value}`,
        motivo: el.nuevaMotivo.value,
      });
      el.dlgNueva.close();
      calendario.gotoDate(cita.inicio);
      calendario.refetchEvents();

      const filtrado = el.filtroDoctor.value && Number(el.filtroDoctor.value) !== doctorId;
      mostrarAviso(
        filtrado
          ? 'Cita creada. El calendario muestra solo al doctor del filtro; quita el filtro para verla.'
          : 'Cita creada'
      );
    } catch (error) {
      mostrarErrorEnPanel(el.nuevaError, error.message);
    } finally {
      el.nuevaGuardar.disabled = false;
    }
  }

  // ---------- Ver detalle y cambiar estado ----------

  function fila(titulo, valor, secundario) {
    const dt = document.createElement('dt');
    dt.textContent = titulo;
    const dd = document.createElement('dd');
    dd.append(valor);
    if (secundario) dd.append(nodo('span', 'secundario', secundario));
    el.detalleDatos.append(dt, dd);
  }

  function insigniaEstado(estado) {
    const caja = nodo('span', 'insignia', '');
    const muestra = nodo('i', `muestra e-${estado}`, '');
    caja.append(muestra, ETIQUETAS_ESTADO[estado]);
    return caja;
  }

  function abrirDetalle(cita) {
    citaAbierta = cita;
    el.detalleError.hidden = true;
    el.detalleConfirmacion.hidden = true;
    el.detalleAcciones.hidden = false;

    el.detalleDatos.replaceChildren();
    fila('Paciente', cita.paciente_nombre);
    fila('Doctor', cita.doctor_nombre, cita.doctor_especialidad);
    fila('Fecha', fechaLarga(cita.inicio));
    fila('Horario', `${cita.inicio.slice(11, 16)} a ${cita.fin.slice(11, 16)}`);
    fila('Motivo', cita.motivo);
    fila('Estado', insigniaEstado(cita.estado));

    // Solo se ofrecen los botones que el servidor permite para el estado actual.
    el.detalleConfirmar.hidden = !cita.transiciones_permitidas.includes('confirmada');
    el.detalleAtender.hidden = !cita.transiciones_permitidas.includes('atendida');
    el.detalleCancelar.hidden = !cita.transiciones_permitidas.includes('cancelada');

    el.dlgDetalle.showModal();
  }

  function bloquearDetalle(bloqueado) {
    [el.detalleConfirmar, el.detalleAtender, el.detalleCancelar, el.detalleCancelarSi, el.detalleVolver].forEach(
      (b) => {
        b.disabled = bloqueado;
      }
    );
  }

  async function cambiarEstado(estado, textoExito) {
    el.detalleError.hidden = true;
    bloquearDetalle(true);
    try {
      await Api.cambiarEstado(citaAbierta.id, estado);
      el.dlgDetalle.close();
      calendario.refetchEvents();
      mostrarAviso(textoExito);
    } catch (error) {
      el.detalleConfirmacion.hidden = true;
      el.detalleAcciones.hidden = false;
      mostrarErrorEnPanel(el.detalleError, error.message);
      calendario.refetchEvents();
    } finally {
      bloquearDetalle(false);
    }
  }

  // ---------- Reprogramar arrastrando o cambiando la duración ----------

  async function alReprogramar(info) {
    const evento = info.event;
    const inicio = evento.start;
    const fin = evento.end || new Date(inicio.getTime() + (info.oldEvent.end - info.oldEvent.start));
    try {
      const cita = await Api.reprogramarCita(evento.id, { inicio: isoLocal(inicio), fin: isoLocal(fin) });
      evento.setExtendedProp('cita', cita);
      mostrarAviso('Cita reprogramada');
    } catch (error) {
      info.revert();
      mostrarAviso(error.message, 'error');
    }
  }

  // ---------- Armado del calendario ----------

  function crearCalendario() {
    const formatoHora = { hour: '2-digit', minute: '2-digit', hour12: false };

    calendario = new FullCalendar.Calendar(el.calendario, {
      locale: 'es',
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek',
      },
      buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },
      height: '100%',
      nowIndicator: true,
      allDaySlot: false,
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      scrollTime: '07:30:00',
      slotDuration: '00:30:00',
      slotLabelFormat: formatoHora,
      eventTimeFormat: formatoHora,
      eventDisplay: 'block',
      dayMaxEvents: 4,
      moreLinkText: (n) => `+${n} más`,

      selectable: true,
      selectMirror: true,
      editable: true,
      // En tablet se necesita una pulsación corta para no confundir el arrastre con el desplazamiento.
      longPressDelay: 350,
      selectLongPressDelay: 350,
      eventLongPressDelay: 350,

      events: cargarEventos,
      eventContent: dibujarEvento,
      eventDidMount: describirEvento,
      eventsSet: actualizarResumen,

      select: alSeleccionarEspacio,
      eventClick: (info) => abrirDetalle(info.event.extendedProps.cita),
      eventDrop: alReprogramar,
      eventResize: alReprogramar,
    });

    calendario.render();
  }

  // ---------- Eventos de la página ----------

  el.btnNueva.addEventListener('click', () => {
    abrirNueva({ fecha: fechaLocal(calendario.getDate()), inicio: '09:00', fin: '09:30' });
  });

  el.formNueva.addEventListener('submit', guardarNueva);
  el.nuevaDescartar.addEventListener('click', () => el.dlgNueva.close());

  el.detalleCerrar.addEventListener('click', () => el.dlgDetalle.close());
  el.detalleConfirmar.addEventListener('click', () => cambiarEstado('confirmada', 'Cita confirmada'));
  el.detalleAtender.addEventListener('click', () => cambiarEstado('atendida', 'Cita marcada como atendida'));
  el.detalleCancelar.addEventListener('click', () => {
    el.detalleConfirmacion.hidden = false;
    el.detalleAcciones.hidden = true;
  });
  el.detalleVolver.addEventListener('click', () => {
    el.detalleConfirmacion.hidden = true;
    el.detalleAcciones.hidden = false;
  });
  el.detalleCancelarSi.addEventListener('click', () => cambiarEstado('cancelada', 'Cita cancelada'));

  [el.dlgNueva, el.dlgDetalle].forEach((dialogo) => {
    // Un clic sobre el fondo oscuro cierra el panel.
    dialogo.addEventListener('click', (evento) => {
      if (evento.target === dialogo) dialogo.close();
    });
  });

  el.filtroDoctor.addEventListener('change', () => calendario.refetchEvents());
  el.filtroDesde.addEventListener('change', () => {
    if (el.filtroDesde.value) calendario.gotoDate(el.filtroDesde.value);
    calendario.refetchEvents();
  });
  el.filtroHasta.addEventListener('change', () => calendario.refetchEvents());
  el.limpiarFiltros.addEventListener('click', () => {
    el.filtroDoctor.value = '';
    el.filtroDesde.value = '';
    el.filtroHasta.value = '';
    calendario.refetchEvents();
  });

  async function iniciar() {
    try {
      await cargarCatalogos();
    } catch (error) {
      mostrarAviso(error.message, 'error');
    }
    crearCalendario();
  }

  iniciar();
})();
