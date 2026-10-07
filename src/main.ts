import { Game } from './game';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const root = document.getElementById('app') as HTMLElement;

Game.create(canvas, root)
  .then((g) => {
    (window as unknown as { __game: Game }).__game = g;
  })
  .catch((err) => {
    root.insertAdjacentHTML('beforeend', `<pre style="color:#f88;padding:20px">Could not start: ${String(err)}</pre>`);
    console.error(err);
  });
