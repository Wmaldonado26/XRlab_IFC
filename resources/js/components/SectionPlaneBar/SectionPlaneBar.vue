<script setup lang="ts">
import { useSectionPlaneBar } from './SectionPlaneBar.logic';
const props = withDefaults(defineProps<{
  axis: 'x' | 'y' | 'z';
  offset: number;
  inverted: boolean;
  min?: number;
  max?: number;
}>(), { min: -50, max: 50 });
defineEmits(["close", "update:axis", "update:inverted", "update:offset"]);
const { computed, step } = useSectionPlaneBar(props);
</script>

<template>
  <div class="section-bar-wrap">
    <div class="section-bar-card">
      <div class="bar-header">
        <span class="bar-icon">📐</span>
        <span class="bar-title">Plano de Sección 3D</span>
      </div>

      <div class="axis-buttons">
        <button
          type="button"
          class="axis-btn"
          :class="{ active: axis === 'x' }"
          @click="$emit('update:axis', 'x')"
        >
          X (Transversal)
        </button>
        <button
          type="button"
          class="axis-btn"
          :class="{ active: axis === 'y' }"
          @click="$emit('update:axis', 'y')"
        >
          Y (Cubierta / Deck)
        </button>
        <button
          type="button"
          class="axis-btn"
          :class="{ active: axis === 'z' }"
          @click="$emit('update:axis', 'z')"
        >
          Z (Longitudinal)
        </button>
      </div>

      <div class="slider-row">
        <input
          type="range"
          class="section-slider"
          :min="min"
          :max="max"
          :step="step"
          :value="offset"
          @input="$emit('update:offset', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="offset-display">{{ offset.toFixed(1) }}m</span>
      </div>

      <div class="action-buttons">
        <button
          type="button"
          class="icon-action-btn"
          :class="{ 'is-inverted': inverted }"
          title="Invertir dirección del corte"
          @click="$emit('update:inverted', !inverted)"
        >
          🔄 Invertir
        </button>
        <button
          type="button"
          class="icon-action-btn close-btn"
          title="Desactivar plano de corte"
          @click="$emit('close')"
        >
          ✕ Cerrar
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped src="./SectionPlaneBar.css"></style>




