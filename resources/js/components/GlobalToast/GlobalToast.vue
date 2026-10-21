<script setup lang="ts">
import { useGlobalToast } from './GlobalToast.logic';
const { ref, isVisible, message, timer, show } = useGlobalToast();
defineExpose({ show });
</script>

<template>
  <div class="toast" :class="{ show: isVisible }">
    <span>⚓</span>
    <span>{{ message }}</span>
  </div>
</template>
<style src="./GlobalToast.css"></style>
