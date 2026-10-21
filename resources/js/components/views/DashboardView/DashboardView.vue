<script setup lang="ts">
import { useDashboardView } from './DashboardView.logic';
const emit = defineEmits(["create-project", "navigate", "open-project", "show-toast"]);
const { ref, computed, onMounted, currentUser, isAdmin, fetchDashboardStats, stats, isLoading, userFirstName, truncate, loadStats } = useDashboardView(emit);
</script>

<template>
  <div class="page">
    <!-- Page Header -->
    <div class="page-head">
      <div>
        <h1>Buenos días, {{ userFirstName }}</h1>
        <p>Resumen operativo de la plataforma XRlab.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="secondary-btn" @click="$emit('navigate', 'logs')">
          Ver actividad
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="primary-btn"
          @click="$emit('create-project')"
        >
          + Nuevo proyecto
        </button>
      </div>
    </div>

    <!-- 4 KPI Metrics (Real Data) -->
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-label">Proyectos activos</span>
          <span class="kpi-icon">◫</span>
        </div>
        <div class="kpi-value">{{ stats?.activeProjects ?? '—' }}</div>
        <span class="trend">↑ Proyectos en plataforma</span>
      </div>

      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-label">Modelos BIM</span>
          <span class="kpi-icon">◇</span>
        </div>
        <div class="kpi-value">{{ stats?.bimModels ?? '—' }}</div>
        <span class="trend">↑ Formatos IFC y FRAG</span>
      </div>

      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-label">Usuarios</span>
          <span class="kpi-icon">♙</span>
        </div>
        <div class="kpi-value">{{ stats?.users ?? '—' }}</div>
        <span class="trend">↑ Cuentas autorizadas</span>
      </div>

      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-label">Almacenamiento</span>
          <span class="kpi-icon">▣</span>
        </div>
        <div class="kpi-value">{{ stats?.storageFormatted ?? '0 B' }}</div>
        <span class="trend">Stream optimizado 64-bit</span>
      </div>
    </div>

    <!-- Grid 2: Recent Projects & Activity -->
    <div class="grid-2">
      <!-- Panel: Proyectos Recientes -->
      <section class="panel">
        <div class="panel-head">
          <h3>Proyectos recientes</h3>
          <span>Últimos movimientos</span>
        </div>

        <div v-if="isLoading" style="padding: 30px; text-align: center; color: var(--muted);">
          Cargando proyectos desde el servidor...
        </div>

        <div v-else-if="!stats?.recentProjects || stats.recentProjects.length === 0" style="padding: 30px; text-align: center; color: var(--muted);">
          No hay proyectos registrados en este momento.
        </div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Modelos</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proj in stats.recentProjects" :key="proj.id">
              <td>
                <div class="project-cell">
                  <div class="project-thumb">⚓</div>
                  <div>
                    <b>{{ proj.name }}</b>
                    <br />
                    <small style="color: #8b97a9;">{{ proj.description ? truncate(proj.description, 35) : 'Proyecto naval BIM' }}</small>
                  </div>
                </div>
              </td>
              <td>
                <span style="font-weight: 600;">{{ proj.modelsCount || (proj.parts ? proj.parts.length : 0) }} modelos</span>
              </td>
              <td>
                <span class="status" :class="(proj.modelsCount || (proj.parts && proj.parts.length)) ? 'ok' : 'warn'">
                  {{ (proj.modelsCount || (proj.parts && proj.parts.length)) ? 'Activo' : 'Pendiente' }}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  class="secondary-btn"
                  style="padding: 6px 12px; font-size: 11px;"
                  @click="$emit('open-project', proj)"
                >
                  Abrir visor
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Panel: Actividad Reciente -->
      <section class="panel">
        <div class="panel-head">
          <h3>Actividad reciente</h3>
          <span>Auditoría en tiempo real</span>
        </div>

        <div class="activity">
          <div v-if="isLoading" style="padding: 20px; text-align: center; color: var(--muted);">
            Consultando registros...
          </div>

          <div v-else-if="!stats?.recentActivity || stats.recentActivity.length === 0" style="padding: 20px; text-align: center; color: var(--muted);">
            No hay actividad reciente registrada.
          </div>

          <div
            v-for="act in stats?.recentActivity || []"
            :key="act.id"
            class="activity-item"
          >
            <i class="activity-dot" :style="{ background: act.statusClass === 'err' ? 'var(--danger)' : 'var(--blue2)' }"></i>
            <div>
              <strong>{{ act.action }}</strong>
              <span>{{ act.resource }} · {{ act.date }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
<style src="./DashboardView.css"></style>
