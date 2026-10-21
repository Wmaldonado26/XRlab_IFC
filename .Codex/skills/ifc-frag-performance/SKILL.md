---
name: ifc-frag-performance
description: Analiza, depura y optimiza conversión IFC a FRAG y visores BIM con That Open Engine, Fragments y Three.js. Úsala para investigar memoria, carga, workers, estabilidad y ciclo de vida de recursos gráficos en estos proyectos.
---

# Rendimiento IFC y FRAG

Investiga con evidencia antes de proponer cambios. Adapta el análisis a la arquitectura y a las versiones reales del repositorio; no presupongas que todos los proyectos usan la misma versión o flujo.

## Flujo

1. Inspecciona la estructura local y las dependencias declaradas/resueltas (manifiestos, lockfiles y APIs disponibles). No uses Git para comprobar cambios. Limita las lecturas al código relevante; evita consultas repetidas, lecturas masivas y código minificado.
2. Traza por separado la conversión IFC → FRAG y la carga de FRAG en el visor. Sigue los datos por workers, transferencias, buffers, caché y entrada a la escena/renderizador.
3. Investiga causas de presión de memoria, asignaciones y copias de buffers, cierres inesperados, workers y ciclo de vida de geometrías, materiales, texturas, modelos y renderizador. Distingue observaciones, hipótesis y causas demostradas.
4. Prioriza causas demostrables. Compara opciones en memoria máxima, tiempo de carga, estabilidad y compatibilidad con las versiones/APIs comprobadas. Propón cambios mínimos, explica impacto y riesgos, y define pruebas específicas para la ruta afectada.
5. Antes de editar, presenta los archivos afectados, el problema, el cambio propuesto, los riesgos y las pruebas previstas; espera autorización explícita para ese alcance. No edites durante una auditoría de solo lectura. Tras la autorización, cambia solo lo aprobado, revisa localmente los archivos afectados y ejecuta únicamente pruebas autorizadas. Reporta resultados reales, limitaciones y evidencia; no declares eficaz una optimización sin mediciones o pruebas que la respalden.

## Restricciones

- Conserva el IFC original intacto; no lo dividas en varios archivos como solución.
- No atribuyas streaming ni carga incremental a FRAG sin verificarlo en la versión y APIs instaladas. Distingue la descarga progresiva de partes de la carga incremental dentro del formato o visor.
- No prometas que un IFC de 3,7 GB funcionará en todos los equipos. Considera memoria disponible, navegador, GPU y tamaño del FRAG resultante.
- Preserva cortes, mediciones, controles de cámara y demás funciones existentes; comprueba los flujos afectados por cualquier cambio.
- No actualices dependencias ni cambies la arquitectura sin evidencia y justificación explícita.
- No modifiques archivos en auditorías de solo lectura ni borres, reviertas o sobrescribas cambios del usuario. Respeta todo contenido local preexistente y limita los cambios a los archivos y alcance autorizados; no uses Git ni dependas de un diff de Git.

## Entrega

Presenta diagnóstico con evidencias y archivos relevantes; separa causas confirmadas de hipótesis. Compara opciones y riesgos, indica el plan por etapas y resume pruebas ejecutadas con resultados y limitaciones. Si no se ejecutaron pruebas, indícalo claramente.
