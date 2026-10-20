import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { WorkspaceState, Severity, IncidentStatus, ProductArea } from '../src/engine/types.ts';
import { AREA_INFO } from '../src/engine/types.ts';
import type { VoiceView } from '../src/engine/voice.ts';
import type { LaunchEval, Verdict } from '../src/engine/launch.ts';
import type { IncidentEval, IncidentSummary } from '../src/engine/incidents.ts';
import type { Mode, SendResult } from './api.ts';

export interface Ctx {
  state: WorkspaceState;
  now: number;
  mode: Mode;
  voice: VoiceView;
  launchEval: Record<string, LaunchEval>;
  incidentEval: Record<string, IncidentEval>;
  incidentSummary: IncidentSummary;
  act: (cmd: Record<string, unknown>) => Promise<SendResult>;
}

export type Tone = 'pos' | 'cau' | 'neg' | 'neu' | 'solar';

export function Chip({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`chip ${tone}`}>{dot && <span className="dot" aria-hidden="true" />}{children}</span>;
}

export const areaLabel = (a: ProductArea) => AREA_INFO[a].label;
export const sevTone = (s: Severity): Tone => (s === 1 ? 'neg' : s === 2 ? 'cau' : 'neu');
export const SevChip = ({ s }: { s: Severity }) => <Chip tone={sevTone(s)}>SEV-{s}</Chip>;
export function StatusChip({ s }: { s: IncidentStatus }) {
  const map: Record<IncidentStatus, [Tone, string]> = { investigating: ['neg', 'Investigating'], mitigated: ['cau', 'Mitigated'], resolved: ['pos', 'Resolved'] };
  return <Chip tone={map[s][0]}>{map[s][1]}</Chip>;
}
export const VERDICT_LABEL: Record<Verdict, string> = { go: 'GO', hold: 'HOLD', no_go: 'NO-GO' };
export function VerdictChip({ v }: { v: Verdict }) {
  return <Chip tone={v === 'go' ? 'solar' : v === 'hold' ? 'cau' : 'neg'}>{VERDICT_LABEL[v]}</Chip>;
}

export function Meter({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="sub">{label}</div>
      <div className="num" style={{ textAlign: 'left' }}>{done} of {total}</div>
      <div className="meter" role="img" aria-label={`${label}: ${done} of ${total} done`}><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function PageHead({ crumb, title, count, actions }: { crumb: ReactNode; title: string; count?: string; actions?: ReactNode }) {
  return (
    <>
      <p className="crumb">{crumb}</p>
      <div className="page-head">
        <h1>{title}{count && <span className="muted">{count}</span>}</h1>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label, panelId }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (v: T) => void; label: string; panelId: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} aria-controls={panelId} id={`${panelId}-${t.id}`} onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span className={`count${t.count === 0 ? ' neutral' : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={id} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="dlg">
          <div className="dlg-head">
            <div>
              <h2 id={id} style={{ marginBottom: 4 }}>{title}</h2>
              {sub && <div className="sub">{sub}</div>}
            </div>
            <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
          </div>
          <div className="dlg-body">{children}</div>
          {footer && <div className="dlg-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
