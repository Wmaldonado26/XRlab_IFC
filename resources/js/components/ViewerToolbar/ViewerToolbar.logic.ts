import { isAdmin } from '../../services/auth-service';

export function useViewerToolbar<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
  

  

  return {
    isAdmin,
  };
}
