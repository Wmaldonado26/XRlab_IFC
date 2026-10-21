import { ref } from 'vue';

export function useFloatingMenu<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(emit: (...args: any[]) => any) {
  const expanded = ref(false);

  return {
    ref,
    expanded,
  };
}
