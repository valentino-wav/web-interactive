// ============================================================
//  datos.js — De dónde salen los datos y cómo se arman los precios.
//  Lee los JSON, maneja el localStorage y hace las cuentas.
//  Acá adentro no toco el DOM ni muestro nada en pantalla.
// ============================================================

const RUTA_SERVICIOS = "data/servicios.json";
const RUTA_CONFIGURACION = "data/configuracion.json";

const CLAVE_BORRADOR = "fennec.presupuesto.v1";
const CLAVE_HISTORIAL = "fennec.historial.v1";
const VERSION_BORRADOR = 1;

const CANTIDAD_MAXIMA_POR_DEFECTO = 10;

/**
 * En qué punto está la cotización que se está armando.
 * Los tenía sueltos como texto en los tres archivos; con una constante, un
 * typo deja de compilar en vez de descartarme el borrador en silencio.
 */
export const FASES = Object.freeze({
    BORRADOR: "borrador",
    CONFIRMADA: "confirmada",
    PAGADA: "pagada"
});

/** Estado de una cotización ya emitida. */
export const ESTADOS = Object.freeze({
    PENDIENTE: "pendiente-pago",
    CONTRATADA: "contratada",
    ANULADA: "anulada"
});

/** Largos de los campos del cliente. Antes el 500 estaba escrito 4 veces. */
export const LIMITES = Object.freeze({
    nombreMinimo: 2,
    nombre: 80,
    email: 120,
    empresa: 80,
    comentarios: 500
});

/** Devuelve un objeto nuevo cada vez: si compartiera uno, al escribir en el
 *  formulario se contaminaría para toda la sesión. */
export function clienteVacio() {
    return { nombre: "", email: "", empresa: "", comentarios: "" };
}

// ------------------------------------------------------------
//  Carga de los JSON
// ------------------------------------------------------------

/**
 * Trae un JSON y chequea que la respuesta sirva.
 * Ojo acá: fetch() no falla con un 404. El archivo inexistente llega
 * como respuesta "exitosa" con ok en false, así que lo miro a mano.
 */
async function pedirJson(ruta) {
    const respuesta = await fetch(ruta);

    if (!respuesta.ok) {
        throw new Error(`No se encontró el archivo ${ruta} (error ${respuesta.status}).`);
    }

    return respuesta.json();
}

/**
 * Trae el catálogo y la configuración de precios.
 * Los pido en paralelo porque uno no depende del otro.
 */
export async function cargarDatos() {
    try {
        const [servicios, configuracion] = await Promise.all([
            pedirJson(RUTA_SERVICIOS),
            pedirJson(RUTA_CONFIGURACION)
        ]);

        return { servicios, configuracion };
    } catch (error) {
        // Si es un TypeError, el pedido ni salió: no hay servidor, no hay red,
        // o abrieron el HTML con doble clic (file://).
        const esFalloDeRed = error instanceof TypeError;

        throw new Error(esFalloDeRed
            ? "No se pudo contactar al servidor. Revisá que el sitio esté abierto con un servidor local y no con doble clic."
            : error.message);
    }
}

// ------------------------------------------------------------
//  Acceso al localStorage
//  Envuelvo todo en try/catch: el storage puede estar deshabilitado,
//  lleno, o tener guardado algo que no es JSON válido.
// ------------------------------------------------------------

function leerClave(clave) {
    try {
        const crudo = localStorage.getItem(clave);
        return crudo === null ? null : JSON.parse(crudo);
    } catch {
        return null;
    }
}

function escribirClave(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
        return true;
    } catch {
        return false;
    }
}

// ------------------------------------------------------------
//  Borrador (la cotización en curso)
// ------------------------------------------------------------

export function leerBorrador() {
    const borrador = leerClave(CLAVE_BORRADOR);
    const esUtilizable = borrador !== null &&
        borrador.version === VERSION_BORRADOR &&
        Array.isArray(borrador.items);

    return esUtilizable ? borrador : null;
}

export function guardarBorrador(borrador) {
    return escribirClave(CLAVE_BORRADOR, {
        ...borrador,
        version: VERSION_BORRADOR,
        actualizado: new Date().toISOString()
    });
}

export function borrarBorrador() {
    try {
        localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
        // Si el storage no está disponible, tampoco hay nada que borrar.
    }
}

// ------------------------------------------------------------
//  Historial de cotizaciones
// ------------------------------------------------------------

export function leerHistorial() {
    const historial = leerClave(CLAVE_HISTORIAL);
    return Array.isArray(historial) ? historial : [];
}

/** Devuelve el snapshot guardado, o null si el storage no lo aceptó. */
export function guardarCotizacion(snapshot) {
    const historial = leerHistorial();
    historial.push(snapshot);

    return escribirClave(CLAVE_HISTORIAL, historial) ? snapshot : null;
}

/** Pisa campos de una cotización ya guardada. Devuelve null si no la encuentra o si no se pudo guardar. */
export function modificarCotizacion(numero, cambios) {
    const historial = leerHistorial();
    const cotizacion = historial.find((candidata) => candidata.numero === numero);

    if (!cotizacion) {
        return null;
    }

    Object.assign(cotizacion, cambios);

    return escribirClave(CLAVE_HISTORIAL, historial) ? cotizacion : null;
}

export function borrarCotizacion(numero) {
    const historial = leerHistorial();
    const restantes = historial.filter((cotizacion) => cotizacion.numero !== numero);

    escribirClave(CLAVE_HISTORIAL, restantes);
    return restantes.length < historial.length;
}

/** Vacía por completo el almacenamiento del simulador. */
export function borrarTodo() {
    try {
        localStorage.clear();
    } catch {
        // Igual que arriba: sin storage no hay nada que vaciar.
    }
}

/**
 * Armo el número mirando el más alto que ya hay en el historial.
 * Al principio usaba un contador aparte, pero se repetía al borrar una
 * cotización y con dos pestañas abiertas salían dos con el mismo número.
 */
export function siguienteNumero(historial) {
    const ultimaSecuencia = historial.reduce((maxima, { numero }) => {
        const secuencia = Number.parseInt(String(numero).split("-").at(-1), 10);
        return Number.isInteger(secuencia) && secuencia > maxima ? secuencia : maxima;
    }, 0);

    const anio = new Date().getFullYear();
    return `FEN-${anio}-${String(ultimaSecuencia + 1).padStart(4, "0")}`;
}

// ------------------------------------------------------------
//  Saneamiento
// ------------------------------------------------------------

export function topeDe(servicio) {
    return servicio.maxCantidad || CANTIDAD_MAXIMA_POR_DEFECTO;
}

function existeEn(lista, id) {
    return lista.some((elemento) => elemento.id === id);
}

function textoSeguro(valor, maximo) {
    return typeof valor === "string" ? valor.slice(0, maximo) : "";
}

/**
 * Acomoda lo que venía guardado contra los JSON que acabo de cargar.
 * Corre una sola vez, al arrancar. Si alguien edita servicios.json o
 * toca el localStorage a mano, acá descarto los ids que ya no existen
 * y acomodo las cantidades que quedaron fuera de rango.
 */
export function sanearBorrador(borrador, servicios, configuracion) {
    const { planesSoporte, plazos, mediosPago } = configuracion;
    const guardado = borrador || {};
    const descartados = [];

    const items = (Array.isArray(guardado.items) ? guardado.items : [])
        .map((item) => {
            const servicio = servicios.find((candidato) => candidato.id === item?.id);

            if (!servicio) {
                descartados.push(item?.id);
                return null;
            }

            const tope = topeDe(servicio);
            const pedida = Number.parseInt(item.cantidad, 10);
            const cantidad = Number.isInteger(pedida) ? Math.min(Math.max(pedida, 1), tope) : 1;

            return { id: servicio.id, cantidad };
        })
        .filter((item) => item !== null);

    const clienteGuardado = guardado.cliente || clienteVacio();

    return {
        descartados,
        borrador: {
            items,
            planId: existeEn(planesSoporte, guardado.planId) ? guardado.planId : planesSoporte[0].id,
            plazoId: existeEn(plazos, guardado.plazoId) ? guardado.plazoId : plazos[0].id,
            medioPagoId: existeEn(mediosPago, guardado.medioPagoId) ? guardado.medioPagoId : "",
            cliente: {
                nombre: textoSeguro(clienteGuardado.nombre, LIMITES.nombre),
                email: textoSeguro(clienteGuardado.email, LIMITES.email),
                empresa: textoSeguro(clienteGuardado.empresa, LIMITES.empresa),
                comentarios: textoSeguro(clienteGuardado.comentarios, LIMITES.comentarios)
            },
            paso: Number.isInteger(guardado.paso) ? guardado.paso : 1,
            fase: Object.values(FASES).includes(guardado.fase) ? guardado.fase : FASES.BORRADOR,
            cotizacionActivaId: guardado.cotizacionActivaId || null
        }
    };
}

// ------------------------------------------------------------
//  Cálculo
// ------------------------------------------------------------

/** Dos decimales. Lo aplico en cada paso del cálculo, no solo al final. */
export function redondear(numero) {
    return Math.round(numero * 100) / 100;
}

/**
 * Devuelve el tramo de descuento más alto que llega a cubrir el monto.
 *
 * Al reduce le paso valor inicial a propósito: si el JSON no tuviera el tramo
 * de cero, el filter devolvería vacío y reduce tira error. El inicial es
 * neutro y no copia el texto del JSON: antes repetía acá el objeto entero,
 * etiqueta incluida, y cambiarla en el .json dejaba la vieja viva en el código.
 * Con porcentaje 0 el descuento da 0, y la fila del descuento solo se dibuja
 * cuando es mayor que cero, así que la etiqueta vacía nunca llega a pantalla.
 */
export function resolverTramo(tramos, monto) {
    const neutro = { desde: -1, porcentaje: 0, etiqueta: "" };

    return tramos
        .filter((tramo) => monto >= tramo.desde)
        .reduce((mayor, tramo) => (tramo.desde > mayor.desde ? tramo : mayor), neutro);
}

/**
 * El cálculo completo del presupuesto. Función pura: le paso un objeto y
 * me devuelve otro, sin leer el estado global ni el DOM.
 *
 * Dos cosas del orden que me costaron entender:
 *
 * - El descuento por volumen va sobre la base, antes del plan y del plazo.
 *   Cuando lo dejaba para después, pedir la entrega Express inflaba el
 *   subtotal, cruzaba el umbral siguiente y terminaba dando más descuento.
 *
 * - El ajuste por medio de pago va antes del IVA. El IVA es el 21% del
 *   neto, así que si el recargo se suma después el comprobante no cierra.
 */
export function calcularTotales({ lineas, plan, plazo, medioPago, tramos, iva }) {
    const base = redondear(
        lineas.reduce((acumulado, { precioUnitario, cantidad }) => acumulado + precioUnitario * cantidad, 0)
    );
    const horas = lineas.reduce((acumulado, { horas: horasLinea, cantidad }) => acumulado + horasLinea * cantidad, 0);

    const tramo = resolverTramo(tramos, base);
    const descuento = redondear(base * tramo.porcentaje);
    const baseNeta = redondear(base - descuento);

    const soporte = redondear(baseNeta * (plan.multiplicador - 1));
    const recargoPlazo = redondear(baseNeta * plazo.recargo);
    const neto = redondear(baseNeta + soporte + recargoPlazo);

    const porcentajeAjuste = medioPago ? medioPago.ajuste : 0;
    const ajustePago = redondear(neto * porcentajeAjuste);
    const netoFinal = redondear(neto + ajustePago);

    const montoIva = redondear(netoFinal * iva);
    const totalAPagar = redondear(netoFinal + montoIva);

    return {
        base,
        horas,
        tramo,
        descuento,
        baseNeta,
        soporte,
        recargoPlazo,
        neto,
        ajustePago,
        netoFinal,
        iva: montoIva,
        tasaIva: iva,
        totalAPagar,
        semanas: plazo.semanas
    };
}

/**
 * Vuelve a cerrar el total aplicando el medio de pago elegido.
 * Parte de los montos guardados en la cotización y no de los JSON: una
 * cotización ya emitida no tiene que cambiar de precio porque después
 * toqué la lista de precios.
 */
export function aplicarMedioPago(totales, medioPago) {
    const porcentajeAjuste = medioPago ? medioPago.ajuste : 0;

    const ajustePago = redondear(totales.neto * porcentajeAjuste);
    const netoFinal = redondear(totales.neto + ajustePago);
    const montoIva = redondear(netoFinal * totales.tasaIva);

    return {
        ...totales,
        ajustePago,
        netoFinal,
        iva: montoIva,
        totalAPagar: redondear(netoFinal + montoIva)
    };
}
