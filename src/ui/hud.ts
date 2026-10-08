import '@fontsource/special-elite/latin-400.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/reenie-beanie/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './style.css';
import type { Patient, QuestionId, RegistryEntry, TodoItem, Verdict } from '../sim/types';
import { QUESTION_TEXT } from '../sim/patients';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document): T => root.querySelector(sel) as T;

export function formatClock(minute: number): string {
  // 300 shift minutes cover the eight hours from 22:00 to 06:00
  const total = 22 * 60 + Math.floor(minute * 1.6);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface HudHandlers {
  ask(q: QuestionId): void;
  lookup(): void;
  face(): void;
  verdict(v: Verdict): void;
  begin(): void;
}

export class Hud {
  private root: HTMLElement;
  private subTimer = 0;
  private patient: Patient | null = null;
  private asked = new Set<QuestionId>();
  private btnQ = new Map<QuestionId, HTMLButtonElement>();
  private btnVerdict = new Map<Verdict, HTMLButtonElement>();
  private btnTools: HTMLButtonElement[] = [];

  constructor(root: HTMLElement, private readonly h: HudHandlers) {
    this.root = root;
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div id="clock" class="hud"><div class="time">22:00</div><div class="goal">Keep it off Ward B until six. Then bed 9.</div><div class="task"></div><ul class="todo"></ul></div>
      <div id="bars" class="hud">
        <div>nerves</div><div class="bar sanity"><i></i></div>
        <div class="stam" style="display:none">wind</div><div class="bar stam" style="display:none"><i></i></div>
      </div>
      <div id="cross" class="hud"></div>
      <div id="prompt" class="hud"><span class="t"></span><span class="hold"></span></div>
      <div id="subtitle" class="hud"><span class="who"></span><span class="text"></span></div>
      <div id="flashlight" class="hud">F  flashlight</div>
      <div id="cards">
        <div class="card" id="slip"><h3>Admission form<small>What they handed you</small></h3><dl></dl><span class="received">RECEIVED</span></div>
        <div class="card" id="logcard"><h3>notes</h3><div id="log"></div></div>
      </div>
      <div id="ledgerwrap"><div class="card crt off" id="ledger"><h3>HOSPITAL RECORDS</h3><dl><dt>STATUS</dt><dd>Standing by</dd></dl></div></div>
      <div id="desk">
        <div class="group"><h4>ask</h4><div class="row" id="qrow"></div></div>
        <div class="group"><h4>check</h4><div class="row" id="trow"></div></div>
        <div class="group"><h4>decide</h4><div class="row" id="vrow"></div></div>
      </div>
      <div id="perf" class="hud"></div>
      <div id="overlay"><div class="box"></div></div>`,
    );
    const qrow = $('#qrow');
    (['name', 'dob', 'sender', 'kin', 'memory'] as QuestionId[]).forEach((q, i) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `<kbd>${i + 1}</kbd>${SHORT_Q[q]}`;
      b.title = QUESTION_TEXT[q];
      b.onclick = () => this.h.ask(q);
      qrow.appendChild(b);
      this.btnQ.set(q, b);
    });
    const trow = $('#trow');
    const tools: [string, string, () => void][] = [
      ['Z', 'Records', () => this.h.lookup()],
      ['X', 'Face', () => this.h.face()],
    ];
    for (const [k, label, fn] of tools) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `<kbd>${k}</kbd>${label}`;
      b.onclick = fn;
      trow.appendChild(b);
      this.btnTools.push(b);
    }
    const vrow = $('#vrow');
    const verdicts: [Verdict, string, string, string][] = [
      ['admit', 'A', 'Let in', 'admit'],
      ['observe', 'O', 'Hold', 'observe'],
      ['refuse', 'R', 'Turn away', 'refuse'],
      ['contain', 'T', 'Trapdoor', 'contain'],
    ];
    for (const [v, k, label, cls] of verdicts) {
      const b = document.createElement('button');
      b.className = `btn ${cls}`;
      b.innerHTML = `<kbd>${k}</kbd>${label}`;
      b.onclick = () => this.h.verdict(v);
      vrow.appendChild(b);
      this.btnVerdict.set(v, b);
    }
    this.setDeskEnabled(false);
  }

  // ------------------------------------------------------------------ overlay
  overlay(html: string | null): void {
    const o = $('#overlay');
    if (html === null) {
      o.style.display = 'none';
      return;
    }
    o.style.display = 'flex';
    $('.box', o).innerHTML = html;
    const b = o.querySelector<HTMLButtonElement>('button[data-begin]');
    if (b) b.onclick = () => this.h.begin();
  }

  // ------------------------------------------------------------------ status
  setClock(minute: number): void {
    $('#clock .time').textContent = formatClock(minute);
  }
  setTask(text: string): void {
    $('#clock .task').textContent = text;
  }
  setSanity(v: number): void {
    ($('#bars .sanity > i') as HTMLElement).style.width = `${Math.max(0, Math.min(100, v))}%`;
  }
  setStamina(v: number, show: boolean): void {
    for (const e of this.root.querySelectorAll<HTMLElement>('#bars .stam')) e.style.display = show ? 'block' : 'none';
    ($('#bars .bar.stam > i') as HTMLElement).style.width = `${v * 100}%`;
  }
  setTodo(items: TodoItem[]): void {
    const ul = $('#clock .todo');
    ul.innerHTML = items
      .filter((t) => t.shown)
      .map((t) => `<li class="${t.done ? 'done' : t.missed ? 'missed' : ''}">${esc(t.text)}<small>${esc(t.where)}</small></li>`)
      .join('');
  }
  /** Tab: push the paperwork aside to look at whoever is at the glass. */
  toggleAside(): void {
    this.root.classList.toggle('aside');
  }
  setMode(desk: boolean): void {
    this.root.classList.toggle('desk', desk);
    $('#desk').style.display = desk ? 'flex' : 'none';
    $('#cards').style.display = desk ? 'flex' : 'none';
    $('#ledgerwrap').style.display = desk ? 'block' : 'none';
    $('#cross').style.display = desk ? 'none' : 'block';
    $('#flashlight').style.display = desk ? 'none' : 'block';
  }
  prompt(text: string | null, hold = 0): void {
    const p = $('#prompt');
    if (!text) {
      p.style.display = 'none';
      return;
    }
    p.style.display = 'block';
    $('.t', p).textContent = text;
    ($('.hold', p) as HTMLElement).style.width = `${Math.round(hold * 100)}%`;
  }
  subtitle(who: string, text: string, ms: number): void {
    const s = $('#subtitle');
    $('.who', s).textContent = who;
    $('.text', s).textContent = text;
    s.style.display = 'block';
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => (s.style.display = 'none'), ms);
  }
  perf(text: string | null): void {
    const p = $('#perf');
    p.style.display = text === null ? 'none' : 'block';
    if (text !== null) p.textContent = text;
  }

  // ------------------------------------------------------------------ desk
  setDeskEnabled(on: boolean): void {
    for (const b of this.btnQ.values()) b.disabled = !on;
    for (const b of this.btnVerdict.values()) b.disabled = !on;
    for (const b of this.btnTools) b.disabled = !on;
  }

  showPatient(p: Patient | null): void {
    this.patient = p;
    this.asked.clear();
    const dl = $('#slip dl');
    if (!p) {
      dl.innerHTML = '<dt>Desk</dt><dd>nobody at the window</dd>';
      $('#log').innerHTML = '';
      this.setLedger(null, true);
      this.setDeskEnabled(false);
      this.btnQ.forEach((b) => b.classList.remove('used'));
      return;
    }
    dl.innerHTML = `
      <dt>Name</dt><dd>${esc(p.docs.slipName)}</dd>
      <dt>Born</dt><dd>${esc(p.docs.slipDob)}</dd>
      <dt>Sent by</dt><dd>${esc(p.docs.slipSender)}</dd>
      <dt>Wristband</dt><dd>${esc(p.docs.wristband)}</dd>
      <dt>Photo shows</dt><dd>${esc(p.docs.photoMark)}</dd>`;
    $('#log').innerHTML = '';
    this.setLedger(null, true);
    this.btnQ.forEach((b) => b.classList.remove('used'));
    this.setDeskEnabled(true);
  }

  markAsked(q: QuestionId): void {
    this.asked.add(q);
    this.btnQ.get(q)!.classList.add('used');
    this.btnQ.get(q)!.disabled = true;
  }

  logLine(kind: 'q' | 'a' | 'face', text: string): void {
    const log = $('#log');
    const p = document.createElement('p');
    p.className = kind;
    p.textContent = kind === 'q' ? `asked: ${text.replace(/\?$/, '')}` : text;
    log.appendChild(p);
    while (log.children.length > 9) log.removeChild(log.firstChild!);
  }

  setLedger(e: RegistryEntry | null, reset = false, powerOn = true): void {
    const el = $('#ledger');
    const dl = $('dl', el);
    el.classList.toggle('off', !powerOn || (!e && reset));
    if (!powerOn) {
      dl.innerHTML = '<dt>STATUS</dt><dd>NO POWER</dd>';
      return;
    }
    if (!e) {
      dl.innerHTML = '<dt>STATUS</dt><dd>Standing by</dd>';
      return;
    }
    dl.innerHTML = `
      <dt>RECORD</dt><dd>${esc(e.id)}</dd>
      <dt>NAME</dt><dd>${esc(e.name)}</dd>
      <dt>BORN</dt><dd>${esc(e.dob)}</dd>
      <dt>REFERRED BY</dt><dd>${esc(e.sender)}</dd>
      <dt>NEXT OF KIN</dt><dd>${esc(e.kin)}</dd>
      <dt>WRISTBAND</dt><dd>${esc(e.wristband)}</dd>
      <dt>PHOTO</dt><dd>${esc(e.photoMark)}</dd>
      ${e.alive ? '' : '<dt>STATUS</dt><dd>DECEASED</dd>'}
      ${e.note ? `<dt>NOTES</dt><dd>${esc(e.note)}</dd>` : ''}`;
    el.classList.remove('off');
  }

  get currentPatient(): Patient | null {
    return this.patient;
  }
}

const SHORT_Q: Record<QuestionId, string> = { name: 'Name', dob: 'Born', sender: 'Sent by', kin: 'Kin', memory: 'Tonight' };

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
