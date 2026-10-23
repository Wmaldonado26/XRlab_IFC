# Instrucciones del proyecto XRlab_IFC

Estas reglas aplican a todo el proyecto local abierto en Visual Studio Code.

- Trabaja exclusivamente con los archivos locales de esta carpeta. No cambies de directorio para trabajar sobre otra copia del proyecto.
- No consultes GitHub ni repositorios remotos. No ejecutes comandos Git ni realices operaciones de ramas, commits, push, pull, fetch, merge, rebase, reset o checkout. No uses Git para obtener, comparar, actualizar o recuperar código.
- En auditorías y diagnósticos, limita el trabajo a leer y analizar archivos locales; no modifiques archivos. Presenta hallazgos con evidencias.
- Antes de editar, presenta los archivos afectados, el problema que resolverías, los riesgos y los criterios de aceptación. Espera autorización explícita antes de cambiar archivos; la autorización cubre solo el alcance aprobado.
- No instales ni actualices dependencias, ejecutes migraciones o conversiones IFC, ni despliegues el proyecto sin autorización explícita.
- No leas ni reveles el contenido de `.env`, credenciales, tokens u otros secretos.
- Conserva intacto el IFC original; no lo dividas en varios archivos. Preserva las funciones existentes del visor, incluidos cortes, mediciones, controles de cámara, navegación y datos BIM.
- Evita consultas innecesarias a la terminal, lecturas repetitivas y análisis de archivos minificados cuando no sean necesarios.
- Verifica la arquitectura, dependencias y APIs desde los archivos locales relevantes. No supongas compatibilidad con streaming o carga incremental sin evidencia ni afirmes resultados que no hayan sido probados.
- Distingue entre una Skill encontrada como archivo y una Skill que Codex haya cargado o pueda invocar automáticamente. No afirmes que está activa sin evidencia del entorno.
- Si una prueba puede modificar archivos, datos o servicios, solicita autorización específica antes de ejecutarla. Informa comandos, resultados observados y limitaciones reales.
