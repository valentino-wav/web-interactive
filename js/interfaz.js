import { ESTADOS, FASES, LIMITES } from "./datos.js";

const nodos = {
    cotizador: document.getElementById("cotizador"),
    avisoServidor: document.getElementById("aviso-servidor"),
    cargando: document.getElementById("cotizador-cargando"),
    error: document.getElementById("cotizador-error"),
    errorMensaje: document.getElementById("cotizador-error-mensaje"),
    contenido: document.getElementById("cotizador-contenido"),
    barraPasos: document.getElementById("paso-barra"),
    catalogoGrid: document.getElementById("catalogo-grid"),
    catalogoFiltros: document.getElementById("catalogo-filtros"),
    presupuestoLista: document.getElementById("presupuesto-lista"),
    resumen: document.getElementById("presupuesto-resumen"),
    botonVaciar: document.getElementById("btn-vaciar-presupuesto"),
    buscador: document.getElementById("catalogo-buscador"),
    confirmacionResumen: document.getElementById("confirmacion-resumen"),
    confirmacionPago: document.getElementById("confirmacion-pago"),
    exito: document.getElementById("exito-detalle"),
    historialLista: document.getElementById("historial-lista")
};

const CAMPOS_CLIENTE = ["nombre", "email", "empresa", "comentarios"];

// Las llena configurar() con lo que venga del JSON. Arrancan con el id crudo
// para que, si algo falla antes de configurar, se vea "contratada" y no vacío.
let etiquetasEstado = Object.fromEntries(Object.values(ESTADOS).map((id) => [id, id]));

// El idioma de la interfaz es del código; la moneda es dato de negocio y
// sale de configuracion.json. Hasta que configurar() corra, formatea números
// pelados: nadie llega a ver precios antes de que carguen los datos.
const IDIOMA = "es-AR";

let formatoMoneda = new Intl.NumberFormat(IDIOMA);

const formatoFecha = new Intl.DateTimeFormat(IDIOMA, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

/**
 * Lo que interfaz.js necesita saber de configuracion.json: con qué moneda
 * formatear y cómo se llama cada estado. La llama app.js apenas cargan los
 * datos, antes del primer render.
 */
export function configurar({ moneda, estadosCotizacion }) {
    formatoMoneda = new Intl.NumberFormat(IDIOMA, {
        style: "currency",
        currency: moneda,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    etiquetasEstado = estadosCotizacion;

    // Los maxlength salen de LIMITES, así el tope que corta el navegador y el
    // que recorta el saneo son el mismo número y no se pueden desincronizar.
    CAMPOS_CLIENTE.forEach((campo) => {
        document.getElementById(`cliente-${campo}`).maxLength = LIMITES[campo];
    });
}

/**
 * Solo da formato, no redondea. El redondeo ya lo hice en cada paso del
 * cálculo; redondeando acá también, la suma de las líneas no daba el total.
 */
export function formatearMoneda(numero) {
    return formatoMoneda.format(numero);
}

export function formatearFecha(iso) {
    return formatoFecha.format(new Date(iso));
}

export function formatearPorcentaje(fraccion) {
    return `${Math.round(Math.abs(fraccion) * 100)}%`;
}

/**
 * Desactiva los caracteres que el navegador leería como HTML.
 * Lo paso por todo texto que no escribí yo (lo que el visitante carga en
 * el formulario) antes de meterlo con innerHTML.
 */
function escapar(texto) {
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// ------------------------------------------------------------
//  Estados de carga
// ------------------------------------------------------------

/** El aviso arranca visible en el HTML. Si el JS llegó a correr, ya no hace falta. */
export function ocultarAvisoServidor() {
    nodos.avisoServidor.hidden = true;
}

export function mostrarCargando(activo) {
    nodos.cargando.hidden = !activo;
}

export function mostrarErrorCarga(mensaje) {
    nodos.errorMensaje.textContent = mensaje;
    nodos.error.hidden = false;
    nodos.contenido.hidden = true;
}

export function ocultarErrorCarga() {
    nodos.error.hidden = true;
}

export function mostrarContenido() {
    nodos.contenido.hidden = false;
}

// ------------------------------------------------------------
//  Avisos y confirmaciones
// ------------------------------------------------------------

/**
 * Los colores los define el CSS en :root. Los leo una sola vez en lugar de
 * repetirlos acá: así cambiar --lima en la hoja de estilos también cambia los
 * modales y las notificaciones, que es lo que uno espera. Los valores de
 * respaldo son por si la hoja no llegó a cargar.
 */
const raizCss = getComputedStyle(document.documentElement);

/** Lee una custom property del :root. Ojo con el nombre: adentro de
 *  notificar() hay una variable "color", y si esta función se llamaba igual
 *  la tapaba y reventaba al intentar llamar a un string. */
const tokenCss = (nombre, respaldo) => raizCss.getPropertyValue(nombre).trim() || respaldo;

const PALETA = {
    lima: tokenCss("--lima", "#b4e61a"),
    carta: tokenCss("--gris-card", "#111"),
    cartaSuave: tokenCss("--gris-card-suave", "#181818"),
    texto: tokenCss("--texto", "#fff"),
    rojo: tokenCss("--rojo", "#ff6b6b")
};

const COLORES_AVISO = {
    exito: PALETA.lima,
    info: PALETA.texto,
    error: PALETA.rojo
};

/** Aviso corto con Toastify. Lo uso como refuerzo, nunca como único lugar donde aparece el mensaje. */
export function notificar(tipo, mensaje) {
    if (typeof Toastify === "undefined") {
        return;
    }

    const colorAviso = COLORES_AVISO[tipo] || COLORES_AVISO.info;

    Toastify({
        text: mensaje,
        duration: 2800,
        gravity: "bottom",
        position: "right",
        close: true,
        style: {
            background: PALETA.carta,
            color: colorAviso,
            border: `1px solid ${colorAviso}`,
            borderRadius: tokenCss("--radio-chico", "8px"),
            fontFamily: tokenCss("--fuente-texto", '"Pliant", sans-serif'),
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)"
        }
    }).showToast();
}

/** El mensaje que queda fijo dentro del paso. Este sí es el principal cuando algo no valida. */
export function mostrarAvisoPaso(numero, mensaje) {
    const aviso = document.getElementById(`aviso-paso-${numero}`);

    if (!aviso) {
        return;
    }

    aviso.textContent = mensaje;
    aviso.hidden = mensaje === "";
}

export function limpiarAvisosPaso(pasos) {
    pasos.forEach(({ numero }) => mostrarAvisoPaso(numero, ""));
}

/**
 * El cuerpo del modal que pide confirmar la contratación.
 * No recibe número de cotización: al fusionar confirmar y pagar, el número
 * recién se emite después de que el usuario acepta este modal.
 */
export function cuerpoConfirmacionPago(monto, nombreMedio) {
    return `
        <p>Estás por contratar los servicios de tu presupuesto.</p>
        <p class="modal-monto">${formatearMoneda(monto)}</p>
        <p>Medio de pago: <strong>${escapar(nombreMedio)}</strong>.<br>
           Al confirmar, el servicio queda contratado.</p>`;
}

/** Le pregunta al usuario y devuelve true o false. */
export async function confirmar(titulo, cuerpoHtml, textoConfirmar) {
    const { isConfirmed } = await Swal.fire({
        title: titulo,
        html: cuerpoHtml,
        showCancelButton: true,
        confirmButtonText: textoConfirmar,
        cancelButtonText: "Cancelar",
        background: PALETA.carta,
        color: PALETA.texto,
        confirmButtonColor: PALETA.lima,
        cancelButtonColor: PALETA.cartaSuave,
        reverseButtons: true,
        focusCancel: true
    });

    return isConfirmed;
}

/** Apago un botón mientras algo está en curso, para que no se pueda clickear dos veces. */
export function ocupado(idBoton, activo, textoOcupado = "Procesando…") {
    const boton = document.getElementById(idBoton);

    if (!boton) {
        return;
    }

    if (activo) {
        boton.dataset.textoOriginal = boton.textContent.trim();
        boton.textContent = textoOcupado;
    } else if (boton.dataset.textoOriginal) {
        boton.textContent = boton.dataset.textoOriginal;
    }

    boton.disabled = activo;
    boton.setAttribute("aria-busy", String(activo));
}

/** La cortina que tapa la pantalla mientras "se procesa" el pago. */
export function procesando(mostrar) {
    const existente = document.getElementById("pago-procesando");

    if (!mostrar) {
        existente?.remove();
        return;
    }

    if (existente) {
        return;
    }

    const capa = document.createElement("div");
    capa.className = "modal-propio";
    capa.id = "pago-procesando";
    capa.innerHTML = `
        <div class="modal-propio-caja pago-procesando" role="status" aria-live="assertive">
            <span class="cotizador-spinner" aria-hidden="true"></span>
            <p>Procesando el pago…</p>
        </div>`;

    document.body.append(capa);
}

// ------------------------------------------------------------
//  Navegación entre pasos
// ------------------------------------------------------------

export function renderBarraPasos(pasos, pasoActual, pasoMaximo, pasoMinimo = 1) {
    nodos.barraPasos.innerHTML = pasos
        .map(({ numero, titulo }) => {
            const alcanzable = numero >= pasoMinimo && numero <= pasoMaximo;
            const completado = numero < pasoActual;
            const actual = numero === pasoActual;

            return `
            <li class="paso-barra-item">
                <button type="button" class="paso-barra-boton" data-ir="${numero}"
                        data-estado="${completado ? "completado" : "pendiente"}"
                        ${actual ? 'aria-current="step"' : ""}
                        ${alcanzable ? "" : "disabled"}>
                    <span class="paso-barra-numero">${completado ? "✓" : numero}</span>
                    <span class="paso-barra-titulo">${titulo}</span>
                </button>
            </li>`;
        })
        .join("");
}

export function mostrarPaso(pasos, numero) {
    pasos.forEach((paso) => {
        // Los pasos vienen del JSON, así que no doy por hecho que exista el panel.
        const panel = document.getElementById(`paso-panel-${paso.numero}`);

        if (panel) {
            panel.hidden = paso.numero !== numero;
        }
    });
}

export function irAlCotizador() {
    nodos.cotizador.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------
//  Catálogo
// ------------------------------------------------------------

/** Los botones de categoría. Marco el activo con aria-pressed y lo pinto desde el CSS. */
export function renderFiltros(categorias, categoriaActiva) {
    nodos.catalogoFiltros.innerHTML = categorias
        .map((categoria) => `
            <button type="button" class="filtro-chip" data-categoria="${categoria}"
                    aria-pressed="${categoria === categoriaActiva}">${categoria}</button>`)
        .join("");
}

/**
 * Dibuja las tarjetas del catálogo.
 * Le paso `idsElegidos` para marcar los que ya están en el presupuesto.
 */
export function renderCatalogo(servicios, idsElegidos = [], { soloLectura = false } = {}) {
    if (servicios.length === 0) {
        nodos.catalogoGrid.innerHTML = `
            <p class="catalogo-vacio">No encontramos servicios que coincidan con tu búsqueda.</p>`;
        return;
    }

    nodos.catalogoGrid.innerHTML = servicios
        .map(({ id, nombre, categoria, descripcion, precioBase, horas, unidad }) => {
            const yaElegido = idsElegidos.some((elegido) => elegido === id);

            return `
            <article class="servicio-tarjeta${yaElegido ? " servicio-tarjeta-elegida" : ""}">
                <p class="servicio-categoria">${categoria}</p>
                <h4 class="servicio-nombre">${nombre}</h4>
                <p class="servicio-descripcion">${descripcion}</p>
                <dl class="servicio-datos">
                    <div>
                        <dt>Desde</dt>
                        <dd>${formatearMoneda(precioBase)}</dd>
                    </div>
                    <div>
                        <dt>Estimado</dt>
                        <dd>${horas} h por ${unidad}</dd>
                    </div>
                </dl>
                <button type="button" class="btn-lima btn-bloque" data-accion="agregar" data-id="${id}"
                        ${soloLectura ? "disabled" : ""}>
                    ${yaElegido ? "Agregar otro" : "Agregar al presupuesto"}
                </button>
            </article>`;
        })
        .join("");
}

// ------------------------------------------------------------
//  Presupuesto y resúmenes
// ------------------------------------------------------------

export function renderPresupuesto(lineas, { soloLectura = false } = {}) {
    if (lineas.length === 0) {
        nodos.presupuestoLista.innerHTML = `
            <p class="presupuesto-vacio">
                Todavía no agregaste servicios. Elegí uno del catálogo para empezar.
            </p>`;
        return;
    }

    nodos.presupuestoLista.innerHTML = lineas
        .map(({ id, nombre, cantidad, unidad, unidadPlural, maxCantidad, subtotal }) => {
            const controles = soloLectura ? "" : `
                <div class="fila-controles">
                    <button type="button" class="cantidad-boton" data-accion="restar" data-id="${id}"
                            aria-label="Quitar una unidad de ${nombre}" ${cantidad <= 1 ? "disabled" : ""}>−</button>
                    <span class="cantidad-valor">${cantidad}</span>
                    <button type="button" class="cantidad-boton" data-accion="sumar" data-id="${id}"
                            aria-label="Agregar una unidad de ${nombre}" ${cantidad >= maxCantidad ? "disabled" : ""}>+</button>
                    <button type="button" class="fila-quitar" data-accion="quitar" data-id="${id}">Quitar</button>
                </div>`;

            return `
            <div class="presupuesto-fila">
                <div>
                    <h4>${nombre}</h4>
                    <p class="fila-detalle">${cantidad} ${cantidad === 1 ? unidad : unidadPlural}</p>
                </div>
                <p class="fila-precio">${formatearMoneda(subtotal)}</p>
                ${controles}
            </div>`;
        })
        .join("");
}

function filaResumen(etiqueta, valor, clase = "") {
    return `
        <div class="resumen-fila${clase ? ` ${clase}` : ""}">
            <span>${etiqueta}</span>
            <span>${valor}</span>
        </div>`;
}

/** El cierre de todo resumen: separador y total. Estaba escrito tres veces. */
function totalFinal(etiqueta, monto) {
    return `
        <div class="resumen-separador"></div>
        <div class="resumen-total">
            <span>${etiqueta}</span>
            <span>${formatearMoneda(monto)}</span>
        </div>`;
}

/** El resumen corto que acompaña al presupuesto en el paso 1. */
export function renderResumenes(totales, { vacio = false } = {}) {
    const bloque = nodos.resumen;

    if (vacio) {
        bloque.innerHTML = `<p class="resumen-nota">Agregá servicios para ver el total.</p>`;
        return;
    }

    const { base, descuento, tramo, totalAPagar, horas, semanas } = totales;

    bloque.innerHTML = [
        filaResumen("Servicios", formatearMoneda(base)),
        descuento > 0
            ? filaResumen(tramo.etiqueta, `− ${formatearMoneda(descuento)}`, "resumen-fila-descuento")
            : "",
        totalFinal("Total", totalAPagar),
        `<p class="resumen-nota">${horas} horas estimadas · entrega en ${semanas} semanas</p>`
    ].join("");
}

// ------------------------------------------------------------
//  Paso 3: datos del cliente
// ------------------------------------------------------------

export function leerFormularioCliente() {
    const cliente = {};

    CAMPOS_CLIENTE.forEach((campo) => {
        cliente[campo] = document.getElementById(`cliente-${campo}`).value.trim();
    });

    return cliente;
}

export function pintarFormularioCliente(cliente) {
    CAMPOS_CLIENTE.forEach((campo) => {
        document.getElementById(`cliente-${campo}`).value = cliente[campo] || "";
    });
}

/**
 * Apaga todo lo que no se puede tocar con la cotización ya confirmada.
 * El botón de vaciar se me había escapado: no lo dibuja ningún render, así
 * que quedaba habilitado y se podía vaciar un presupuesto ya emitido.
 */
export function bloquearEdicion(soloLectura) {
    CAMPOS_CLIENTE.forEach((campo) => {
        document.getElementById(`cliente-${campo}`).disabled = soloLectura;
    });

    nodos.botonVaciar.disabled = soloLectura;
}

/** El input vive en el HTML, así que resetear el estado no lo limpia solo. */
export function limpiarBuscador() {
    nodos.buscador.value = "";
}

/** Muestro todos los errores juntos, no de a uno, y mando el foco al primer campo que falla. */
export function mostrarErroresCliente(errores) {
    let primerInvalido = null;

    CAMPOS_CLIENTE.forEach((campo) => {
        const entrada = document.getElementById(`cliente-${campo}`);
        const aviso = document.getElementById(`error-${campo}`);
        const mensaje = errores[campo];

        entrada.setAttribute("aria-invalid", String(Boolean(mensaje)));

        if (mensaje && !primerInvalido) {
            primerInvalido = entrada;
        }

        if (aviso) {
            aviso.textContent = mensaje || "";
            aviso.hidden = !mensaje;
        }
    });

    primerInvalido?.focus();
}

// ------------------------------------------------------------
//  Paso 2: confirmación y pago
// ------------------------------------------------------------

/** La lista de ítems, con su <ul>. Antes el envoltorio estaba repetido. */
function listaLineas(lineas) {
    const items = lineas
        .map(({ nombre, cantidad, unidad, unidadPlural, subtotal }) => `
            <li>
                <span>${nombre} · ${cantidad} ${cantidad === 1 ? unidad : unidadPlural}</span>
                <span>${formatearMoneda(subtotal)}</span>
            </li>`)
        .join("");

    return `<ul class="comprobante-items">${items}</ul>`;
}

/** Un grupo de radios armado desde el JSON. `describir` arma el sufijo de
 *  cada opción, así la misma función sirve para cualquier lista. */
function grupoOpciones(leyenda, nombreGrupo, opciones, seleccionado, describir) {
    const items = opciones
        .map((opcion) => `
            <label class="opcion-item">
                <input type="radio" name="${nombreGrupo}" value="${opcion.id}"
                       ${opcion.id === seleccionado ? "checked" : ""}>
                <span class="opcion-texto">
                    <strong>${opcion.nombre}${describir(opcion)}</strong>
                    <small>${opcion.descripcion}</small>
                </span>
            </label>`)
        .join("");

    return `
        <fieldset class="opcion-grupo">
            <legend>${leyenda}</legend>
            ${items}
        </fieldset>`;
}

/**
 * El resumen de lo que se está por contratar: servicios, datos de contacto y
 * los totales antes del medio de pago.
 */
export function renderConfirmacion(lineas, totales, cliente) {
    const { nombre, email, empresa, comentarios } = cliente;

    nodos.confirmacionResumen.innerHTML = `
        <div class="revision-bloque">
            <h4>Servicios</h4>
            ${listaLineas(lineas)}
            <dl class="revision-datos">
                <dt>Horas estimadas</dt><dd>${totales.horas} h</dd>
                <dt>Entrega estimada</dt><dd>${totales.semanas} semanas</dd>
            </dl>
        </div>

        <div class="revision-bloque">
            <h4>Datos de contacto</h4>
            <dl class="revision-datos">
                <dt>Nombre</dt><dd>${escapar(nombre)}</dd>
                <dt>Correo</dt><dd>${escapar(email)}</dd>
                <dt>Empresa</dt><dd>${escapar(empresa || "Particular")}</dd>
                ${comentarios ? `<dt>Comentarios</dt><dd>${escapar(comentarios)}</dd>` : ""}
            </dl>
        </div>`;
}

/** Los medios de pago y el total definitivo, que depende del elegido. */
export function renderPago(mediosPago, medioPagoId, totales) {
    const ajuste = totales.ajustePago;
    const claseAjuste = ajuste >= 0 ? "pago-ajuste-positivo" : "pago-ajuste-negativo";

    const describirMedio = ({ ajuste: porcentaje }) => porcentaje === 0
        ? ""
        : ` · ${porcentaje > 0 ? "+" : "−"}${formatearPorcentaje(porcentaje)}`;

    nodos.confirmacionPago.innerHTML = `
        ${grupoOpciones("Elegí cómo pagar", "medio-pago", mediosPago, medioPagoId, describirMedio)}

        <div class="presupuesto-resumen pago-total">
            ${filaResumen("Servicios", formatearMoneda(totales.base))}
            ${totales.descuento > 0
                ? filaResumen(totales.tramo.etiqueta, `− ${formatearMoneda(totales.descuento)}`, "resumen-fila-descuento")
                : ""}
            ${ajuste !== 0
                ? filaResumen("Ajuste por medio de pago",
                    `${ajuste > 0 ? "+" : "−"} ${formatearMoneda(Math.abs(ajuste))}`, claseAjuste)
                : ""}
            ${filaResumen(`IVA (${formatearPorcentaje(totales.tasaIva)})`, formatearMoneda(totales.iva))}
            ${totalFinal("Total a pagar", totales.totalAPagar)}
        </div>`;
}

// ------------------------------------------------------------
//  Paso 6: contratado
// ------------------------------------------------------------

export function renderExito(snapshot) {
    const { numero, cliente, medioPago, totalPagado, fechaContratacion, totales } = snapshot;

    nodos.exito.innerHTML = `
        <p class="exito-icono" aria-hidden="true">✓</p>
        <h3 class="exito-titulo">¡Servicio contratado!</h3>
        <p class="exito-texto">
            Gracias, ${escapar(cliente.nombre)}. Registramos el pago de tu cotización
            <strong class="exito-numero">${numero}</strong> y ya estamos armando tu equipo de trabajo.
        </p>
        <p class="exito-texto">
            <strong>Nos vamos a estar contactando a la brevedad</strong> a
            <strong>${escapar(cliente.email)}</strong> para coordinar la reunión de inicio.
        </p>

        <dl class="revision-datos exito-datos">
            <dt>Monto abonado</dt><dd>${formatearMoneda(totalPagado)}</dd>
            <dt>Medio de pago</dt><dd>${medioPago.nombre}</dd>
            <dt>Fecha</dt><dd>${formatearFecha(fechaContratacion)}</dd>
            <dt>Entrega estimada</dt><dd>${totales.semanas} semanas</dd>
        </dl>

        <button type="button" class="btn-borde" data-accion="comprobante" data-numero="${numero}">
            Ver comprobante
        </button>`;
}

// ------------------------------------------------------------
//  Comprobante
// ------------------------------------------------------------

/** Lo abonado, o el total si todavía no se pagó. Con ?? en lugar de === null,
 *  que con un snapshot sin ese campo imprimía NaN. */
function montoDe({ totales, totalPagado }) {
    return totalPagado ?? totales.totalAPagar;
}

function comprobanteHtml(snapshot) {
    const { numero, fecha, cliente, lineas, medioPago, totales, estado } = snapshot;

    return `
        <div class="comprobante">
            <dl>
                <dt>Cotización</dt><dd>${numero}</dd>
                <dt>Fecha</dt><dd>${formatearFecha(fecha)}</dd>
                <dt>Estado</dt><dd>${etiquetasEstado[estado]}</dd>
                <dt>Cliente</dt><dd>${escapar(cliente.nombre)}</dd>
                <dt>Empresa</dt><dd>${escapar(cliente.empresa || "Particular")}</dd>
                <dt>Entrega</dt><dd>${totales.semanas} semanas</dd>
                ${medioPago ? `<dt>Medio de pago</dt><dd>${medioPago.nombre}</dd>` : ""}
            </dl>
            ${listaLineas(lineas)}
            <div class="comprobante-total">
                <span>Total</span>
                <span>${formatearMoneda(montoDe(snapshot))}</span>
            </div>
        </div>`;
}

export function mostrarComprobante(snapshot) {
    Swal.fire({
        title: `Comprobante ${snapshot.numero}`,
        html: comprobanteHtml(snapshot),
        background: PALETA.carta,
        color: PALETA.texto,
        confirmButtonText: "Cerrar",
        confirmButtonColor: PALETA.lima,
        width: 560
    });
}

// ------------------------------------------------------------
//  Historial
// ------------------------------------------------------------

export function renderHistorial(cotizaciones, cotizacionActivaId) {
    if (cotizaciones.length === 0) {
        nodos.historialLista.innerHTML = `
            <p class="historial-vacio">
                Todavía no confirmaste ninguna cotización. Las que confirmes van a quedar guardadas acá.
            </p>`;
        return;
    }

    nodos.historialLista.innerHTML = [...cotizaciones]
        .reverse()
        .map((cotizacion) => {
            const { numero, fecha, estado, cliente, lineas } = cotizacion;
            const esActiva = numero === cotizacionActivaId;

            return `
            <article class="historial-tarjeta${esActiva ? " historial-tarjeta-activa" : ""}">
                <div class="historial-encabezado-tarjeta">
                    <p class="historial-numero">${numero}</p>
                    <span class="estado-pastilla" data-estado="${estado}">${etiquetasEstado[estado]}</span>
                </div>
                <p class="historial-fecha">${formatearFecha(fecha)}</p>
                <p class="historial-cliente">${escapar(cliente.nombre)} · ${escapar(cliente.empresa || "Particular")}</p>
                <ul class="historial-items">
                    ${lineas.map(({ nombre, cantidad }) => `<li>${cantidad} × ${nombre}</li>`).join("")}
                </ul>
                <div class="historial-total">
                    <span>${estado === ESTADOS.CONTRATADA ? "Abonado" : "Total"}</span>
                    <span>${formatearMoneda(montoDe(cotizacion))}</span>
                </div>
                <div class="historial-acciones">
                    <button type="button" class="btn-ver-comprobante" data-accion="comprobante" data-numero="${numero}">
                        Ver comprobante
                    </button>
                    ${estado === ESTADOS.PENDIENTE ? `
                        <button type="button" class="btn-cancelar-cotizacion" data-accion="cancelar-cotizacion"
                                data-numero="${numero}">Cancelar cotización</button>` : ""}
                    ${esActiva ? "" : `
                        <button type="button" class="btn-borrar-cotizacion" data-accion="borrar-cotizacion"
                                data-numero="${numero}">Borrar</button>`}
                </div>
            </article>`;
        })
        .join("");
}
