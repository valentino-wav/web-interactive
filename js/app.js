// ============================================================
//  app.js — El cerebro del cotizador.
//  Guarda el estado, decide cuándo se puede avanzar de paso y manda a
//  dibujar. Es el único de los tres que conoce a los otros dos.
// ============================================================

import * as datos from "./datos.js";
import * as interfaz from "./interfaz.js";

const CATEGORIA_TODAS = "Todas";
const PASO_INICIAL = 1;
const PASO_CONFIRMAR = 2;
const DEMORA_PAGO = 1400;
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Todo el estado vive acá adentro.
 * Separo `paso` de `fase` a propósito: `paso` es la pantalla que se está
 * viendo y `fase` es en qué punto está la cotización. Cuando los tenía
 * juntos, recargar en el pago me dejaba la pantalla sin saber qué cobrar.
 */
const estado = {
    servicios: [],
    configuracion: null,
    items: [],
    categoria: CATEGORIA_TODAS,
    busqueda: "",
    medioPagoId: "",
    cliente: datos.clienteVacio(),
    paso: PASO_INICIAL,
    fase: datos.FASES.BORRADOR,
    cotizacionActivaId: null,
    historial: [],
    enviando: false
};

// ------------------------------------------------------------
//  Consultas derivadas del estado
// ------------------------------------------------------------

/** Saco las categorías del propio catálogo, así no tengo la lista repetida acá. */
function obtenerCategorias() {
    return [CATEGORIA_TODAS, ...new Set(estado.servicios.map((servicio) => servicio.categoria))];
}

function filtrarServicios() {
    const textoBuscado = estado.busqueda.trim().toLowerCase();

    return estado.servicios.filter(({ nombre, descripcion, categoria }) => {
        const coincideCategoria = estado.categoria === CATEGORIA_TODAS || categoria === estado.categoria;
        const coincideTexto = textoBuscado === "" ||
            `${nombre} ${descripcion}`.toLowerCase().includes(textoBuscado);

        return coincideCategoria && coincideTexto;
    });
}

function buscarServicio(id) {
    return estado.servicios.find((servicio) => servicio.id === id);
}

function buscarMedioPago() {
    return estado.configuracion.mediosPago.find((medio) => medio.id === estado.medioPagoId) || null;
}

function buscarCotizacionActiva() {
    return estado.historial.find((cotizacion) => cotizacion.numero === estado.cotizacionActivaId) || null;
}

/** Del {id, cantidad} que guardo paso a la línea completa, con nombre y precio. */
function hidratarLineas() {
    return estado.items
        .map(({ id, cantidad }) => {
            const servicio = buscarServicio(id);

            if (!servicio) {
                return null;
            }

            const { nombre, precioBase, horas, unidad, unidadPlural } = servicio;

            return {
                id,
                nombre,
                cantidad,
                precioUnitario: precioBase,
                horas,
                unidad,
                unidadPlural,
                maxCantidad: datos.topeDe(servicio),
                subtotal: datos.redondear(precioBase * cantidad)
            };
        })
        .filter((linea) => linea !== null);
}

/** Recibe las líneas ya hidratadas para no volver a calcularlas por dentro. */
function totalesDe(lineas) {
    return datos.calcularTotales({
        lineas,
        tramos: estado.configuracion.tramosDescuento,
        iva: estado.configuracion.iva
    });
}

const esEditable = () => estado.fase === datos.FASES.BORRADOR;

/** El último paso sale del largo de la lista del JSON, no de un número suelto acá. */
const ultimoPaso = () => estado.configuracion.pasos.length;

/**
 * Con la cotización ya pagada no se vuelve atrás: los pasos anteriores quedan
 * congelados y el usuario no tiene forma de saber por qué nada responde.
 * Mejor no dejarlo entrar y que use "Hacer una cotización nueva".
 */
const primerPasoAlcanzable = () =>
    (estado.fase === datos.FASES.PAGADA ? ultimoPaso() : PASO_INICIAL);

// ------------------------------------------------------------
//  Validación y navegación
// ------------------------------------------------------------

function validarCliente() {
    const { nombre, email, comentarios } = estado.cliente;
    const errores = {};

    if (nombre.trim().length < datos.LIMITES.nombreMinimo) {
        errores.nombre = "Escribí tu nombre y apellido.";
    }

    if (!PATRON_EMAIL.test(email)) {
        errores.email = "Revisá el correo: tiene que ser del estilo nombre@dominio.com.";
    }

    if (comentarios.length > datos.LIMITES.comentarios) {
        errores.comentarios = `El comentario no puede superar los ${datos.LIMITES.comentarios} caracteres.`;
    }

    return errores;
}

/** Si un paso todavía no está listo devuelve el motivo; si está todo bien, "". */
function motivoBloqueo(numero) {
    if (numero === 1) {
        return estado.items.length === 0
            ? "Agregá al menos un servicio para continuar."
            : "";
    }

    if (numero === PASO_CONFIRMAR) {
        return estado.fase === datos.FASES.PAGADA
            ? ""
            : "Completá tus datos, elegí cómo pagar y confirmá.";
    }

    return "";
}

/**
 * Hasta qué paso se puede llegar con lo que hay cargado.
 * Lo calculo cada vez en lugar de guardarlo: guardado se me quedaba
 * viejo apenas el usuario cambiaba algo de un paso anterior.
 */
function pasoMaximoAlcanzable() {
    for (let numero = 1; numero < ultimoPaso(); numero += 1) {
        if (motivoBloqueo(numero) !== "") {
            return numero;
        }
    }

    return ultimoPaso();
}

/**
 * Todos los cambios de paso pasan por acá.
 * Siempre con el número de destino, nunca paso++: con dos clics rápidos
 * en Continuar se salteaba un paso.
 */
function irAPaso(numero) {
    const piso = primerPasoAlcanzable();
    const destino = Math.min(Math.max(numero, piso), ultimoPaso());
    const tope = pasoMaximoAlcanzable();

    if (destino > tope) {
        const mensaje = motivoBloqueo(tope);

        if (mensaje !== "") {
            interfaz.mostrarAvisoPaso(tope, mensaje);
            interfaz.notificar("error", mensaje);
        }

        estado.paso = tope;
        actualizar();
        return;
    }

    interfaz.limpiarAvisosPaso(estado.configuracion.pasos);
    estado.paso = destino;
    actualizar();
    interfaz.irAlCotizador();
}

/** Si se rompe un paso anterior (por ejemplo vaciando el presupuesto), traigo al usuario de vuelta. */
function reencuadrar() {
    estado.paso = Math.min(estado.paso, pasoMaximoAlcanzable());
}

// ------------------------------------------------------------
//  Mutaciones del presupuesto
//
//  Las cuatro arrancan chequeando esEditable(). Antes confiaba solo en el
//  atributo disabled que escribe el render, y encontré que con la cotización
//  ya confirmada se podía entrar al paso 1 y vaciar el presupuesto: quedaba
//  una cotización emitida con cero ítems y el asistente trabado.
// ------------------------------------------------------------

function agregarServicio(id) {
    if (!esEditable()) {
        return;
    }

    const servicio = buscarServicio(id);
    const item = estado.items.find((candidato) => candidato.id === id);

    if (!item) {
        estado.items.push({ id, cantidad: 1 });
        interfaz.notificar("exito", `${servicio.nombre} se sumó a tu presupuesto.`);
        actualizar();
        return;
    }

    cambiarCantidad(id, 1);
}

function cambiarCantidad(id, delta) {
    if (!esEditable()) {
        return;
    }

    const item = estado.items.find((candidato) => candidato.id === id);
    const tope = datos.topeDe(buscarServicio(id));
    const nueva = item.cantidad + delta;

    if (nueva < 1 || nueva > tope) {
        interfaz.notificar("info", `El máximo para este servicio es ${tope}.`);
        return;
    }

    item.cantidad = nueva;
    actualizar();
}

function quitarServicio(id) {
    if (!esEditable()) {
        return;
    }

    const { nombre } = buscarServicio(id);

    estado.items = estado.items.filter((item) => item.id !== id);
    interfaz.notificar("info", `${nombre} se quitó del presupuesto.`);
    actualizar();
}

async function vaciarPresupuesto() {
    if (!esEditable()) {
        return;
    }

    if (estado.items.length === 0) {
        interfaz.notificar("info", "Tu presupuesto ya está vacío.");
        return;
    }

    const confirmado = await interfaz.confirmar(
        "¿Vaciar el presupuesto?",
        "Se van a quitar todos los servicios que elegiste.",
        "Sí, vaciar"
    );

    if (!confirmado) {
        return;
    }

    estado.items = [];
    interfaz.notificar("info", "Presupuesto vaciado.");
    actualizar();
}

// ------------------------------------------------------------
//  Confirmación, pago y anulación
// ------------------------------------------------------------

/** La foto de lo contratado. Guarda los montos, no los ids: si mañana cambio
 *  la lista de precios, un comprobante ya emitido no tiene que moverse. */
function armarSnapshot(medioPago, totales) {
    const ahora = new Date().toISOString();

    return {
        numero: datos.siguienteNumero(estado.historial),
        fecha: ahora,
        estado: datos.ESTADOS.CONTRATADA,
        fechaContratacion: ahora,
        cliente: { ...estado.cliente },
        lineas: hidratarLineas(),
        medioPago: { id: medioPago.id, nombre: medioPago.nombre, ajuste: medioPago.ajuste },
        totales,
        totalPagado: totales.totalAPagar
    };
}

/** El "procesamiento" del pago: una espera simulada para que se vea el flujo. */
function procesarPago() {
    return new Promise((resolver) => {
        setTimeout(resolver, DEMORA_PAGO);
    });
}

/**
 * Confirmar y pagar son una sola acción: la cotización nace contratada.
 * Antes eran dos pasos con un estado "pendiente de pago" en el medio, y ese
 * hueco arrastraba el congelado del asistente y el flujo de anular para editar.
 */
async function confirmarYPagar() {
    if (estado.enviando || !esEditable()) {
        return;
    }

    estado.cliente = interfaz.leerFormularioCliente();
    const errores = validarCliente();

    interfaz.mostrarErroresCliente(errores);

    if (Object.keys(errores).length > 0) {
        interfaz.mostrarAvisoPaso(PASO_CONFIRMAR, "Revisá los campos marcados para continuar.");
        return;
    }

    const medioPago = buscarMedioPago();

    if (!medioPago) {
        interfaz.mostrarAvisoPaso(PASO_CONFIRMAR, "Elegí un medio de pago para continuar.");
        return;
    }

    interfaz.mostrarAvisoPaso(PASO_CONFIRMAR, "");

    const totales = datos.aplicarMedioPago(totalesDe(hidratarLineas()), medioPago);

    const confirmado = await interfaz.confirmar(
        "Confirmar la contratación",
        interfaz.cuerpoConfirmacionPago(totales.totalAPagar, medioPago.nombre),
        "Confirmar y pagar"
    );

    if (!confirmado) {
        return;
    }

    estado.enviando = true;
    interfaz.ocupado("btn-confirmar", true, "Procesando…");
    interfaz.procesando(true);

    try {
        await procesarPago();

        const snapshot = datos.guardarCotizacion(armarSnapshot(medioPago, totales));

        if (!snapshot) {
            interfaz.mostrarAvisoPaso(PASO_CONFIRMAR,
                "No pudimos guardar la contratación. Revisá que el navegador permita almacenamiento y volvé a intentar.");
            interfaz.notificar("error", "No se pudo guardar la contratación.");
            return;
        }

        estado.historial = datos.leerHistorial();
        estado.cotizacionActivaId = snapshot.numero;
        estado.fase = datos.FASES.PAGADA;

        interfaz.notificar("exito", `¡Listo! Cotización ${snapshot.numero} contratada.`);
        irAPaso(ultimoPaso());
    } finally {
        estado.enviando = false;
        interfaz.procesando(false);
        interfaz.ocupado("btn-confirmar", false);
    }
}

function volverABorrador() {
    estado.fase = datos.FASES.BORRADOR;
    estado.cotizacionActivaId = null;
    estado.medioPagoId = "";
    reencuadrar();
    actualizar();
}

/**
 * Anular termina siendo lo mismo por los dos caminos: el "Editar" del asistente
 * y el "Cancelar cotización" del historial. Si la que se anula es la que estaba
 * en curso, el asistente se destraba y vuelve al paso 1.
 */
function anularCotizacion(numero) {
    datos.modificarCotizacion(numero, { estado: datos.ESTADOS.ANULADA });
    estado.historial = datos.leerHistorial();
    interfaz.notificar("info", `Cotización ${numero} anulada.`);

    if (numero === estado.cotizacionActivaId) {
        volverABorrador();
        irAPaso(1);
        return;
    }

    actualizar();
}

async function cancelarCotizacion(numero) {
    const cotizacion = estado.historial.find((candidata) => candidata.numero === numero);

    if (!cotizacion || cotizacion.estado !== datos.ESTADOS.CONTRATADA) {
        return;
    }

    const esLaEnCurso = numero === estado.cotizacionActivaId;

    const confirmado = await interfaz.confirmar(
        "¿Cancelar la cotización?",
        `<strong>${numero}</strong> va a quedar anulada.
         ${esLaEnCurso ? "El simulador vuelve a quedar libre para armar otra." : ""}`,
        "Sí, cancelar"
    );

    if (confirmado) {
        anularCotizacion(numero);
    }
}

/**
 * Deja el borrador como recién llegado.
 * Lo comparten "Nueva cotización" y "Reiniciar simulador", que antes hacían
 * casi lo mismo pero cada una se olvidaba de resetear algo distinto: una no
 * tocaba el plan y el plazo, la otra no tocaba el filtro ni la búsqueda.
 */
function reiniciarBorrador() {
    estado.items = [];
    estado.medioPagoId = "";
    estado.cliente = datos.clienteVacio();
    estado.fase = datos.FASES.BORRADOR;
    estado.cotizacionActivaId = null;
    estado.categoria = CATEGORIA_TODAS;
    estado.busqueda = "";

    interfaz.pintarFormularioCliente(estado.cliente);
    interfaz.mostrarErroresCliente({});
    interfaz.limpiarBuscador();
}

function nuevaCotizacion() {
    datos.borrarBorrador();
    reiniciarBorrador();
    irAPaso(1);
}

// ------------------------------------------------------------
//  Historial
// ------------------------------------------------------------

function verComprobante(numero) {
    const cotizacion = estado.historial.find((candidata) => candidata.numero === numero);

    if (cotizacion) {
        interfaz.mostrarComprobante(cotizacion);
    }
}

async function borrarDelHistorial(numero) {
    if (numero === estado.cotizacionActivaId) {
        interfaz.notificar("info", "Esa cotización está en curso. Anulala antes de borrarla.");
        return;
    }

    const confirmado = await interfaz.confirmar(
        "¿Borrar esta cotización?",
        `Se va a eliminar <strong>${numero}</strong> de tu historial. No se puede deshacer.`,
        "Sí, borrar"
    );

    if (!confirmado) {
        return;
    }

    datos.borrarCotizacion(numero);
    estado.historial = datos.leerHistorial();
    interfaz.notificar("info", `Cotización ${numero} borrada.`);
    actualizar();
}

/** El unico lugar que llama a localStorage.clear(): se lleva el historial y el borrador. */
async function reiniciarTodo() {
    const confirmado = await interfaz.confirmar(
        "¿Reiniciar el simulador?",
        "Se borran todas tus cotizaciones y el presupuesto que estés armando. No se puede deshacer.",
        "Sí, reiniciar todo"
    );

    if (!confirmado) {
        return;
    }

    datos.borrarTodo();

    estado.historial = [];
    reiniciarBorrador();

    interfaz.notificar("info", "Simulador reiniciado.");
    irAPaso(1);
}

// ------------------------------------------------------------
//  Redibujado
// ------------------------------------------------------------

function persistir() {
    datos.guardarBorrador({
        items: estado.items,
        medioPagoId: estado.medioPagoId,
        cliente: estado.cliente,
        paso: estado.paso,
        fase: estado.fase,
        cotizacionActivaId: estado.cotizacionActivaId
    });
}

/** Después de tocar el estado llamo siempre a esto: guarda, calcula y dibuja. */
function actualizar() {
    // El tope no depende del paso en que estemos, y reencuadrar() solo toca el
    // paso: por eso alcanza con calcularlo una vez. Antes se recorrían todos
    // los pasos dos veces por refresco, con la validación del cliente adentro.
    const tope = pasoMaximoAlcanzable();

    estado.paso = Math.min(estado.paso, tope);
    persistir();

    const soloLectura = !esEditable();
    const lineas = hidratarLineas();
    const { mediosPago } = estado.configuracion;

    interfaz.renderBarraPasos(estado.configuracion.pasos, estado.paso, tope, primerPasoAlcanzable());
    interfaz.mostrarPaso(estado.configuracion.pasos, estado.paso);
    interfaz.renderFiltros(obtenerCategorias(), estado.categoria);
    interfaz.renderCatalogo(filtrarServicios(), estado.items.map((item) => item.id), { soloLectura });
    interfaz.renderPresupuesto(lineas, { soloLectura });
    interfaz.bloquearEdicion(soloLectura);

    const totales = totalesDe(lineas);
    interfaz.renderResumenes(totales, { vacio: lineas.length === 0 });

    // La confirmación se dibuja siempre que haya algo que confirmar: sin el
    // estado intermedio de "emitida pero sin pagar", lee del estado vivo igual
    // que el resto y no hace falta distinguir de dónde vienen los datos.
    if (lineas.length > 0) {
        interfaz.renderConfirmacion(lineas, totales, estado.cliente);
        interfaz.renderPago(mediosPago, estado.medioPagoId,
            datos.aplicarMedioPago(totales, buscarMedioPago()));
    }

    const contratada = buscarCotizacionActiva();

    if (contratada) {
        interfaz.renderExito(contratada);
    }

    interfaz.renderHistorial(estado.historial, estado.cotizacionActivaId);
}

// ------------------------------------------------------------
//  Manejadores de eventos (delegación)
// ------------------------------------------------------------

const ACCIONES = {
    agregar: ({ id }) => agregarServicio(id),
    sumar: ({ id }) => cambiarCantidad(id, 1),
    restar: ({ id }) => cambiarCantidad(id, -1),
    quitar: ({ id }) => quitarServicio(id),
    confirmar: () => confirmarYPagar(),
    nueva: () => nuevaCotizacion(),
    comprobante: ({ numero }) => verComprobante(numero),
    "cancelar-cotizacion": ({ numero }) => cancelarCotizacion(numero),
    "borrar-cotizacion": ({ numero }) => borrarDelHistorial(numero)
};

function manejarClic(evento) {
    const navegacion = evento.target.closest("[data-navegar]");

    if (navegacion) {
        const salto = navegacion.dataset.navegar === "atras" ? -1 : 1;
        irAPaso(estado.paso + salto);
        return;
    }

    const salto = evento.target.closest("[data-ir]");

    if (salto) {
        irAPaso(Number(salto.dataset.ir));
        return;
    }

    const chip = evento.target.closest("[data-categoria]");

    if (chip) {
        estado.categoria = chip.dataset.categoria;
        actualizar();
        return;
    }

    const accionable = evento.target.closest("[data-accion]");

    if (accionable) {
        ACCIONES[accionable.dataset.accion]?.(accionable.dataset);
    }
}

function manejarCambio(evento) {
    const { name, value } = evento.target;

    if (name !== "medio-pago") {
        return;
    }

    estado.medioPagoId = value;
    interfaz.mostrarAvisoPaso(PASO_CONFIRMAR, "");
    actualizar();
}


function manejarEntrada(evento) {
    const { id, value } = evento.target;

    if (id === "catalogo-buscador") {
        estado.busqueda = value;
        actualizar();
        return;
    }

    if (id.startsWith("cliente-")) {
        estado.cliente[id.replace("cliente-", "")] = value.trim();
        persistir();
    }
}

function manejarEnvioCliente(evento) {
    evento.preventDefault();

    estado.cliente = interfaz.leerFormularioCliente();
    const errores = validarCliente();

    interfaz.mostrarErroresCliente(errores);

    if (Object.keys(errores).length > 0) {
        interfaz.mostrarAvisoPaso(3, "Revisá los campos marcados para continuar.");
        return;
    }

    interfaz.mostrarAvisoPaso(3, "");
    irAPaso(4);
}

/**
 * Engancho los eventos a los contenedores y no a cada botón.
 * Como redibujo con innerHTML, los botones se reemplazan todo el tiempo
 * y los listeners puestos sobre ellos se perderían en el primer filtro.
 */
function registrarEventos() {
    const contenido = document.getElementById("cotizador-contenido");

    contenido.addEventListener("click", manejarClic);
    contenido.addEventListener("change", manejarCambio);
    contenido.addEventListener("input", manejarEntrada);

    document.getElementById("form-cliente").addEventListener("submit", manejarEnvioCliente);
    document.getElementById("btn-vaciar-presupuesto").addEventListener("click", vaciarPresupuesto);
    document.getElementById("btn-reiniciar-todo").addEventListener("click", reiniciarTodo);
    document.getElementById("btn-reintentar").addEventListener("click", iniciar);
}

// ------------------------------------------------------------
//  Arranque
// ------------------------------------------------------------

function hidratarEstado(servicios, configuracion) {
    estado.servicios = servicios;
    estado.configuracion = configuracion;
    estado.historial = datos.leerHistorial();

    // Antes del primer render: la moneda, las etiquetas de estado y los
    // maxlength salen de acá.
    interfaz.configurar(configuracion);

    const { borrador, descartados } = datos.sanearBorrador(datos.leerBorrador(), servicios, configuracion);

    Object.assign(estado, borrador);

    // Si la cotización que estaba pagando ya no está (la borré, o limpié el
    // storage), vuelvo a borrador en vez de mostrar un pago sin datos.
    if (estado.fase !== datos.FASES.BORRADOR && !buscarCotizacionActiva()) {
        estado.fase = datos.FASES.BORRADOR;
        estado.cotizacionActivaId = null;
    }

    interfaz.pintarFormularioCliente(estado.cliente);

    if (descartados.length > 0) {
        interfaz.notificar("info",
            `Quitamos ${descartados.length} servicio(s) que ya no están en el catálogo.`);
    }
}

async function iniciar() {
    interfaz.ocultarAvisoServidor();
    interfaz.ocultarErrorCarga();
    interfaz.mostrarCargando(true);

    try {
        const { servicios, configuracion } = await datos.cargarDatos();

        hidratarEstado(servicios, configuracion);
        actualizar();
        interfaz.mostrarContenido();
    } catch (error) {
        interfaz.mostrarErrorCarga(error.message);
    } finally {
        // Salga bien o salga mal, el cartel de "cargando" se tiene que ir.
        interfaz.mostrarCargando(false);
    }
}

registrarEventos();
iniciar();
