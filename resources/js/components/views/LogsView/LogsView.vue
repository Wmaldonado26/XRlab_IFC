

<script setup lang="ts">
import { useLogsView } from './LogsView.logic';
const emit = defineEmits(["show-toast"]);
const { logs, isLoading, currentPage, lastPage, total, loadLogs, changePage, exportCsv } = useLogsView(emit);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Actividad y logs</h1>
        <p>Auditoría de operaciones realizadas dentro de XRlab.</p>
      </div>
      <button class="secondary-btn" @click="exportCsv">
        ↓ Exportar registro
      </button>
    </div>

    <div v-if="isLoading" class="panel" style="padding: 40px; text-align: center; color: var(--muted)">
      Cargando registros de auditoría...
    </div>

    <div v-else-if="logs.length === 0" class="panel" style="padding: 50px; text-align: center">
      <div style="font-size: 32px; margin-bottom: 12px">≡</div>
      <h3 style="margin: 0 0 8px">No hay actividad registrada aún</h3>
      <p style="color: var(--muted); font-size: 13px">Las acciones y operaciones en proyectos y modelos aparecerán aquí.</p>
    </div>

    <div v-else class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Recurso</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in logs" :key="l.id">
            <td style="color: #64748b; font-weight: 500">{{ l.date }}</td>
            <td><b>{{ l.user }}</b></td>
            <td>{{ l.action }}</td>
            <td>
              <code>{{ l.resource }}</code>
              <span v-if="l.projectName" style="color: #8b97a9; font-size: 11px; margin-left: 6px">
                ({{ l.projectName }})
              </span>
            </td>
            <td>
              <span class="status" :class="l.statusClass">
                {{ l.result }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-controls" style="display:flex; align-items:center; justify-content:space-between; padding:16px">
        <span>Registros: {{ total }}</span>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="secondary-btn" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">Anterior</button>
          <span>{{ currentPage }} / {{ lastPage }}</span>
          <button class="secondary-btn" :disabled="currentPage >= lastPage" @click="changePage(currentPage + 1)">Siguiente</button>
        </div>
      </div>
    </div>
  </div>
</template>
