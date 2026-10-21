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
servicios, define el plan de soporte y el plazo de entrega, carga sus datos,
confirma la cotización, la paga y queda contratado el servicio.

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
dependencias. Las dos librerías externas entran por CDN, así que para que se
vean los modales y las notificaciones conviene tener internet (si no hay,
el simulador igual funciona: armé un modal propio de respaldo).

---

## Qué hace el simulador

El circuito va de punta a punta, en seis pasos:

| Paso | Qué pasa |
|---|---|
| **1. Servicios** | Catálogo de 8 servicios con filtro por categoría y buscador. Se agregan al presupuesto y se ajustan las cantidades |
| **2. Plan y plazo** | Plan de soporte (sin soporte / básico / premium) y plazo de entrega (estándar / acelerado / express). El total se recalcula en vivo |
| **3. Tus datos** | Nombre y correo obligatorios, empresa y comentarios opcionales. La validación es propia, no la del navegador |
| **4. Revisión** | Resumen completo de solo lectura y botón para confirmar |
| **5. Pago** | Se emite el número de cotización, se elige el medio de pago (ajusta el total) y se confirma |
| **6. Listo** | Pantalla de servicio contratado, con el comprobante |

Abajo del asistente queda el historial de cotizaciones, con tres estados
posibles: **pendiente de pago**, **contratada** y **anulada**.

Los precios se calculan así, y el orden importa:

```
 1  base        = Σ (precio unitario × cantidad)
 2  descuento   = base × porcentaje por volumen       ← sobre la base
 3  baseNeta    = base − descuento
 4  soporte     = baseNeta × (multiplicador del plan − 1)
 5  recargo     = baseNeta × recargo del plazo
 6  neto        = baseNeta + soporte + recargo
 7  ajustePago  = neto × ajuste del medio de pago     ← antes del IVA
 8  netoFinal   = neto + ajustePago
 9  IVA         = netoFinal × 21%
10  total       = netoFinal + IVA
```

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
  configuracion.json       ← planes, plazos, tramos de descuento, medios de pago, IVA
js/
  datos.js                 ← fetch, localStorage y los cálculos. No toca el DOM
  interfaz.js              ← todo lo que se dibuja. No guarda estado ni calcula
  app.js                   ← el estado, la navegación entre pasos y los eventos
pages/
  nosotros.html  servicios.html  faq.html  contacto.html
```

Los tres archivos JS son módulos ES. Las dependencias van en una sola dirección:
`app.js` importa de los otros dos, y `datos.js` e `interfaz.js` no importan
nada. Así no puede haber dependencias circulares por más que el proyecto crezca.

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

### 4. Los seis pasos se dibujaban uno encima del otro

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

Me volvió a pasar lo mismo más tarde, cuando convertí el aviso de "cotización
confirmada" en una píldora con `display: inline-flex`. Ahí ya sabía qué estaba
pasando y le puse su propia regla.

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

### 6. "3 mess" y "2 automatizacións"

Para el plural de las unidades estaba haciendo lo obvio: agregarle una "s".
Funcionaba para "proyecto" y "tienda", pero me daba "mess", "automatizacións" y
"set de pantallass".

No hay regla que derive eso bien, así que dejó de ser lógica y pasó a ser dato.
Agregué `unidadPlural` a cada servicio en el JSON y el código solo elige:

```js
${cantidad === 1 ? unidad : unidadPlural}
```

Me quedó como criterio general: cuando una excepción no se puede calcular, va en
los datos, no en el código.

### 7. Pedir la entrega Express te abarataba el proyecto

Este lo encontré haciendo números a mano para verificar los totales. El
descuento por volumen lo estaba calculando sobre el subtotal, que ya incluía el
recargo por plazo. Entonces pasaba esto:

- Base de $2.000.000 con entrega estándar → $2.000.000 → tramo del **5%**
- La misma base con Express (+30%) → $2.600.000 → cruza los $2.500.000 → **10%**

O sea, apurar la entrega te daba más descuento por volumen. No tiene sentido
comercial: el descuento por volumen es por el tamaño del proyecto, no por cómo
lo entregás. Moví el cálculo del tramo para que se resuelva sobre la base, antes
de aplicar plan y plazo. Tengo un test que fija este caso para no volver a
romperlo.

### 8. El comprobante no cerraba

Cuando sumé los medios de pago, al principio aplicaba el recargo o el descuento
**después** del IVA. Los números daban, pero el comprobante era mentira: el IVA
tiene que ser el 21% del neto, siempre. Si el recargo financiero se suma después,
el total ya no se corresponde con la suma de neto + 21%.

Moví el ajuste antes del IVA. Como efecto secundario, ahora al cambiar el medio
de pago también se mueve el IVA en pantalla, que es lo correcto.

### 9. La suma de las líneas no daba el total

Me aparecía una diferencia de un peso entre lo que sumaban los ítems en pantalla
y el total que mostraba abajo.

Estaba redondeando dos veces: una vez en cada paso del cálculo y otra vez en la
función que da formato a los precios (`Math.round` más `maximumFractionDigits`).
Dejé el redondeo en un solo lugar —cada paso del cálculo, con un helper
`redondear()`— y la función de formato pasó a solo formatear.

### 10. Dos cotizaciones con el mismo número

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

### 11. Recargar en el paso de pago rompía todo

Guardaba en qué paso estaba el usuario, pero no **qué cotización estaba
pagando**. Al recargar la página parado en el paso 5, la pantalla intentaba
mostrar el detalle de una cotización que no sabía cuál era.

El error de fondo era conceptual: tenía mezcladas dos cosas distintas en un solo
dato. Las separé:

- `paso` → en qué pantalla está el usuario. Es navegación.
- `fase` → en qué estado está la cotización (`borrador`, `confirmada`, `pagada`).
- `cotizacionActivaId` → cuál es la cotización en curso.

Y puse una regla que me ordenó el resto: **los pasos 5 y 6 nunca calculan nada,
solo leen la cotización guardada**. Si recalcularan desde el presupuesto en
curso, bastaba con volver al paso 1 y quitar un servicio para que el número de
cotización y el total dejaran de corresponderse.

### 12. Un doble clic generaba dos cotizaciones

Entre que apretás "Confirmar" y que respondés el modal de confirmación pasan
varios segundos. En ese tiempo se puede volver a apretar el botón, y se emitían
dos cotizaciones con dos números distintos.

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

### 13. Si alguien edita el JSON, no se rompe

Esto no fue un error que tuve sino uno que me quise anticipar. El presupuesto se
guarda en el `localStorage` como `{ id, cantidad }`, sin el precio. Si yo borro
un servicio del JSON o le cambio el tope de cantidad, lo guardado queda apuntando
a algo que ya no existe.

Por eso hay una función `sanearBorrador()` que corre una sola vez al arrancar y
acomoda lo guardado contra los JSON recién cargados: descarta los ids que no
existen más, recorta las cantidades que quedaron fuera de rango, y si el plan o
el plazo guardado ya no está, cae al primero de la lista. Si descarta algo, avisa.

Lo opuesto pasa con el historial: ahí **sí** guardo los precios, el nombre del
plan y el multiplicador aplicado. Una cotización ya emitida no puede cambiar de
precio porque después toqué la lista.

---

## Cómo probé los cálculos

Las funciones de cálculo de `datos.js` son puras —entra un objeto, sale un
objeto, no tocan el DOM ni el estado global— así que las pude probar por
separado, con los valores resueltos a mano en papel y comparados contra lo que
devuelve el código.

Son 62 comprobaciones que cubren el presupuesto vacío, un ítem simple, varios
ítems con descuento y entrega express, cada medio de pago, los bordes exactos de
los tramos de descuento, y el saneamiento de un `localStorage` corrupto.

Los dos casos que más me sirvieron fueron el de "Express ya no infla el
descuento" (problema 7) y el de "el IVA es siempre el 21% del neto final"
(problema 8), porque fijan decisiones que de otra forma se rompen sin que te des
cuenta.

---

## Checklist de la consigna

| Requisito | Dónde está |
|---|---|
| Interacción solo por interfaz, sin `alert`, `confirm` ni `prompt` | SweetAlert2 y Toastify, más validación en línea. Cero diálogos nativos en todo el proyecto |
| Manipulación dinámica del DOM | Catálogo, presupuesto, resúmenes, revisión, pago, comprobante e historial se dibujan desde JS |
| Arrays de objetos en `.json` consumidos con `fetch` | `data/servicios.json` y `data/configuracion.json`. No hay ningún array de objetos hardcodeado en el JS |
| Al menos 2 funciones de orden superior | Uso 6: `map`, `filter`, `reduce`, `find`, `some` y `forEach` |
| `localStorage` con guardar, modificar, borrar y vaciar | `setItem` al guardar · `Object.assign` + reescritura al anular o contratar · `removeItem` y `filter` al borrar · `clear()` en "Reiniciar simulador" |
| Operador ternario, operador OR y destructuring | Los tres en los tres archivos |
| `fetch` con `async/await`, `try/catch` y `finally` | `datos.cargarDatos()` y `app.iniciar()`. El `finally` apaga el cartel de "cargando" salga bien o mal |
| Manejo de errores de carga | Panel de error con el motivo y botón para reintentar sin recargar la página |
| Librería externa | SweetAlert2 (confirmaciones y comprobante) y Toastify (avisos). Las dos con un modal propio de respaldo si no cargan |
| Circuito completo, sin registro ni login | Servicios → plan y plazo → datos → revisión → confirmación → pago → contratado → historial |
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
