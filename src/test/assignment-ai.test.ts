import { afterEach,expect,it,vi } from 'vitest';
import { translateAssignmentRules, translateCustomRule } from '@/lib/assignment-ai.server';
import { assignmentRulesSchema } from '@/lib/assignment-rules';
afterEach(()=>vi.unstubAllGlobals());
it('Gemini produce solo parametri di bozza e usa il modello configurato',async()=>{
 const output={longStay:{enabled:true,from:'21:00'},protectModular:true};
 const fetcher=vi.fn(async(_url: string,_options?: RequestInit)=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]}),{status:200}));
 vi.stubGlobal('fetch',fetcher);
 const result=assignmentRulesSchema.parse(await translateAssignmentRules('test-key','Dalle 21:00 sedute lunghe, coppie su isole'));
 expect(result).toEqual(output);
 expect(fetcher.mock.calls[0]?.[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
});
it('Gemini usa schema obbligatorio e restituisce solo una bozza rigorosamente validata',async()=>{
 const output={rules:[{rule_type:'table_priority',conditions:{min_pax:2,max_pax:3,time_from:null,time_to:null},actions:{preferred_table_numbers:['1'],pairing_sequence:[],avoid_pairable:false,force_zone_id:null},priority_rank:10,human_summary:'Tavolo 1 per 2–3 persone'}]};
 const fetcher=vi.fn(async(_url:string,_options?:RequestInit)=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})));
 vi.stubGlobal('fetch',fetcher);expect(await translateCustomRule('test-key','Tavolo 1 per 2 o 3',['1'])).toEqual(output);
 const body=JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));expect(body.generationConfig.responseSchema.properties.rules.items.required).toContain('priority_rank');expect(body.generationConfig.responseSchema.properties.rules.items.properties.actions.required).toEqual(['preferred_table_numbers','pairing_sequence','avoid_pairable','force_zone_id']);
});
it('risposta Gemini fuori schema termina con errore e senza bozza',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"rules":[{"rule_type":"table_priority"}]}'}]}}]}))));
 await expect(translateCustomRule('test-key','Tavolo 1',['1'])).rejects.toThrow('Risposta Gemini non valida');
});
