import { useEffect, useState, type ComponentProps } from 'react';
import { Input } from './input';

/** Keep editable text separate from committed numbers. Empty edits default only on blur. */
export function NumberInput({ value, onCommit, defaultValue = 0, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type'> & { value: number | null; onCommit: (value: number) => void; defaultValue?: number }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);
  return <Input {...props} type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => {
    const n = draft.trim() === '' ? defaultValue : Number(draft);
    if (!Number.isFinite(n) || !Number.isInteger(n) || (props.min !== undefined && n < Number(props.min)) || (props.max !== undefined && n > Number(props.max))) { setDraft(value === null ? '' : String(value)); return; }
    setDraft(String(n)); onCommit(n);
  }} />;
}