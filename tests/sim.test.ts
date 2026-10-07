import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/sim/simulation';
import { swapDigits } from '../src/sim/patients';
import type { Patient } from '../src/sim/types';

function runUntilPatient(sim: Simulation, archetype?: Patient['archetype'], maxSeconds = 4000): Patient {
  for (let i = 0; i < maxSeconds * 10; i++) {
    sim.tick(0.1);
    if (!sim.state.powerOn) {
      sim.setZone('breaker');
      sim.restorePower();
      sim.setZone('booth');
    }
    const s = sim.state;
    if (s.current && s.phase === 'present' && (!archetype || s.current.archetype === archetype)) return s.current;
    // clear unwanted patients quickly
    if (s.current && s.phase === 'present') sim.verdict(s.current.truth === 'human' ? 'admit' : 'contain');
  }
  throw new Error('no patient');
}

describe('determinism', () => {
  it('same seed gives the same shift', () => {
    const run = (seed: number) => {
      const sim = new Simulation(seed);
      const names: string[] = [];
      sim.bus.on('patientArrived', ({ patient }) => names.push(patient.displayName + patient.tells.join(',')));
      for (let i = 0; i < 6000; i++) {
        sim.tick(0.1);
        if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
      }
      return names;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('presentation randomness never changes truth', () => {
    const a = new Simulation(7);
    const b = new Simulation(7);
    a.state.sanity = 10; // makes hallucinations fire in a only
    const sa: string[] = [];
    const sb: string[] = [];
    a.bus.on('patientArrived', ({ patient }) => sa.push(patient.displayName));
    b.bus.on('patientArrived', ({ patient }) => sb.push(patient.displayName));
    for (let i = 0; i < 3000; i++) {
      a.state.sanity = 10;
      a.tick(0.1);
      b.tick(0.1);
      for (const s of [a, b]) if (s.state.current && s.state.phase === 'present') s.verdict('observe');
    }
    expect(sa).toEqual(sb);
  });
});

describe('patients', () => {
  it('humans are never marked as understudies and carry no mimic tells', () => {
    const sim = new Simulation(11);
    const p = runUntilPatient(sim, 'plain');
    expect(p.truth).toBe('human');
    expect(p.tells).toHaveLength(0);
  });

  it('a strange innocent has a paperwork typo but answers truthfully', () => {
    const sim = new Simulation(5);
    const p = runUntilPatient(sim, 'strange_innocent');
    const entry = sim.registryOf(p);
    expect(p.truth).toBe('human');
    expect(p.docs.slipDob).not.toBe(entry.dob);
    expect(p.answers.dob).toBe(entry.dob);
  });

  it('slipping mimics have at least one tell', () => {
    const sim = new Simulation(3);
    const p = runUntilPatient(sim, 'slipping_mimic');
    expect(p.truth).toBe('understudy');
    expect(p.tells.length).toBeGreaterThan(0);
  });

  it('swapDigits changes a date but keeps its shape', () => {
    const out = swapDigits('12/03/1920');
    expect(out).not.toBe('12/03/1920');
    expect(out).toMatch(/^\d\d\/\d\d\/\d{4}$/);
  });
});

describe('desk actions', () => {
  it('asking each question once, echo tell repeats the officer', () => {
    const sim = new Simulation(3);
    const p = runUntilPatient(sim, 'slipping_mimic');
    p.tells = ['echo'];
    sim.state.asked = [];
    sim.state.lastLine = '';
    const first = sim.ask('name')!;
    expect(first.text).toBe(p.answers.name); // nothing to echo yet
    const second = sim.ask('dob')!;
    expect(second.text).toBe('Name for the ledger?');
    expect(sim.ask('dob')).toBeNull(); // cannot ask twice
  });

  it('lookup needs power', () => {
    const sim = new Simulation(3);
    runUntilPatient(sim);
    expect(sim.lookup()).not.toBeNull();
    sim.state.powerOn = false;
    expect(sim.lookup()).toBeNull();
  });
});

describe('verdicts and consequences', () => {
  it('admitting an understudy raises the stage and fires a ward incident', () => {
    const sim = new Simulation(3);
    const p = runUntilPatient(sim, 'slipping_mimic');
    const stage = sim.state.stage;
    let incident = false;
    sim.bus.on('consequence', ({ c }) => c.kind === 'ward_incident' && (incident = true));
    sim.verdict('admit');
    expect(sim.state.stage).toBe(stage + 1);
    expect(sim.state.score.admittedUnderstudies).toBe(1);
    for (let i = 0; i < 2000 && !incident; i++) sim.tick(0.1);
    expect(incident).toBe(true);
    expect(p.truth).toBe('understudy');
  });

  it('containing an understudy is correct and costs no sanity', () => {
    const sim = new Simulation(3);
    runUntilPatient(sim, 'slipping_mimic');
    const before = sim.state.score.wrong;
    sim.verdict('contain');
    expect(sim.state.score.wrong).toBe(before);
    expect(sim.state.score.correct).toBeGreaterThan(0);
  });

  it('refusing a real person sends them back to the window', () => {
    const sim = new Simulation(11);
    const p = runUntilPatient(sim, 'plain');
    let returned = false;
    sim.bus.on('consequence', ({ c }) => c.kind === 'window_return' && (returned = true));
    sim.verdict('refuse');
    expect(sim.state.score.refusedHumans).toBe(1);
    for (let i = 0; i < 2500 && !returned; i++) sim.tick(0.1);
    expect(returned).toBe(true);
    expect(sim.state.queue.length).toBeGreaterThan(0);
    expect(sim.state.queue[0].displayName).toBe(p.displayName);
  });

  it('the containment lever needs power', () => {
    const sim = new Simulation(3);
    runUntilPatient(sim, 'slipping_mimic');
    sim.state.powerOn = false;
    sim.verdict('contain');
    expect(sim.state.current).not.toBeNull(); // nothing happened
  });
});

describe('breaker event and director', () => {
  it('power trips on schedule and can be restored only at the breaker', () => {
    const sim = new Simulation(9);
    let tripped = false;
    sim.bus.on('powerChanged', ({ on }) => !on && (tripped = true));
    for (let i = 0; i < 6000 && !tripped; i++) {
      sim.tick(0.1);
      if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
    }
    expect(tripped).toBe(true);
    expect(sim.restorePower()).toBe(false); // not at the panel
    sim.setZone('breaker');
    expect(sim.restorePower()).toBe(true);
    expect(sim.state.powerOn).toBe(true);
  });

  it('director always gives a quiet release window after a peak', () => {
    const sim = new Simulation(21);
    let sawPeak = false;
    let sawQuietAfter = false;
    for (let i = 0; i < 9000; i++) {
      sim.state.fear = 0;
      sim.tick(0.1);
      const d = sim.director;
      if (d.pace === 'peak') sawPeak = true;
      if (sawPeak && d.pace === 'release' && d.quiet) sawQuietAfter = true;
      if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
    }
    expect(sawPeak).toBe(true);
    expect(sawQuietAfter).toBe(true);
  });

  it('a full shift gets a handful of peaks, not a constant stream', () => {
    const sim = new Simulation(21);
    for (let i = 0; i < 15000; i++) {
      sim.state.fear = 0;
      sim.tick(0.1);
      if (sim.state.zone === 'booth' && !sim.state.powerOn) {
        sim.setZone('breaker');
        sim.restorePower();
        sim.setZone('booth');
      }
      if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
    }
    expect(sim.director.peaks).toBeGreaterThanOrEqual(3);
    expect(sim.director.peaks).toBeLessThanOrEqual(12);
  });

  it('shift ends and reports a score', () => {
    const sim = new Simulation(2);
    let ended = false;
    sim.bus.on('shiftEnded', () => (ended = true));
    for (let i = 0; i < 20000 && !ended; i++) {
      sim.tick(0.1);
      if (sim.state.zone === 'booth' && !sim.state.powerOn) {
        sim.setZone('breaker');
        sim.restorePower();
        sim.setZone('booth');
      }
      if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
    }
    expect(ended).toBe(true);
  });
});

describe('stare rule', () => {
  function waitForStare(sim: Simulation): boolean {
    for (let i = 0; i < 600; i++) {
      sim.tick(0.1);
      if (sim.state.stare) return true;
    }
    return false;
  }

  it('the Understudy punishes eye contact during a stare', () => {
    const sim = new Simulation(11);
    sim.state.stage = 3;
    const p = runUntilPatient(sim, 'fluent_mimic');
    expect(p.truth).toBe('understudy');
    sim.state.patience = 5;
    expect(waitForStare(sim)).toBe(true);
    const before = sim.state.sanity;
    sim.setGaze(true);
    sim.tick(0.1);
    expect(sim.state.sanity).toBeLessThan(before);
  });

  it('ducking below the sill avoids the penalty', () => {
    const sim = new Simulation(11);
    sim.state.stage = 3;
    runUntilPatient(sim, 'fluent_mimic');
    sim.state.patience = 5;
    expect(waitForStare(sim)).toBe(true);
    const before = sim.state.sanity;
    sim.setDuck(true);
    sim.setGaze(true);
    for (let i = 0; i < 20; i++) sim.tick(0.1);
    expect(sim.state.sanity).toBeGreaterThanOrEqual(before - 0.5);
    expect(sim.state.stare).toBe(false);
  });

  it('the harmless humming man stares too, but nothing happens', () => {
    const sim = new Simulation(5);
    const p = runUntilPatient(sim, 'strange_innocent');
    expect(p.truth).toBe('human');
    sim.state.patience = 5;
    expect(waitForStare(sim)).toBe(true);
    const f = sim.state.fear;
    sim.setGaze(true);
    sim.tick(0.1);
    expect(sim.state.fear).toBeLessThanOrEqual(f);
  });
});

describe('story beats', () => {
  it('fires each beat once and never before its time', () => {
    const sim = new Simulation(3);
    const seen: { id: string; at: number }[] = [];
    sim.bus.on('story', ({ id }) => seen.push({ id, at: sim.state.minute }));
    for (let i = 0; i < 12000; i++) {
      sim.tick(0.1);
      if (sim.state.current && sim.state.phase === 'present') sim.verdict('admit');
    }
    const ids = seen.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('open');
    expect(ids).toContain('gaze');
    expect(seen.find((x) => x.id === 'gaze')!.at).toBeGreaterThanOrEqual(38);
  });
});
