import { computed } from 'vue';

export function useSectionPlaneBar<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>(props: TProps) {
  

  const step = computed(() => {
    const span = Math.abs(props.max - props.min);
    return span > 100 ? 0.5 : 0.1;
  });

  return {
    computed,
    step,
  };
}
