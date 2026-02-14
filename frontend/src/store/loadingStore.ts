import { create } from 'zustand';

interface LoadingState {
  activeRequests: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  activeRequests: 0,
  isLoading: false,
  increment: () =>
    set((state) => {
      const next = state.activeRequests + 1;
      return { activeRequests: next, isLoading: next > 0 };
    }),
  decrement: () =>
    set((state) => {
      const next = Math.max(0, state.activeRequests - 1);
      return { activeRequests: next, isLoading: next > 0 };
    }),
  reset: () => set({ activeRequests: 0, isLoading: false }),
}));

export default useLoadingStore;