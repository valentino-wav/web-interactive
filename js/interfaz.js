// ============================================================
//  interfaz.js — Todo lo que se ve.
//  Acá está cada innerHTML y cada texto que le llega al usuario.
//  En este archivo no guardo estado ni hago cuentas de precios.
// ============================================================

const nodos = {
    cotizador: document.getElementById("cotizador"),
    avisoServidor: document.getElementById("aviso-servidor"),
    cargando: document.getElementById("cotizador-cargando"),
    error: document.getElementById("cotizador-error"),
    errorMensaje: document.getElementById("cotizador-error-mensaje"),
    contenido: document.getElementById("cotizador-contenido"),
    barraPasos: document.getElementById("paso-barra"),
    bannerCongelado: document.getElementById("banner-congelado"),
    bannerCongeladoTexto: document.getElementById("banner-congelado-texto"),
    botonEditar: document.getElementById("btn-editar-cotizacion"),
    catalogoGrid: document.getElementById("catalogo-grid"),
    catalogoFiltros: document.getElementById("catalogo-filtros"),
    presupuestoLista: document.getElementById("presupuesto-lista"),
    opciones: document.getElementById("presupuesto-opciones"),
    revision: document.getElementById("revision-detalle"),
    pagoDetalle: document.getElementById("pago-detalle"),
    pagoMedios: document.getElementById("pago-medios"),
    exito: document.getElementById("exito-detalle"),
    historialLista: document.getElementById("historial-lista")
};

const CAMPOS_CLIENTE = ["nombre", "email", "empresa", "comentarios"];

const ETIQUETAS_ESTADO = {
    "pendiente-pago": "Pendiente de pago",
    contratada: "Contratada",
    anulada: "Anulada"
};

const formatoMoneda = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

const formatoFecha = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

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

const COLORES_AVISO = {
    exito: "#b4e61a",
    info: "#ffffff",
    error: "#ff6b6b"
};

/** Aviso corto con Toastify. Lo uso como refuerzo, nunca como único lugar donde aparece el mensaje. */
export function notificar(tipo, mensaje) {
    if (typeof Toastify === "undefined") {
        return;
    }

    const color = COLORES_AVISO[tipo] || COLORES_AVISO.info;

    Toastify({
        text: mensaje,
        duration: 2800,
        gravity: "bottom",
        position: "right",
        close: true,
        style: {
            background: "#111",
            color: color,
            border: `1px solid ${color}`,
            borderRadius: "8px",
            fontFamily: '"Pliant", sans-serif',
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
 * Mi propio modal, por si SweetAlert2 no llegó a cargar (sin internet, por
 * ejemplo). Prefiero esto antes que quedarme sin confirmación o caer en los
 * cuadros de diálogo nativos del navegador.
 */
function modalPropio(titulo, cuerpoHtml, textoConfirmar, conCancelar) {
    return new Promise((resolver) => {
        const capa = document.createElement("div");
        capa.className = "modal-propio";
        capa.innerHTML = `
            <div class="modal-propio-caja" role="dialog" aria-modal="true">
                <h3>${escapar(titulo)}</h3>
                <div class="modal-propio-cuerpo">${cuerpoHtml}</div>
                <div class="modal-propio-acciones">
                    ${conCancelar ? '<button type="button" class="btn-borde" data-respuesta="no">Cancelar</button>' : ""}
                    <button type="button" class="btn-lima" data-respuesta="si">${escapar(textoConfirmar)}</button>
                </div>
            </div>`;

        capa.addEventListener("click", (evento) => {
            const boton = evento.target.closest("[data-respuesta]");
            if (!boton) {
                return;
            }
            capa.remove();
            resolver(boton.dataset.respuesta === "si");
        });

        document.body.append(capa);
        capa.querySelector('[data-respuesta="si"]').focus();
    });
}

/** Le pregunta al usuario y devuelve true o false. */
export async function confirmar(titulo, cuerpoHtml, textoConfirmar = "Confirmar") {
    if (typeof Swal === "undefined") {
        return modalPropio(titulo, cuerpoHtml, textoConfirmar, true);
    }

    const { isConfirmed } = await Swal.fire({
        title: titulo,
        html: cuerpoHtml,
        showCancelButton: true,
        confirmButtonText: textoConfirmar,
        cancelButtonText: "Cancelar",
        background: "#111",
        color: "#ffffff",
        confirmButtonColor: "#b4e61a",
        cancelButtonColor: "#333333",
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
export function procesando(mostrar, mensaje = "Procesando el pago…") {
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
            <p>${escapar(mensaje)}</p>
        </div>`;

    document.body.append(capa);
}

// ------------------------------------------------------------
//  Navegación entre pasos
// ------------------------------------------------------------

export function renderBarraPasos(pasos, pasoActual, pasoMaximo) {
    nodos.barraPasos.innerHTML = pasos
        .map(({ numero, titulo }) => {
            const alcanzable = numero <= pasoMaximo;
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

/**
 * Solo lo muestro cuando la cotizacion esta confirmada y sin pagar, que es
 * el unico momento en que "Editar" hace algo. Una vez pagada no se puede
 * tocar nada, asi que el aviso solo ocuparia lugar.
 */
export function mostrarBannerCongelado(fase, numero) {
    const sePuedeAnular = fase === "confirmada";

    nodos.bannerCongelado.hidden = !sePuedeAnular;

    if (sePuedeAnular) {
        nodos.bannerCongeladoTexto.textContent = `${numero} confirmada y esperando el pago.`;
    }
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

/**
 * Llena todos los resúmenes de la página de una sola vez. Cada bloque dice
 * cuánto detalle quiere con data-resumen, así no necesito una función por
 * cada lugar donde aparece.
 */
export function renderResumenes(totales, { vacio = false } = {}) {
    document.querySelectorAll("[data-resumen]").forEach((bloque) => {
        if (vacio) {
            bloque.innerHTML = `<p class="resumen-nota">Agregá servicios para ver el total.</p>`;
            return;
        }

        const { base, descuento, tramo, soporte, recargoPlazo, iva, totalAPagar, horas, semanas } = totales;
        const detallado = bloque.dataset.resumen === "detallado";
        const filas = [filaResumen("Servicios", formatearMoneda(base))];

        if (descuento > 0) {
            filas.push(filaResumen(tramo.etiqueta, `− ${formatearMoneda(descuento)}`, "resumen-fila-descuento"));
        }

        if (detallado) {
            if (soporte > 0) {
                filas.push(filaResumen("Plan de soporte", `+ ${formatearMoneda(soporte)}`));
            }
            if (recargoPlazo > 0) {
                filas.push(filaResumen("Recargo por plazo", `+ ${formatearMoneda(recargoPlazo)}`));
            }
            filas.push(filaResumen("IVA", formatearMoneda(iva)));
        }

        filas.push('<div class="resumen-separador"></div>');
        filas.push(`
            <div class="resumen-total">
                <span>Total</span>
                <span>${formatearMoneda(totalAPagar)}</span>
            </div>`);
        filas.push(`<p class="resumen-nota">${horas} horas estimadas · entrega en ${semanas} semanas</p>`);

        bloque.innerHTML = filas.join("");
    });
}

// ------------------------------------------------------------
//  Paso 2: plan y plazo
// ------------------------------------------------------------

function grupoOpciones(leyenda, nombreGrupo, opciones, seleccionado, soloLectura, describir) {
    const items = opciones
        .map((opcion) => `
            <label class="opcion-item">
                <input type="radio" name="${nombreGrupo}" value="${opcion.id}"
                       ${opcion.id === seleccionado ? "checked" : ""} ${soloLectura ? "disabled" : ""}>
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

export function renderOpciones(planes, plazos, planId, plazoId, { soloLectura = false } = {}) {
    const describirPlan = ({ multiplicador }) => multiplicador === 1
        ? ""
        : ` · +${formatearPorcentaje(multiplicador - 1)}`;

    const describirPlazo = ({ recargo, semanas }) => recargo === 0
        ? ` · ${semanas} semanas`
        : ` · ${semanas} semanas, +${formatearPorcentaje(recargo)}`;

    nodos.opciones.innerHTML =
        grupoOpciones("Plan de soporte", "plan", planes, planId, soloLectura, describirPlan) +
        grupoOpciones("Plazo de entrega", "plazo", plazos, plazoId, soloLectura, describirPlazo);
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

export function bloquearFormularioCliente(soloLectura) {
    CAMPOS_CLIENTE.forEach((campo) => {
        document.getElementById(`cliente-${campo}`).disabled = soloLectura;
    });
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
//  Paso 4: revisión
// ------------------------------------------------------------

function listaLineas(lineas) {
    return lineas
        .map(({ nombre, cantidad, unidad, unidadPlural, subtotal }) => `
            <li>
                <span>${nombre} · ${cantidad} ${cantidad === 1 ? unidad : unidadPlural}</span>
                <span>${formatearMoneda(subtotal)}</span>
            </li>`)
        .join("");
}

function bloqueTotales(totales) {
    return `
        ${filaResumen("Servicios", formatearMoneda(totales.base))}
        ${totales.descuento > 0
            ? filaResumen(totales.tramo.etiqueta, `− ${formatearMoneda(totales.descuento)}`, "resumen-fila-descuento")
            : ""}
        ${totales.soporte > 0 ? filaResumen("Plan de soporte", `+ ${formatearMoneda(totales.soporte)}`) : ""}
        ${totales.recargoPlazo > 0 ? filaResumen("Recargo por plazo", `+ ${formatearMoneda(totales.recargoPlazo)}`) : ""}
        ${filaResumen("Subtotal", formatearMoneda(totales.netoFinal))}
        ${filaResumen(`IVA (${formatearPorcentaje(totales.tasaIva)})`, formatearMoneda(totales.iva))}
        <div class="resumen-separador"></div>
        <div class="resumen-total">
            <span>Total</span>
            <span>${formatearMoneda(totales.totalAPagar)}</span>
        </div>`;
}

export function renderRevision(lineas, totales, plan, plazo, cliente) {
    const { nombre, email, empresa, comentarios } = cliente;

    nodos.revision.innerHTML = `
        <div class="revision-bloque">
            <h4>Servicios</h4>
            <ul class="comprobante-items">${listaLineas(lineas)}</ul>
        </div>

        <div class="revision-bloque">
            <h4>Condiciones</h4>
            <dl class="revision-datos">
                <dt>Plan de soporte</dt><dd>${plan.nombre}</dd>
                <dt>Plazo de entrega</dt><dd>${plazo.nombre} · ${plazo.semanas} semanas</dd>
                <dt>Horas estimadas</dt><dd>${totales.horas} h</dd>
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
        </div>

        <div class="revision-bloque revision-totales">${bloqueTotales(totales)}</div>`;
}

// ------------------------------------------------------------
//  Paso 5: pago
// ------------------------------------------------------------

export function renderPago(snapshot, mediosPago, medioPagoId, totalesConAjuste) {
    const { numero, fecha, cliente, plan, plazo, lineas } = snapshot;

    nodos.pagoDetalle.innerHTML = `
        <div class="pago-cabecera">
            <div>
                <p class="pago-etiqueta">Cotización</p>
                <p class="pago-numero">${numero}</p>
            </div>
            <div>
                <p class="pago-etiqueta">Emitida</p>
                <p class="pago-fecha">${formatearFecha(fecha)}</p>
            </div>
        </div>

        <ul class="comprobante-items">${listaLineas(lineas)}</ul>

        <dl class="revision-datos">
            <dt>Plan</dt><dd>${plan.nombre}</dd>
            <dt>Plazo</dt><dd>${plazo.nombre} · ${plazo.semanas} semanas</dd>
            <dt>A nombre de</dt><dd>${escapar(cliente.empresa || cliente.nombre)}</dd>
        </dl>`;

    const ajuste = totalesConAjuste.ajustePago;
    const claseAjuste = ajuste >= 0 ? "pago-ajuste-positivo" : "pago-ajuste-negativo";

    const opciones = mediosPago
        .map((medio) => {
            const etiquetaAjuste = medio.ajuste === 0
                ? ""
                : ` · ${medio.ajuste > 0 ? "+" : "−"}${formatearPorcentaje(medio.ajuste)}`;

            return `
            <label class="opcion-item">
                <input type="radio" name="medio-pago" value="${medio.id}"
                       ${medio.id === medioPagoId ? "checked" : ""}>
                <span class="opcion-texto">
                    <strong>${medio.nombre}${etiquetaAjuste}</strong>
                    <small>${medio.descripcion}</small>
                </span>
            </label>`;
        })
        .join("");

    nodos.pagoMedios.innerHTML = `
        <fieldset class="opcion-grupo">
            <legend>Elegí cómo pagar</legend>
            ${opciones}
        </fieldset>

        <div class="presupuesto-resumen pago-total">
            ${filaResumen("Subtotal", formatearMoneda(snapshot.totales.neto))}
            ${ajuste !== 0
                ? filaResumen("Ajuste por medio de pago",
                    `${ajuste > 0 ? "+" : "−"} ${formatearMoneda(Math.abs(ajuste))}`, claseAjuste)
                : ""}
            ${filaResumen(`IVA (${formatearPorcentaje(totalesConAjuste.tasaIva)})`, formatearMoneda(totalesConAjuste.iva))}
            <div class="resumen-separador"></div>
            <div class="resumen-total">
                <span>Total a pagar</span>
                <span>${formatearMoneda(totalesConAjuste.totalAPagar)}</span>
            </div>
        </div>`;
}

// ------------------------------------------------------------
//  Paso 6: contratado
// ------------------------------------------------------------

export function renderExito(snapshot) {
    const { numero, cliente, medioPago, totalPagado, fechaContratacion, plazo } = snapshot;

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
            <dt>Entrega estimada</dt><dd>${plazo.semanas} semanas</dd>
        </dl>

        <button type="button" class="btn-borde" data-accion="comprobante" data-numero="${numero}">
            Ver comprobante
        </button>`;
}

// ------------------------------------------------------------
//  Comprobante
// ------------------------------------------------------------

function comprobanteHtml(snapshot) {
    const { numero, fecha, cliente, lineas, plan, plazo, medioPago, totales, totalPagado, estado } = snapshot;
    const montoFinal = totalPagado === null ? totales.totalAPagar : totalPagado;

    return `
        <div class="comprobante">
            <dl>
                <dt>Cotización</dt><dd>${numero}</dd>
                <dt>Fecha</dt><dd>${formatearFecha(fecha)}</dd>
                <dt>Estado</dt><dd>${ETIQUETAS_ESTADO[estado]}</dd>
                <dt>Cliente</dt><dd>${escapar(cliente.nombre)}</dd>
                <dt>Empresa</dt><dd>${escapar(cliente.empresa || "Particular")}</dd>
                <dt>Plan</dt><dd>${plan.nombre}</dd>
                <dt>Plazo</dt><dd>${plazo.nombre} · ${plazo.semanas} semanas</dd>
                ${medioPago ? `<dt>Medio de pago</dt><dd>${medioPago.nombre}</dd>` : ""}
            </dl>
            <ul class="comprobante-items">${listaLineas(lineas)}</ul>
            <div class="comprobante-total">
                <span>Total</span>
                <span>${formatearMoneda(montoFinal)}</span>
            </div>
        </div>`;
}

export function mostrarComprobante(snapshot) {
    if (typeof Swal === "undefined") {
        modalPropio(`Comprobante ${snapshot.numero}`, comprobanteHtml(snapshot), "Cerrar", false);
        return;
    }

    Swal.fire({
        title: `Comprobante ${snapshot.numero}`,
        html: comprobanteHtml(snapshot),
        background: "#111",
        color: "#ffffff",
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#b4e61a",
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
            const { numero, fecha, estado, cliente, lineas, totales, totalPagado } = cotizacion;
            const esActiva = numero === cotizacionActivaId;
            const monto = totalPagado === null ? totales.totalAPagar : totalPagado;

            return `
            <article class="historial-tarjeta${esActiva ? " historial-tarjeta-activa" : ""}">
                <div class="historial-encabezado-tarjeta">
                    <p class="historial-numero">${numero}</p>
                    <span class="estado-pastilla" data-estado="${estado}">${ETIQUETAS_ESTADO[estado]}</span>
                </div>
                <p class="historial-fecha">${formatearFecha(fecha)}</p>
                <p class="historial-cliente">${escapar(cliente.nombre)} · ${escapar(cliente.empresa || "Particular")}</p>
                <ul class="historial-items">
                    ${lineas.map(({ nombre, cantidad }) => `<li>${cantidad} × ${nombre}</li>`).join("")}
                </ul>
                <div class="historial-total">
                    <span>${estado === "contratada" ? "Abonado" : "Total"}</span>
                    <span>${formatearMoneda(monto)}</span>
                </div>
                <div class="historial-acciones">
                    <button type="button" class="btn-ver-comprobante" data-accion="comprobante" data-numero="${numero}">
                        Ver comprobante
                    </button>
                    ${estado === "pendiente-pago" ? `
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
