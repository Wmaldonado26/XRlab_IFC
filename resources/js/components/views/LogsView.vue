<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  fetchActivityLogs,
  type ActivityLogItem,
} from '../../services/backend-client';

const emit = defineEmits<{
  (e: 'show-toast', message: string): void;
}>();

const logs = ref<ActivityLogItem[]>([]);
const isLoading = ref(true);

async function loadLogs() {
  isLoading.value = true;
  try {
    logs.value = await fetchActivityLogs();
  } catch (err: any) {
    emit('show-toast', err.message || 'Error cargando logs');
  } finally {
    isLoading.value = false;
  }
}

function exportCsv() {
  if (logs.value.length === 0) {
    emit('show-toast', 'No hay registros de auditoría para exportar');
    return;
  }
  const headers = ['Fecha', 'Usuario', 'Acción', 'Recurso', 'Proyecto', 'Resultado'];
  const rows = logs.value.map((l) => [
    `"${l.date}"`,
    `"${l.user}"`,
    `"${l.action}"`,
    `"${l.resource}"`,
    `"${l.projectName || ''}"`,
    `"${l.result}"`,
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `xrlab_actividad_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  emit('show-toast', 'Registro de auditoría exportado en CSV');
}

onMounted(() => {
  loadLogs();
});
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
    </div>
  </div>
</template>
