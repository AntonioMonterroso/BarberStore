# Imperio Store Barber — Pendientes

Estado: ✅ hecho · 🔧 en curso · ⬜ pendiente. Orden = prioridad.

## 1. Seguridad (Supabase)
- 🔧 Cerrar RLS: el público ya no lee/modifica `clientes`, `citas`, `visitas`, `waitlist`, `resenas`, `ventas_producto` → `supabase/seguridad.sql`
- 🔧 Operaciones públicas solo vía RPC (`reservar`, `mis_datos`, `cancelar_citas`, `anotar_espera`, `enviar_resena`, `horarios_ocupados`, `resenas_publicas`)
- 🔧 Panel solo para correos en tabla `admins` (antes: cualquier usuario autenticado)
- 🔧 Precio de productos fijado en servidor; validación de horario, bloqueos y duración en servidor
- 🔧 "Mis citas": teléfono + token del dispositivo
- ⬜ **Tú:** ejecutar `supabase/schema.sql` y luego `supabase/seguridad.sql` en el SQL Editor, y desactivar *Allow new users to sign up* (Authentication → Providers → Email)
- ⬜ Anti-bots en reservas/reseñas/lista de espera (Cloudflare Turnstile) y límite de frecuencia
- ⬜ Verificación por código de WhatsApp para recuperar "Mis citas" en otro dispositivo
- ⬜ Zona horaria configurable (hoy fija en `America/Guatemala` dentro de las funciones SQL)
- ⬜ Fijar versión de supabase-js y añadir SRI; alojar fuentes en local (evita enviar la IP del visitante a Google)

## 2. Legal (plantillas; **las debe revisar un abogado guatemalteco**)
- ⬜ Política de privacidad (qué datos, para qué, cuánto tiempo, derechos, contacto)
- ⬜ Política de cookies / almacenamiento local (hoy: `localStorage` con nombre, teléfono y token; fuentes de Google; Supabase)
- ⬜ Términos y condiciones del servicio de reservas (cancelación, no-show, anticipos, precios en GTQ)
- ⬜ Casilla de aceptación al agendar (privacidad) y casilla **aparte** para mensajes promocionales por WhatsApp
- ⬜ Borrado/exportación de datos a petición del cliente (RPC + botón en "Mis citas")
- ⬜ Retención de datos (p. ej. anonimizar clientes inactivos tras N años)
- ⬜ Facturación electrónica SAT (FEL) si cobra anticipos o productos en línea
- ⬜ Para vender como suscripción: contrato de servicio (SaaS), acuerdo de tratamiento de datos con cada barbería, política de reembolso y acuerdo de nivel de servicio
- ⬜ Datos de quien opera el negocio (razón social, NIT, dirección) en el pie de página

## 3. Producto / diseño (comparado con HeyGoldie)
- ⬜ Acordeón de servicios por categoría con foto y "Mostrar más"
- ⬜ Complementos adicionales (add-ons) por servicio
- ⬜ Selector de cantidad por servicio (− / +) con total en la tarjeta resumen fija
- ⬜ Calendario con indicador de disponibilidad por día (verde = hay cupo, rojo = lleno)
- ⬜ Horarios agrupados Mañana / Tarde en formato 12 h y con la zona horaria visible
- ⬜ "Precio a consultar" cuando un servicio tiene precio 0 (en HeyGoldie salen como Q0 y confunden)
- ⬜ Mostrar el barbero que atiende en el resumen (HeyGoldie lo muestra: "con Samid Zerep")
- ⬜ Multi-idioma (ES hoy; EN después)
- ⬜ Cuentas de cliente (tras la verificación por WhatsApp)
- ⬜ Varios barberos / sedes
- ⬜ Accesibilidad y contraste, SEO (`og:image`, `LocalBusiness`, sitemap), PWA

## 4. Negocio
- ⬜ Anticipos con cobro real (enlace de pago o transferencia con confirmación)
- ⬜ Recordatorios automáticos 24 h y 2 h antes (WhatsApp API o Edge Function + cron)
- ⬜ Lista de espera: aviso automático al cancelarse una cita
- ⬜ Política anti no-show
- ⬜ Reportes y exportar CSV
- ⬜ Modelo de suscripción y precio (ver propuesta en el chat)

## 5. Técnico
- ⬜ Separar `index.html` (300 KB) en CSS/JS/imágenes; logo fuera del base64
- ⬜ Manejo de errores de red y reintentos
- ⬜ Pruebas automáticas de las funciones SQL y del flujo de reserva
