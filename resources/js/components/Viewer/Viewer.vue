<script setup lang="ts">
import { useViewer } from './Viewer.logic';
const { onMounted, ref, OBC, FRAGS, FloatingMenu, processIfcFile, containerRef, ifcInput, fragInput, showModal, fragmentName, isLoading, loadingFileName, world, fragments, serializer, fragmentBytes, model, handleLoadIfc, handleLoadFrag, handleClear, onIfcFileChange, onFragFileChange, handleDownloadFrag, downloadFragment } = useViewer();
</script>

<template>
    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
    <div class="loading-box">
        <div class="spinner"></div>
        <p class="loading-text">Loading {{ loadingFileName }}</p>
    </div>
    </div>
    <!-- Modal -->
    <div v-if="showModal" class="modal-backdrop">
    <div class="modal-content">
        <h3>Name your fragment file:</h3>
        <input v-model="fragmentName" placeholder="model.frag" />
        <div class="modal-actions">
        <button @click="showModal = false">Cancel</button>
        <button @click="downloadFragment">Download</button>
        </div>
    </div>
    </div>
    <div ref="containerRef" class="full-screen">
        <FloatingMenu
        @loadIfc="handleLoadIfc"
        @loadFrag="handleLoadFrag"
        @clearScene="handleClear"
        @downloadFrag="handleDownloadFrag"/>

    <!-- Hiden file inputs-->
        <input ref="ifcInput" type="file" accept=".ifc" style="display: none" @change="onIfcFileChange"/>
        <input ref="fragInput" type="file" accept=".frag" style="display: none" @change="onFragFileChange"/>
    </div>
</template>
<style scoped src="./Viewer.css"></style>



