# Manual de Configuración — Facturación Electrónica SFE Bolivia
## Urban Fitness Club

---

## ¿Qué es el SFE?

El Sistema de Facturación Electrónica (SFE) de Impuestos Nacionales Bolivia permite emitir
facturas electrónicas legalmente válidas. Este módulo implementa la **Modalidad Computarizada
en Línea** (Modalidad 2), con soporte para modo offline temporal.

---

## PASO 1 — Obtener NIT y registrarse en Impuestos Nacionales

1. Acude al Servicio de Impuestos Nacionales (SIN) más cercano
2. Registra o verifica tu NIT (Número de Identificación Tributaria)
3. El NIT debe estar activo y asociado a la actividad económica de gimnasio/fitness

**Web oficial:** https://www.impuestos.gob.bo

---

## PASO 2 — Solicitar habilitación al SFE

1. Con tu NIT activo, solicita la habilitación para el SFE
2. Selecciona la modalidad: **Computarizada en Línea**
3. Proporciona los datos de tu empresa y punto de venta
4. Impuestos te entregará las credenciales de acceso al ambiente de Pilotos

---

## PASO 3 — Solicitar Token API

1. Una vez habilitado, accede al portal del SFE
2. Genera tu Token de Acceso a la API
3. El token tiene un periodo de vigencia; renuévalo cuando caduque
4. Guarda el token en un lugar seguro

---

## PASO 4 — Generar Certificado Digital (.p12)

1. Solicita a Impuestos Nacionales la generación de tu certificado digital
2. El certificado se entrega en formato **.p12** (PKCS#12)
3. Recibe también la **contraseña** del certificado
4. Guarda AMBOS (archivo .p12 y contraseña) de forma segura
5. El certificado tiene fecha de vencimiento — recuerda renovarlo

---

## PASO 5 — Configurar en la Aplicación

Abre la app → Menú izquierdo → **Configurar SFE**

### Tab 1: Datos de la Empresa
- Ingresa tu NIT, Razón Social, dirección, departamento, municipio
- Código Sucursal: generalmente `0` (casa matriz)
- Punto de Venta: generalmente `0`
- Actividad Económica: el código CAEB de tu actividad
- Haz clic en **"Guardar Datos de Empresa"**

### Tab 2: Credenciales SFE
- Selecciona **Ambiente**: empieza con "Pilotos (Pruebas)"
- Pega tu **Token de Acceso** (el campo se enmascara por seguridad)
- Ingresa el **Código Sistema** proporcionado por Impuestos
- Modalidad: `2 — Computarizada en Línea`
- Haz clic en **"Guardar Credenciales"**
- Luego haz clic en **"CUIS"** para obtener el código de inicio
- Luego haz clic en **"CUFD"** para obtener el código del día

### Tab 3: Certificado Digital
- Haz clic en **"Seleccionar archivo .p12"**
- Selecciona tu archivo de certificado
- Ingresa la contraseña del certificado
- Haz clic en **"Validar y Guardar Certificado"**
- El certificado se guarda de forma encriptada en el equipo

### Tab 4: Correo Electrónico
- Servidor SMTP: `smtp.gmail.com` (para Gmail)
- Puerto: `587` (TLS) o `465` (SSL)
- Usuario: tu correo del gym
- Contraseña: usa "Contraseña de Aplicación" de Google (no tu contraseña normal)
- Guarda y prueba con **"Enviar Prueba"**

---

## PASO 6 — Ejecutar Pruebas en Ambiente de Pilotos

Ve a la pestaña **"Pruebas de Conexión"** y haz clic en **"Ejecutar Todas"**

Las 10 pruebas deben pasar correctamente:
1. ✅ Conectividad con servidor SFE
2. ✅ Validar Token
3. ✅ Validar Certificado Digital
4. ✅ Obtener CUIS
5. ✅ Obtener CUFD del día
6. ✅ Sincronizar Catálogos
7. ✅ Sincronizar Fecha/Hora
8. ✅ Emitir Factura de Prueba
9. ✅ Anular Factura de Prueba
10. ✅ Verificar Estado de Factura

Si alguna falla, el error se muestra en rojo. Los errores más comunes:
- **Token inválido**: el token expiró, solicita uno nuevo
- **CUIS no obtenido**: verifica el código sistema y las credenciales
- **Certificado inválido**: la contraseña es incorrecta o el archivo está dañado
- **Error de conectividad**: verifica tu conexión a internet

---

## PASO 7 — Pasar a Producción

1. En Tab 2 (Credenciales SFE), cambia el **Ambiente** a "Producción"
2. Ingresa el **Token de Producción** (diferente al de pilotos)
3. Solicita también el **certificado de producción** a Impuestos
4. Ejecuta las pruebas nuevamente con el ambiente de producción
5. ¡Listo! Ya puedes emitir facturas reales

---

## Uso diario

### Emitir una factura
1. Ve a **"Emitir Factura"** en el menú lateral
2. Busca el cliente o ingresa sus datos manualmente
3. Completa el concepto y monto
4. Selecciona el método de pago
5. Haz clic en **"Emitir Factura"**
6. Se genera el PDF automáticamente
7. Si tienes email configurado, se envía al cliente

### Ver historial
- Ve a **"Historial"** en el menú lateral
- Filtra por fecha, estado, cliente o número
- Descarga PDFs o reenvía por correo

### Facturas pendientes de envío
- Si hay problemas de conectividad, las facturas se guardan como **PENDIENTE_ENVIO**
- Cuando vuelva el internet, haz clic en **"Sincronizar pendientes"**

### Anular una factura
- En el historial, haz clic en el ícono de prohibido (🚫)
- Ingresa el motivo de anulación
- La anulación se registra localmente y se notifica al SFE

---

## Seguridad

- El **token** y las **contraseñas** se almacenan encriptados con AES-256
- El **certificado .p12** se copia al directorio seguro de la app
- Nunca se muestran contraseñas en los logs
- La clave de encriptación es única por instalación

---

## Soporte

Si tienes problemas:
1. Revisa la pestaña "Pruebas de Conexión" para diagnóstico
2. Verifica que el CUFD esté vigente (se renueva cada día automáticamente)
3. Confirma que el token no haya expirado
4. Contacta a Impuestos Nacionales para problemas de credenciales

**Nota:** Este sistema implementa el protocolo SOAP de la API SFE de Bolivia
según la documentación oficial de Impuestos Nacionales.
