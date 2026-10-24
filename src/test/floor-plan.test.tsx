import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FloorPlan } from '@/components/agenda/FloorPlan';
import type { Room, RTable } from '@/lib/data';
vi.mock('react-zoom-pan-pinch',()=>({TransformWrapper:({children}:{children:(tools:unknown)=>unknown})=>children({zoomIn:vi.fn(),zoomOut:vi.fn(),resetTransform:vi.fn()}),TransformComponent:({children}:{children:unknown})=>children}));
const room={id:'r',name:'Sala',grid_cols:6,grid_rows:5,walls:[]} as unknown as Room;
const tables=[{id:'a',name:'4',room_id:'r',x:1,y:2,seats:4,coperti_comodi:4,coperti_max:6},{id:'b',name:'5',room_id:'r',x:2,y:2,seats:4,coperti_comodi:4,coperti_max:6}] as RTable[];
afterEach(cleanup);
it('un tavolo occupato non si può selezionare mentre il libero passa il suo ID',()=>{
  const toggle=vi.fn();
  render(<FloorPlan room={room} tables={tables} selected={[]} suggested={[]} people={4} extended={false} closed={false} stateOf={id=>id==='b'?{kind:'busy',until:'20:30',name:'Rossi'}:{kind:'free'}} onToggle={toggle}/>);
  fireEvent.click(screen.getByRole('button',{name:'Tavolo 5'}));expect(toggle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Tavolo 4'}));expect(toggle).toHaveBeenCalledWith('a');
});
it('una sala chiusa non consente nuove selezioni',()=>{
  const toggle=vi.fn();render(<FloorPlan room={room} tables={tables} selected={[]} suggested={[]} people={4} extended={false} closed stateOf={()=>({kind:'free'})} onToggle={toggle}/>);
  fireEvent.click(screen.getByRole('button',{name:'Tavolo 4'}));expect(toggle).not.toHaveBeenCalled();
});