<template>
  <div class="toast" :class="{ show: isVisible }">
    <span>⚓</span>
    <span>{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isVisible = ref(false);
const message = ref('');
let timer: any = null;

function show(msg: string) {
  message.value = msg;
  isVisible.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    isVisible.value = false;
  }, 2600);
}

defineExpose({
  show,
});
</script>
