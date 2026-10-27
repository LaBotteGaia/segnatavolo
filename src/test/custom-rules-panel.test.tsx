import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomRulesPanel } from '@/components/CustomRulesPanel';
const m = vi.hoisted(()=>({parse:vi.fn(),insert:vi.fn(),clock:2000}));
vi.mock('@/lib/membership',()=>({useMembership:()=>({data:{role:'master',restaurant_id:'00000000-0000-4000-8000-000000000001'}})}));
vi.mock('@/lib/data',()=>({useCustomRules:()=>({data:[],isLoading:false})}));
vi.mock('@/lib/voice-ai.functions',()=>({getAiSettings:'load',parseCustomRule:'parse'}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(n:string)=>n==='parse'?m.parse:async()=>({provider:'gemini',keySaved:true})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({insert:m.insert})}}));
const draft={rules:[{rule_type:'table_priority',conditions:{min_pax:2,max_pax:3,time_from:null,time_to:null},actions:{preferred_table_numbers:['1'],pairing_sequence:[],avoid_pairable:false,force_zone_id:null},priority_rank:10,human_summary:'Tavolo 1 per coppie'}]};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();delete (window as unknown as {SpeechRecognition?:unknown}).SpeechRecognition;});
async function prepare(){
 m.clock=2000;vi.spyOn(Date,'now').mockImplementation(()=>m.clock);m.parse.mockResolvedValue(draft);m.insert.mockResolvedValue({error:null});
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CustomRulesPanel/></QueryClientProvider>);
 await screen.findByRole('textbox',{name:'Testo regola personalizzata'});
}
it('due tocchi immediati interpretano una volta e salvano una sola riga solo dopo conferma',async()=>{
 await prepare();fireEvent.change(screen.getByRole('textbox'),{target:{value:'Tavolo 1 per due persone'}});
 const interpret=screen.getByRole('button',{name:'Interpreta regola'});fireEvent.click(interpret);fireEvent.click(interpret);
 await screen.findByRole('button',{name:'Salva e Applica'});expect(m.parse).toHaveBeenCalledTimes(1);expect(m.insert).not.toHaveBeenCalled();
 m.clock+=1000;const save=screen.getByRole('button',{name:'Salva e Applica'});fireEvent.click(save);fireEvent.click(save);
 await waitFor(()=>expect(m.insert).toHaveBeenCalledTimes(1));
 expect(m.insert).toHaveBeenCalledWith({restaurant_id:'00000000-0000-4000-8000-000000000001',raw_text:'Tavolo 1 per due persone',parsed_logic:draft,is_active:true});
});
it('blocca reinvii entro 1000 ms anche dopo risposta rapida',async()=>{
 await prepare();fireEvent.change(screen.getByRole('textbox'),{target:{value:'Tavolo 1 per due'}});fireEvent.click(screen.getByRole('button',{name:'Interpreta regola'}));await screen.findByRole('button',{name:'Salva e Applica'});
 fireEvent.click(screen.getByRole('button',{name:'Interpreta regola'}));expect(m.parse).toHaveBeenCalledTimes(1);
 m.clock+=1000;fireEvent.click(screen.getByRole('button',{name:'Interpreta regola'}));await waitFor(()=>expect(m.parse).toHaveBeenCalledTimes(2));
});
it('fine dettatura non elabora né salva e la frase non si concatena',async()=>{
 let recognition: {continuous:boolean;interimResults:boolean;onresult?: (e:unknown)=>void;onend?:()=>void} | undefined;
 class Speech { continuous=true;interimResults=true;lang='';onresult?: (e:unknown)=>void;onend?:()=>void;start(){recognition=this;}stop(){}abort(){} }
 (window as unknown as {SpeechRecognition:unknown}).SpeechRecognition=Speech;
 await prepare();fireEvent.click(screen.getByRole('button',{name:'Detta regola personalizzata'}));
 expect(recognition?.continuous).toBe(false);expect(recognition?.interimResults).toBe(false);
 const {act}=await import('@testing-library/react');
 act(()=>{recognition?.onresult?.({results:[[{transcript:'Tavolo  1 per due'}]]});recognition?.onresult?.({results:[[{transcript:'Tavolo  1 per due'}]]});recognition?.onend?.();});
 expect(screen.getByRole('textbox')).toHaveValue('Tavolo 1 per due');expect(m.parse).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled();
});