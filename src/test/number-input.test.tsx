import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NumberInput } from '@/components/ui/number-input';
afterEach(cleanup);
it('mantiene il campo vuoto senza convertire durante la digitazione',()=>{
 const commit=vi.fn();render(<NumberInput aria-label="Coperti" value={6} defaultValue={6} onCommit={commit}/>);
 const input=screen.getByRole('spinbutton');fireEvent.change(input,{target:{value:''}});
 expect(input).toHaveValue(null);expect(commit).not.toHaveBeenCalled();
 fireEvent.blur(input);expect(commit).toHaveBeenCalledWith(6);
});
it('converte solo all’uscita dal campo e rispetta il minimo',()=>{
 const commit=vi.fn();render(<NumberInput value={6} min={1} onCommit={commit}/>);
 const input=screen.getByRole('spinbutton');fireEvent.change(input,{target:{value:'12'}});expect(commit).not.toHaveBeenCalled();
 fireEvent.blur(input);expect(commit).toHaveBeenCalledWith(12);
 fireEvent.change(input,{target:{value:'0'}});fireEvent.blur(input);expect(commit).toHaveBeenCalledTimes(1);
});