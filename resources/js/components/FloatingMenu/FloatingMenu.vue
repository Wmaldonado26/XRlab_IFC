<script setup lang="ts">
import { useFloatingMenu } from './FloatingMenu.logic';
const emit = defineEmits(["clearScene", "downloadFrag", "loadFrag", "loadIfc"]);
const { ref, expanded } = useFloatingMenu(emit);
</script>

<template>
    <div class="fab-container" @mouseenter="expanded = true" @mouseleave="expanded = false">
        <button class="fab-main">+</button>
        <div v-if="expanded" class="fab-options">
            <button @click="emit('loadIfc')">Load IFC</button>
            <button @click="emit('loadFrag')">Load Frag</button>
            <button @click="emit('clearScene')">Clear</button>
            <button @click="$emit('downloadFrag')">Download</button>
        </div>
    </div>
</template>
<style scoped src="./FloatingMenu.css"></style>



