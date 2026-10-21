import { ref } from 'vue';

import { login } from '../../services/auth-service';

export function useLoginModal<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps, emit: (...args: any[]) => any) {
  const email = ref('');

  const password = ref('');

  const showPassword = ref(false);

  const isLoading = ref(false);

  const errorMessage = ref('');

  function onBackdropClick() {
    if (props.allowClose) {
      emit('update:modelValue', false);
    }
  }

  async function handleLogin() {
    if (!email.value || !password.value) return;
  
    isLoading.value = true;
    errorMessage.value = '';
  
    try {
      await login(email.value.trim(), password.value);
      emit('login-success');
      emit('update:modelValue', false);
      password.value = '';
    } catch (err: any) {
      errorMessage.value = err.message || 'Error al iniciar sesión. Compruebe sus credenciales.';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    ref,
    login,
    email,
    password,
    showPassword,
    isLoading,
    errorMessage,
    onBackdropClick,
    handleLogin,
  };
}
