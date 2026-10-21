---
name: xrlab-project-workflow
description: Orienta cambios y diagnósticos que cruzan el backend Laravel y el frontend Vue de XRlab_IFC. Úsala para seguir flujos entre API, servicios, vistas y visor; para análisis especializados de Vue o IFC, consulta las Skills correspondientes.
---

# Flujo de trabajo de XRlab_IFC

Usa esta guía solo en el proyecto XRlab_IFC. Las instrucciones del `AGENTS.md` de la raíz tienen prioridad.

## Mapa del proyecto

- Laravel expone la SPA mediante `routes/web.php` y la API mediante `routes/api.php`.
- Vue arranca en `resources/js/app.ts`; `resources/js/App.vue` compone las vistas y el visor.
- La interfaz se organiza en `resources/js/components/` y `components/views/`.
- Las llamadas HTTP y flujos de carga del cliente están en `resources/js/services/backend-client.ts`.
- El procesamiento IFC en navegador usa `services/ifc-processor.ts` y `workers/ifc-processor.worker.ts`.
- La conversión backend enlaza `ConversionController`, `ConversionService`, `ChunkUploadService`, `ConvertIfcJob` y `scripts/convert-ifc.js`.
- Hay pruebas backend específicas en `tests/Feature/`, incluidas `ConversionTest.php` y `ChunkUploadTest.php`.

Este mapa sirve para orientar la búsqueda, no sustituye la verificación del código actual. Comprueba manifiestos, lockfiles, APIs y contratos afectados en cada tarea; las versiones pueden cambiar.

## Procedimiento

1. Delimita la tarea y localiza el flujo mínimo de archivos implicados.
2. Para cambios entre cliente y servidor, sigue el dato desde la vista/componente hasta el servicio frontend, ruta, controlador, servicio backend, almacenamiento o job, y de vuelta a la interfaz.
3. Distingue hechos comprobados de hipótesis. Identifica contratos, permisos, estados de carga y errores que el cambio pueda afectar.
4. Propón el cambio más pequeño que resuelva el problema. Antes de editar, presenta archivos, problema, riesgos y criterios de aceptación; espera autorización explícita.
5. Después de la autorización, modifica solo el alcance aprobado. Propón pruebas dirigidas y ejecútalas únicamente según las reglas del `AGENTS.md`. Informa resultados observados y limitaciones reales.

## Skills especializadas

- Para tareas Vue, consulta `../vue-best-practices/SKILL.md` si está disponible.
- Para conversión IFC/FRAG, That Open, Three.js, memoria o ciclo de vida del visor, consulta `../ifc-frag-performance/SKILL.md` si está disponible.
- No dupliques sus guías especializadas aquí ni permitas que contradigan las instrucciones del proyecto.
