# Fennec — Cotizador de proyectos de software

> ## ⚠️ Antes de abrirlo: necesita un servidor local
>
> **Si hacés doble clic en `index.html`, el simulador no arranca.** No está roto.
>
> El cotizador carga su base de datos desde archivos `.json` usando `fetch()`, y
> todos los navegadores bloquean esas peticiones cuando la página se abre con el
> protocolo `file://`. Es una restricción de seguridad del navegador, no un error
> del proyecto.
>
> **La forma más rápida:** en VS Code, clic derecho sobre `index.html` →
> **Open with Live Server**.
>
> **Desde la terminal, parado en la carpeta del proyecto:**
> ```bash
> python -m http.server 5500
> ```
> y después entrar a `http://localhost:5500`.
>
> Si lo abrís con doble clic igual vas a ver un cartel en la página explicando
> esto mismo: está puesto a propósito para que no quede una pantalla en blanco.
> En la sección [El camino](#el-camino-lo-que-se-me-rompió-y-cómo-lo-arreglé)
> cuento por qué lo resolví así.

Proyecto final del curso de JavaScript. Es un simulador del circuito comercial
completo de un estudio de desarrollo: el visitante arma su presupuesto eligiendo
servicios, carga sus datos, elige cómo pagar, confirma y queda contratado el
servicio.

**Autor:** Valentino Verdichio

Lo armé sobre **Fennec**, el sitio institucional que había hecho en la entrega
anterior del curso de HTML y SASS. Esa entrega tenía cinco páginas estáticas y
cero JavaScript propio. Acá le agregué el simulador y le di una razón de ser a
todo lo que ya estaba escrito ahí.

---

## Cómo ejecutarlo

Como decía arriba, hay que servirlo por HTTP. Cualquiera de las dos opciones
funciona igual de bien:

**Opción 1 — Live Server (VS Code)**

1. Instalar la extensión *Live Server*.
2. Clic derecho sobre `index.html` → **Open with Live Server**.

**Opción 2 — Python, desde la terminal**

```bash
cd "Entrega - Web interactive"
python -m http.server 5500
```

Y después abrir `http://localhost:5500`.

No hace falta instalar nada más: no hay `npm install`, ni build, ni
dependencias. Las dos librerías externas entran por CDN, así que **hace falta
internet**: sin conexión no cargan los modales ni las notificaciones.

---

## Qué hace el simulador

El circuito va de punta a punta, en tres pasos:

| Paso | Qué pasa |
|---|---|
| **1. Servicios** | Catálogo de 8 servicios con filtro por categoría y buscador. Se agregan al presupuesto y se ajustan las cantidades |
| **2. Confirmar** | Nombre y correo obligatorios (empresa y comentarios opcionales), resumen completo de la cotización y medio de pago, que mueve el total en vivo. Un solo botón: **Confirmar y pagar** |
| **3. Listo** | Pantalla de servicio contratado, con el comprobante |

Abajo del asistente queda el historial de cotizaciones, con dos estados
posibles: **contratada** y **anulada**.

Los precios se calculan así, y el orden importa:

```
1  base        = Σ (precio unitario × cantidad)
2  descuento   = base × porcentaje por volumen       ← sobre la base
3  neto        = base − descuento
4  ajustePago  = neto × ajuste del medio de pago     ← antes del IVA
5  netoFinal   = neto + ajustePago
6  IVA         = netoFinal × 21%
7  total       = netoFinal + IVA
```

El plazo estimado no se elige: sale de las horas que suman los servicios, a 40
horas por semana (`Math.ceil(horas / 40)`).

---

## Cómo está organizado

```
index.html                 ← el asistente completo; único archivo suelto en la raíz
readme.md
assets/
  css/main.css             ← estilos del sitio + bloque propio del cotizador
  img/                     ← logo e isotipo
data/
  servicios.json           ← los 8 servicios
  configuracion.json       ← pasos, tramos de descuento, medios de pago, IVA, moneda
js/
  datos.js                 ← fetch, localStorage y los cálculos. No toca el DOM
  interfaz.js              ← todo lo que se dibuja. No guarda estado ni calcula
  app.js                   ← el estado, la navegación entre pasos y los eventos
pages/
  nosotros.html  servicios.html  faq.html  contacto.html
```

Los tres archivos JS son módulos ES. Las dependencias van en una sola dirección:
`app.js` importa de los otros dos, e `interfaz.js` solo importa constantes de
`datos.js`. Así no puede haber dependencias circulares por más que el proyecto
crezca.

En el `<head>` están los dos `<link rel="modulepreload">` además del
`<script type="module">`. Sirven para que el navegador empiece a bajar los tres
módulos en paralelo en vez de descubrirlos de a uno.

---

## El camino: lo que se me rompió y cómo lo arreglé

Esta es la parte que más me sirvió del proyecto. Dejo los problemas en el orden
en que me los fui encontrando.

### 1. La primera vez que lo abrí, la página estaba muerta

Hice doble clic en `index.html` y no pasó nada. Ni un error visible, nada.

El problema es que `fetch()` no funciona sobre el protocolo `file://`: el
navegador considera que una página abierta desde el disco no tiene un origen
válido y bloquea el pedido. Y como mi `app.js` es un módulo ES, el navegador
tampoco lo ejecuta en ese contexto, así que **ni siquiera llegaba al `catch`**
para mostrar un error.

Eso último fue lo que me hizo cambiar el enfoque. Si el JS no corre, no puedo
mostrar el aviso *desde* el JS. Entonces lo di vuelta: el cartel que explica el
problema está **visible por defecto en el HTML**, y `app.js` lo esconde apenas
arranca. Así, la única forma de que el cartel desaparezca es que el JS haya
corrido de verdad. Si algo falla antes, el aviso queda a la vista y explica qué
hacer.

### 2. `fetch()` no falla cuando el archivo no existe

Renombré `servicios.json` a propósito para probar el manejo de errores, y en vez
del mensaje que yo esperaba me saltó un error raro de parseo.

Resulta que `fetch()` solo rechaza la promesa cuando el pedido **no sale**: sin
red, sin servidor. Un 404 llega como una respuesta perfectamente "exitosa", con
la propiedad `ok` en `false`. Si no lo mirás, seguís de largo e intentás parsear
como JSON una página de error.

```js
const respuesta = await fetch(ruta);

if (!respuesta.ok) {
    throw new Error(`No se encontró el archivo ${ruta} (error ${respuesta.status}).`);
}
```

Con eso pude separar los dos casos y mostrar mensajes distintos: si el error es
un `TypeError`, el pedido ni salió (falta el servidor); si no, el archivo no
está donde debería.

### 3. Estuve un rato depurando un CSS que el navegador nunca cargó

Agregué un montón de estilos nuevos, recargué, y la página seguía igual.
Revisé el archivo tres veces y estaba todo bien escrito.

Lo encontré mirando el log del servidor. En la carga de la página aparecían
`index.html`, `app.js`, `datos.js`, `interfaz.js`… y **`main.css` no aparecía**.
Ni siquiera con un 304. El navegador lo tenía en caché de antes y directamente
no lo volvía a pedir.

Lo resolví de raíz: en vez de un `python -m http.server` pelado, armé un
servidor chiquito que agrega `Cache-Control: no-store` a cada respuesta. Son
quince líneas y me ahorró el problema para todo el resto del proyecto.

### 4. Los pasos se dibujaban uno encima del otro

Cuando convertí el cotizador en un asistente por pasos, puse el atributo
`hidden` en los paneles que no tocaban. No funcionó: se veían todos juntos.

El motivo es de especificidad. `hidden` es equivalente a `display: none`, pero
yo ya tenía reglas como `.cotizador-layout { display: grid }`, y una clase le
gana al atributo. La solución fue explícita:

```css
.paso-panel[hidden] {
    display: none !important;
}
```

Me volvió a pasar lo mismo más tarde con otro bloque que tenía
`display: inline-flex`. Ahí ya sabía qué estaba pasando y le puse su propia
regla.

### 5. Los botones dejaban de responder después de filtrar

Al principio le ponía un `addEventListener` a cada botón del catálogo. Andaba
bien hasta que tocaba un filtro: a partir de ahí los botones no hacían nada.

Claro: cuando filtro, vuelvo a dibujar el catálogo entero con `innerHTML`. Los
botones viejos (los que tenían el listener) dejan de existir, y los nuevos
nacen sin nada enganchado.

Lo arreglé con **delegación de eventos**: el listener va una sola vez sobre el
contenedor, que nunca se reemplaza, y adentro pregunto qué botón se tocó.

```js
function manejarClic(evento) {
    const accionable = evento.target.closest("[data-accion]");
    if (accionable) {
        ACCIONES[accionable.dataset.accion]?.(accionable.dataset);
    }
}
```

De paso quedó más prolijo: un solo listener para todo el simulador, y cada botón
declara qué hace con un `data-accion`.

### 6. El comprobante no cerraba

Cuando sumé los medios de pago, al principio aplicaba el recargo o el descuento
**después** del IVA. Los números daban, pero el comprobante era mentira: el IVA
tiene que ser el 21% del neto, siempre. Si el recargo financiero se suma después,
el total ya no se corresponde con la suma de neto + 21%.

Moví el ajuste antes del IVA. Como efecto secundario, ahora al cambiar el medio
de pago también se mueve el IVA en pantalla, que es lo correcto.

### 7. La suma de las líneas no daba el total

Me aparecía una diferencia de un peso entre lo que sumaban los ítems en pantalla
y el total que mostraba abajo.

Estaba redondeando dos veces: una vez en cada paso del cálculo y otra vez en la
función que da formato a los precios (`Math.round` más `maximumFractionDigits`).
Dejé el redondeo en un solo lugar —cada paso del cálculo, con un helper
`redondear()`— y la función de formato pasó a solo formatear.

### 8. Dos cotizaciones con el mismo número

Tenía un contador guardado aparte en el `localStorage`. Dos problemas: si
borraba una cotización del historial, el siguiente número se repetía; y con dos
pestañas abiertas las dos leían el mismo contador al arrancar.

Lo saqué. Ahora el número sale de mirar el más alto que ya existe en el
historial, en el momento exacto de confirmar:

```js
export function siguienteNumero(historial) {
    const ultimaSecuencia = historial.reduce((maxima, { numero }) => {
        const secuencia = Number.parseInt(String(numero).split("-").at(-1), 10);
        return Number.isInteger(secuencia) && secuencia > maxima ? secuencia : maxima;
    }, 0);

    const anio = new Date().getFullYear();
    return `FEN-${anio}-${String(ultimaSecuencia + 1).padStart(4, "0")}`;
}
```

### 9. Recargar la página rompía el paso final

Guardaba en qué paso estaba el usuario, pero no **qué cotización estaba
mirando**. Al recargar parado en la pantalla de "Listo", intentaba mostrar el
detalle de una cotización que no sabía cuál era.

El error de fondo era conceptual: tenía mezcladas dos cosas distintas en un solo
dato. Las separé:

- `paso` → en qué pantalla está el usuario. Es navegación.
- `fase` → en qué estado está la cotización (`borrador` o `pagada`).
- `cotizacionActivaId` → cuál es la cotización en curso.

Y puse una regla que me ordenó el resto: **la pantalla final nunca calcula nada,
solo lee la cotización guardada**. Si recalculara desde el presupuesto en curso,
bastaba con volver al paso 1 y quitar un servicio para que el número de
cotización y el total dejaran de corresponderse.

### 10. Un doble clic generaba dos cotizaciones

Entre que apretás "Confirmar y pagar" y que respondés el modal de confirmación
pasan varios segundos. En ese tiempo se puede volver a apretar el botón, y se
emitían dos cotizaciones con dos números distintos.

Le puse una bandera en el estado y un `try/finally` para que se limpie siempre,
salga bien o salga mal:

```js
if (estado.enviando) {
    return;
}
estado.enviando = true;
try {
    // …
} finally {
    estado.enviando = false;
}
```

### 11. Si alguien edita el JSON, no se rompe

Esto no fue un error que tuve sino uno que me quise anticipar. El presupuesto se
guarda en el `localStorage` como `{ id, cantidad }`, sin el precio. Si yo borro
un servicio del JSON o le cambio el tope de cantidad, lo guardado queda apuntando
a algo que ya no existe.

Por eso hay una función `sanearBorrador()` que corre una sola vez al arrancar y
acomoda lo guardado contra los JSON recién cargados: descarta los ids que no
existen más, recorta las cantidades que quedaron fuera de rango, limita el largo
de los campos del cliente y, si el paso o la fase guardados no son válidos,
vuelve al principio. Si descarta algo, avisa.

Lo opuesto pasa con el historial: ahí **sí** guardo los precios y el medio de
pago aplicado. Una cotización ya emitida no puede cambiar de precio porque
después toqué la lista.

### 12. Lo simplifiqué: de seis pasos a tres

Cuando lo terminé tenía casi 2100 líneas de JavaScript. Funcionaba y cumplía
todo, pero me di cuenta de que se podía simplificar la cotización. 

Lo primero que pensé fue sacar el paso de "plan y plazo", pero antes de ponerme
lo medí, y el resultado me sorprendió: eso solo achicaba el JS un 5%. El motivo
es que lo que *parecía* maquinaria de seis pasos ya estaba escrito para N pasos
—`irAPaso` y la barra no cambiaban ni una línea— así que borrar pasos no borraba
código.

Lo que sí movió la aguja fue **fusionar confirmar y pagar en una sola acción**.
Antes la cotización pasaba por tres fases (`borrador` → `confirmada` → `pagada`)
y había un estado intermedio "pendiente de pago" que arrastraba todo un flujo:
el cartel de cotización congelada, el botón de "editar cotización", y la regla de
que los últimos pasos nunca podían recalcular. Con una sola acción ese hueco
desaparece y se va todo ese código con él.

Terminó en 1816 líneas. Menos de lo que había estimado al planificarlo —calculé
1645 y no llegué— pero un 13% más corto y, sobre todo, con dos conceptos menos
que explicar.

Lo que perdí, para ser honesto: el proyecto se parece más a un carrito con
checkout que a un cotizador. Antes el usuario tomaba tres tipos de decisión
(qué compra, cómo lo quiere, cómo paga) y ahora toma dos.

### 13. Un botón deshabilitado que se veía igual que uno activo

Con una cotización ya contratada, volvía al paso 1, agregaba un servicio,
apretaba "Vaciar presupuesto" y no pasaba nada.

Reproduje el caso y el bloqueo estaba bien: con la cotización pagada, el botón
llega con `disabled` y la función corta en su primera línea. El defecto era de
CSS: `.btn-lima:disabled` no tenía **ninguna** regla, así que un botón apagado se
veía idéntico a uno activo. Hacés clic, no pasa nada, y no hay forma de darte
cuenta de por qué.

Le puse opacidad y `cursor: not-allowed`, y además bloqueé la navegación hacia
atrás: con la cotización pagada, la barra de pasos ya no deja volver al paso 1.

También me dejó una lección sobre las pruebas: mi test de interacción llamaba a
los manejadores directamente, ignorando el atributo `disabled` que el navegador
sí respeta. Podía hacer cosas que un usuario no puede, y por eso seguía en verde
sobre un botón que en pantalla no hacía nada.



## Checklist de la consigna

| Requisito | Dónde está |
|---|---|
| Interacción solo por interfaz, sin `alert`, `confirm` ni `prompt` | SweetAlert2 y Toastify, más validación en línea. Cero diálogos nativos en todo el proyecto |
| Manipulación dinámica del DOM | Catálogo, presupuesto, resúmenes, confirmación, pago, comprobante e historial se dibujan desde JS |
| Arrays de objetos en `.json` consumidos con `fetch` | `data/servicios.json` y `data/configuracion.json`. No hay ningún array de objetos hardcodeado en el JS |
| Al menos 2 funciones de orden superior | Uso 6: `map`, `filter`, `reduce`, `find`, `some` y `forEach`. Además `grupoOpciones()` recibe una función y la invoca adentro de la plantilla |
| `localStorage` con guardar, modificar, borrar y vaciar | `setItem` al guardar · `Object.assign` + reescritura al anular · `removeItem` y `filter` al borrar · `clear()` en "Reiniciar simulador" |
| Operador ternario, operador OR y destructuring | Los tres en los tres archivos |
| `fetch` con `async/await`, `try/catch` y `finally` | `datos.cargarDatos()` y `app.iniciar()`. El `finally` apaga el cartel de "cargando" salga bien o mal |
| Manejo de errores de carga | Panel de error con el motivo y botón para reintentar sin recargar la página |
| Librería externa | SweetAlert2 (confirmaciones y comprobante) y Toastify (avisos) |
| Circuito completo, sin registro ni login | Servicios → datos, medio de pago y confirmación → contratado → historial |
| `index.html` como único archivo suelto | Junto con este readme, lo único en la raíz |
| Entre 2 y 3 archivos `.js` | Exactamente 3 |
| Carpeta `assets/` con recursos multimedia | Logo e isotipo, optimizados de 3,9 MB a 85 KB |

---

## Tecnologías

- **HTML5** semántico, con atributos ARIA en los puntos donde el contenido cambia solo
- **CSS propio**, sin frameworks. Parte del SASS compilado de la entrega anterior, más un bloque nuevo escrito a mano para el cotizador
- **JavaScript** sin frameworks ni build: módulos ES nativos
- **[SweetAlert2](https://sweetalert2.github.io/)** 11.14.5 — confirmaciones y comprobantes
- **[Toastify](https://apvarun.github.io/toastify-js/)** 1.12.0 — avisos breves
- Tipografías **Archivo Black** y **Pliant** (Google Fonts)
