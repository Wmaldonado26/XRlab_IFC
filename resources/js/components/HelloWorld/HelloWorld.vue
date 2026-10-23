

<script setup lang="ts">
import { useHelloWorld } from './HelloWorld.logic';
defineProps<{ msg?: any }>();
const {  } = useHelloWorld();
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      You’ve successfully created a project with
      <a href="https://vite.dev/" target="_blank" rel="noopener">Vite</a> +
      <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue 3</a>.
    </h3>
  </div>
</template>
<style scoped src="./HelloWorld.css"></style>


