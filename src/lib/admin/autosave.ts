export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
/** One serialized queue per editor. Failures pause automatic retry; newer edits are never marked saved. */
export class Autosave {
  state: SaveState = 'clean';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private version = 0;
  private saved = 0;
  private running: Promise<boolean> | undefined;
  private disposed = false;
  private save: () => Promise<void>;
  private notify: (state: SaveState) => void;
  private delay: number;
  constructor(save: () => Promise<void>, notify: (state: SaveState) => void, delay = 1500) {
    this.save = save;
    this.notify = notify;
    this.delay = delay;
  }
  get dirty() {
    return this.version !== this.saved;
  }
  change() {
    if (this.disposed) return;
    this.version++;
    this.set('dirty');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.delay);
  }
  private set(state: SaveState) {
    this.state = state;
    this.notify(state);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.disposed) return false;
    if (this.running) {
      await this.running;
      return this.state === 'error' || this.state === 'conflict' ? false : this.flush();
    }
    if (!this.dirty) return true;
    const version = this.version;
    this.set('saving');
    this.running = (async () => {
      try {
        await this.save();
        this.saved = version;
        this.set(this.dirty ? 'dirty' : 'saved');
        return true;
      } catch (error) {
        this.set(
          error instanceof Error && 'kind' in error && error.kind === 'conflict'
            ? 'conflict'
            : 'error',
        );
        return false;
      }
    })();
    const ok = await this.running;
    this.running = undefined;
    if (ok && this.dirty && !this.disposed) return this.flush();
    return ok;
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
