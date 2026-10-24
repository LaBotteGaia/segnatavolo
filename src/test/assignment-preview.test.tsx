import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AssignmentRulesEditor } from '@/components/AssignmentRulesEditor';

const mocks = vi.hoisted(() => ({ load: vi.fn(), parse: vi.fn(), update: vi.fn(), read: vi.fn(), settings: {assignmentRules:{longStay:{enabled:false,from:'21:00'},protectModular:false}} }));
vi.mock('@/lib/membership',()=>({useMembership:()=>({data:{restaurant_id:'restaurant-1',restaurants:{settings:mocks.settings}}})}));
vi.mock('@/lib/voice-ai.functions',()=>({getAiSettings:'load',parseAssignmentRules:'parse'}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(name:string)=>name==='load'?mocks.load:mocks.parse}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:mocks.read})}),update:(value:unknown)=>{mocks.update(value);return {eq:()=>({select:async()=>({data:[{id:'restaurant-1'}],error:null})})};}})}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const draft={longStay:{enabled:true,from:'21:00'},protectModular:true};
async function prepare(){
  mocks.load.mockResolvedValue({provider:'gemini',keySaved:true});mocks.parse.mockResolvedValue(draft);mocks.read.mockResolvedValue({data:{settings:{...mocks.settings,otherSetting:'preserved'}},error:null});
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AssignmentRulesEditor/></QueryClientProvider>);
  fireEvent.change(await screen.findByRole('textbox',{name:'Descrizione regole'}),{target:{value:'Dalle 21 preferisci le isole e proteggi i tavoli componibili'}});
  fireEvent.click(screen.getByRole('button',{name:'Prepara bozza'}));
  await screen.findByRole('region',{name:'Verifica regola riconosciuta'});
}
it('la bozza non salva prima della conferma; scartarla non persiste nulla',async()=>{
  await prepare();expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Annulla / Scarta'}));
  expect(mocks.update).not.toHaveBeenCalled();expect(screen.getByRole('switch',{name:'Attiva sedute lunghe'})).not.toBeChecked();
});
it('la conferma persiste i valori riconosciuti preservando le altre impostazioni',async()=>{
  await prepare();fireEvent.click(screen.getByRole('button',{name:'Conferma e Attiva Regola'}));
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith({settings:{assignmentRules:draft,otherSetting:'preserved'}}));
});
it('la modifica manuale resta non persistente fino al salvataggio',async()=>{
  await prepare();fireEvent.click(screen.getByRole('button',{name:'Modifica Manualmente'}));
  expect(screen.getByRole('switch',{name:'Attiva sedute lunghe'})).toBeChecked();expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('switch',{name:'Proteggi tavoli componibili'}));
  fireEvent.click(screen.getByRole('button',{name:'Salva Regole'}));
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith({settings:{assignmentRules:{...draft,protectModular:false},otherSetting:'preserved'}}));
});