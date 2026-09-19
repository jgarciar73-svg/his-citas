// Cliente de la API REST. Es el único archivo del navegador que conoce las rutas y usa fetch.
// Cuando algo falla lanza un Error con un mensaje listo para mostrarle a la persona.
const Api = (() => {
  function mensajeDeError(cuerpo) {
    if (!cuerpo) return 'El servidor respondió con un error inesperado.';
    // 400: la API manda una lista de textos con lo que hay que corregir.
    if (Array.isArray(cuerpo.detalles) && cuerpo.detalles.every((d) => typeof d === 'string')) {
      return cuerpo.detalles.join(' ');
    }
    return cuerpo.mensaje || 'El servidor respondió con un error inesperado.';
  }

  async function solicitar(ruta, opciones = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`/api${ruta}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opciones,
      });
    } catch (fallo) {
      const error = new Error('No hay conexión con el servidor. Revisa que la API esté encendida e inténtalo de nuevo.');
      error.estado = 0;
      throw error;
    }

    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = new Error(mensajeDeError(cuerpo));
      error.estado = respuesta.status;
      error.codigo = cuerpo && cuerpo.codigo;
      throw error;
    }
    return cuerpo;
  }

  function consulta(filtros) {
    const params = new URLSearchParams();
    Object.entries(filtros || {}).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') params.set(clave, valor);
    });
    const texto = params.toString();
    return texto ? `?${texto}` : '';
  }

  return {
    listarCitas: (filtros) => solicitar(`/citas${consulta(filtros)}`),
    crearCita: (datos) => solicitar('/citas', { method: 'POST', body: JSON.stringify(datos) }),
    reprogramarCita: (id, datos) => solicitar(`/citas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
    cambiarEstado: (id, estado) =>
      solicitar(`/citas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
    listarDoctores: () => solicitar('/doctores'),
    listarPacientes: () => solicitar('/pacientes'),
  };
})();
