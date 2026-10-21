

<script setup lang="ts">
import { useApp } from './App.logic';
const { ref, onMounted, onUnmounted, nextTick, watch, LoginPage, AppSidebar, AppTopbar, GlobalToast, DashboardView, ProjectsView, ModelsView, UsersView, LogsView, SettingsView, ViewerCo, checkSession, isAuthenticated, isPasswordResetLink, isAdmin, logout, isAuthLoading, fetchBackendProject, currentView, selectedProject, isSidebarCollapsed, toastRef, handleToggleSidebar, showToast, triggerViewerResize, syncRouteFromHash, handleNavigate, handleOpenProject, handleProjectChanged, handleReturnGallery, handleLogout, onLoginSuccess } = useApp();
</script>

<template>
  <main class="app-root">
    <LoginPage
      v-if="isPasswordResetLink"
      @login-success="onLoginSuccess"
    />
    <!-- Pantalla de Carga Inicial de Sesión -->
    <div v-else-if="isAuthLoading" class="auth-loading-screen">
      <div class="brand" style="margin-bottom: 16px;">
        <div class="brand-mark">⚓</div>
        <div>
          <div style="font-weight: 800; font-size: 18px; color: var(--navy)">COTECMAR</div>
          <div style="font-size: 11px; color: var(--blue); font-weight: 700">XRlab</div>
        </div>
      </div>
      <div class="spinner-sm" style="border-top-color: var(--blue);"></div>
      <p style="color: var(--muted); font-size: 12px; margin-top: 12px;">Conectando con plataforma BIM...</p>
    </div>

    <!-- Pantalla de Login Corporativo -->
    <LoginPage
      v-else-if="!isAuthenticated"
      @login-success="onLoginSuccess"
    />

    <!-- Shell Empresarial Permanente -->
    <div v-else class="app" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      <!-- Barra lateral corporativa -->
      <AppSidebar
        :current-view="currentView"
        :is-collapsed="isSidebarCollapsed"
        @navigate="handleNavigate"
        @logout="handleLogout"
        @toggle-sidebar="handleToggleSidebar"
      />

      <!-- Contenedor Principal -->
      <main class="main">
        <!-- Barra superior corporativa -->
        <AppTopbar
          :current-view="currentView"
          :is-sidebar-collapsed="isSidebarCollapsed"
          @navigate="handleNavigate"
          @toast="showToast"
          @toggle-sidebar="handleToggleSidebar"
          @return-gallery="handleReturnGallery"
        />

        <!-- VISTA DASHBOARD -->
        <div v-show="currentView === 'dashboard'">
          <DashboardView
            @navigate="handleNavigate"
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA PROYECTOS -->
        <div v-show="currentView === 'projects'">
          <ProjectsView
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA MODELOS BIM -->
        <div v-show="currentView === 'models'">
          <ModelsView
            @open-project="handleOpenProject"
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA USUARIOS (Solo Administrador) -->
        <div v-if="isAdmin" v-show="currentView === 'users'">
          <UsersView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA ACTIVIDAD Y LOGS -->
        <div v-show="currentView === 'logs'">
          <LogsView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA CONFIGURACIÓN -->
        <div v-show="currentView === 'settings'">
          <SettingsView
            @show-toast="showToast"
          />
        </div>

        <!-- VISTA VISOR 3D (Preservado en DOM para no perder contexto WebGL ni fragmentos GPU) -->
        <div
          v-show="currentView === 'viewer'"
          class="viewer-embedded-wrapper"
        >
          <ViewerCo
            :initial-project="selectedProject"
            @return-gallery="handleReturnGallery"
            @project-changed="handleProjectChanged"
          />
        </div>
      </main>
    </div>

    <!-- Toast Global de Notificaciones -->
    <GlobalToast ref="toastRef" />
  </main>
</template>
<style src="./App.css"></style>


