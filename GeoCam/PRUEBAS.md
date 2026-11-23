# 🧪 Matriz de Pruebas y Validación – Semana 10
**GeoCam con IA Generativa Multimodal y Edge AI**  
**Autores:** Ramiro José Gómez Agámez y Álvaro Javier Pinto Sierra  
**Versión:** `v2.0.0`

---

## 📋 Escenarios de Prueba (Reto C6)

| # | Escenario de Prueba | Procedimiento | Resultado Esperado | Resultado Obtenido |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Sin conexión (Modo Avión)** | Activar modo avión en el teléfono y abrir el detalle de una foto. | El botón "✨ Describir con IA" se deshabilita o muestra un aviso claro de que se requiere red; la app no se cuelga ni crashea. | ✅ **Superado**. Muestra *"IA no disponible sin red"* y alerta explicativa. |
| **2** | **Límite diario de peticiones (C5 - HTTP 429)** | Realizar peticiones consecutivas hasta superar la cuota diaria configurada en `LIMITE_DIARIO` (tabla `uso_ia`). | La Edge Function rechaza la solicitud con código 429 y mensaje *"Has superado el límite diario permitido..."*. | ✅ **Superado**. La Edge Function cuenta las filas de las últimas 24 horas y retorna 429 sin llamar a Gemini. |
| **3** | **Sesión vencida o sin token (HTTP 401)** | Invocar la Edge Function `describir-foto` sin encabezado `Authorization` o con token inválido (`curl -i -X POST ...`). | Responde HTTP 401 `{"error": "No autorizado. Se requiere token de sesión."}` y no llega a Gemini. | ✅ **Superado**. Verificado mediante validación estricta de `getUser()`. |
| **4** | **Auditoría de seguridad (Sin API Keys en bundle)** | Buscar cadenas tipo `AIza...` o secretos en todo el código fuente cliente, `.env.example` y bundles JS compilados. | Ninguna API key de Google Gemini existe en la app móvil. Solo se expone la Supabase Publishable Key. | ✅ **Superado**. La `GEMINI_API_KEY` vive exclusivamente como secreto en Supabase Edge Functions. |
| **5** | **Edición de descripción sugerida (T6)** | Generar descripción con IA, modificar el texto en el campo editable y presionar *"Guardar descripción de IA"*. | El cambio se guarda localmente en SQLite, actualiza `updatedAt: new Date()` y queda pendiente de subir. | ✅ **Superado**. La descripción es una sugerencia editable por el usuario. |
| **6** | **Sincronización a la nube (T5)** | Describir foto con red activa. | `ai_description` y `ai_tags` se suben a la tabla `photos` de Supabase mediante `upsert` idempotente. | ✅ **Superado**. Sincronizado en ambos sentidos (`pull` y `push`). |
| **7** | **Historial persistente de IA (C1)** | Realizar múltiples descripciones en diferentes tonos (Natural, Detallado, Poético, Técnico). | Las respuestas anteriores se guardan en la tabla `ai_history` de SQLite y se pueden consultar en la misma pantalla. | ✅ **Superado**. Historial local cargado mediante `aiHistoryRepo`. |

---

## 🔒 Auditoría de Seguridad de Secretos

Para comprobar que la clave de Gemini no se filtra en el cliente:
```bash
# Búsqueda de posibles keys en el workspace
git grep -i "AIza"
# Resultado: 0 coincidencias en código cliente (solo documentado en guías/markdowns)
```
- La variable `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicas por diseño y están protegidas por RLS.
- `GEMINI_API_KEY` se administra con:
  ```bash
  npx supabase secrets set GEMINI_API_KEY=AIza...
  ```
