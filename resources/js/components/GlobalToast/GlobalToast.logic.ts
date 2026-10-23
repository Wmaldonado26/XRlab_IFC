import { ref } from 'vue';

export function useGlobalToast<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
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

  return {
    ref,
    isVisible,
    message,
    timer,
    show,
  };
}
