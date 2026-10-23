import { onMounted, ref } from 'vue';
import {
  login,
  logout,
  requestPasswordReset,
  submitPasswordReset,
} from '../../services/auth-service';

type LoginMode = 'login' | 'request-reset' | 'reset';

export function useLoginPage(emit: (...args: any[]) => any) {
  const email = ref('');
  const password = ref('');
  const passwordConfirmation = ref('');
  const rememberMe = ref(false);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const successMessage = ref('');
  const mode = ref<LoginMode>('login');
  const resetToken = ref('');

  onMounted(() => {
    const [route, query = ''] = window.location.hash.split('?');
    if (route !== '#reset-password') return;

    const params = new URLSearchParams(query);
    mode.value = 'reset';
    email.value = params.get('email') || '';
    resetToken.value = params.get('token') || '';
    if (!email.value || !resetToken.value) {
      errorMessage.value = 'El enlace de restablecimiento no es vÃ¡lido.';
    }
  });

  async function handleSubmit() {
    if (!email.value.trim() || !password.value) return;

    isLoading.value = true;
    errorMessage.value = '';
    successMessage.value = '';

    try {
      await login(email.value.trim(), password.value, rememberMe.value);
      emit('login-success');
    } catch (err: any) {
      errorMessage.value = err.message || 'Credenciales no vÃ¡lidas. Comprueba tu correo y contraseÃ±a.';
    } finally {
      isLoading.value = false;
    }
  }

  function onForgotClick() {
    mode.value = 'request-reset';
    errorMessage.value = '';
    successMessage.value = '';
  }

  function backToLogin() {
    mode.value = 'login';
    password.value = '';
    passwordConfirmation.value = '';
    errorMessage.value = '';
    successMessage.value = '';
    if (window.location.hash.startsWith('#reset-password')) {
      window.location.hash = '';
    }
  }

  async function handleRequestReset() {
    if (!email.value.trim()) return;
    isLoading.value = true;
    errorMessage.value = '';
    successMessage.value = '';

    try {
      successMessage.value = await requestPasswordReset(email.value.trim());
    } catch (err: any) {
      errorMessage.value = err.message || 'No se pudo procesar la solicitud. Intenta nuevamente.';
    } finally {
      isLoading.value = false;
    }
  }

  async function handlePasswordReset() {
    if (!email.value || !resetToken.value || !password.value || !passwordConfirmation.value) return;
    if (password.value !== passwordConfirmation.value) {
      errorMessage.value = 'Las contraseÃ±as no coinciden.';
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';
    successMessage.value = '';

    try {
      successMessage.value = await submitPasswordReset({
        email: email.value,
        token: resetToken.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      });
      await logout();
      mode.value = 'login';
      password.value = '';
      passwordConfirmation.value = '';
      resetToken.value = '';
      window.location.hash = '';
    } catch (err: any) {
      errorMessage.value = err.message || 'No se pudo restablecer la contraseÃ±a.';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    email,
    password,
    passwordConfirmation,
    rememberMe,
    isLoading,
    errorMessage,
    successMessage,
    mode,
    resetToken,
    handleSubmit,
    onForgotClick,
    backToLogin,
    handleRequestReset,
    handlePasswordReset,
  };
}
