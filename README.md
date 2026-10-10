# Imperio Store Barber

Sistema de citas para barbería: página pública, reserva en línea con ticket, "Mis citas" y panel del negocio. Es un solo `index.html` con Supabase como base de datos.

## Probarlo sin riesgo (demo)

`demo.html` es la misma aplicación con una base de datos de ejemplo que vive solo en tu navegador. No toca Supabase ni tu sitio real.

- Abre `demo.html` (doble clic, o desde la carpeta descargada del repositorio).
- **Cliente:** reserva una cita, mira el ticket, abre "Mis citas". En la cinta naranja de abajo hay un botón para entrar como cliente demo.
- **Panel del negocio:** botón "Ir al panel" de la cinta. Entra con cualquier correo y contraseña.
- **Registro de llegada con QR:** abre `demo.html?qr=1`.
- "Reiniciar los datos de ejemplo" borra todo lo que hayas hecho en la demo.

Si cambias `index.html`, regenera la demo con `python3 demo/build.py`.

## Publicar la versión real (en este orden)

1. En Supabase → SQL Editor, ejecuta `supabase/schema.sql` y luego `supabase/seguridad.sql`.
2. Authentication → Providers → Email: desactiva *Allow new users to sign up*.
3. Sube a tu hosting **todo** el contenido: `index.html`, `vendor/`, `legal.css`, `privacidad.html`, `cookies.html`, `terminos.html`.

Importante: el SQL nuevo y el `index.html` nuevo van juntos. Con el SQL nuevo, el `index.html` viejo deja de funcionar, y al revés.

## Archivos

- `index.html` — la aplicación.
- `supabase/` — base de datos y seguridad.
- `vendor/qrcode.js` — generador de QR (MIT), para que no salga ningún dato a terceros.
- `privacidad.html`, `cookies.html`, `terminos.html`, `legal.css` — textos legales (borradores: completar los campos `[...]` y revisar con un abogado).
- `demo.html`, `demo/` — versión de demostración.
- `PENDIENTES.md` — lo que falta.
