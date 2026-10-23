import { ref, onMounted } from 'vue';

import { currentUser } from '../../../services/auth-service';

export function useSettingsView<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const profileName = ref('');

  const profileEmail = ref('');

  // Viewer preferences persisted in localStorage
  const quality = ref('alta');

  const units = ref('m');

  const initialCamera = ref('fit');

  onMounted(() => {
    if (currentUser.value) {
      profileName.value = currentUser.value.name;
      profileEmail.value = currentUser.value.email;
    }
    const savedQuality = localStorage.getItem('xrlab_pref_quality');
    if (savedQuality) quality.value = savedQuality;
    const savedUnits = localStorage.getItem('xrlab_pref_units');
    if (savedUnits) units.value = savedUnits;
    const savedCamera = localStorage.getItem('xrlab_pref_camera');
    if (savedCamera) initialCamera.value = savedCamera;
  });

  function handleSave() {
    localStorage.setItem('xrlab_pref_quality', quality.value);
    localStorage.setItem('xrlab_pref_units', units.value);
    localStorage.setItem('xrlab_pref_camera', initialCamera.value);
    emit('show-toast', 'Preferencias guardadas correctamente');
  }

  return {
    ref,
    onMounted,
    currentUser,
    profileName,
    profileEmail,
    quality,
    units,
    initialCamera,
    handleSave,
  };
}
