/** Tiny typed event bus. The sim emits, presentation layers listen. */
export type Listener<T> = (payload: T) => void;

export class Bus<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<Listener<never>>>();
  on<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn as Listener<never>);
    return () => set!.delete(fn as Listener<never>);
  }
  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.map.get(type)?.forEach((fn) => (fn as Listener<E[K]>)(payload));
  }
}
