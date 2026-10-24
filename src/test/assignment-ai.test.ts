import { afterEach,expect,it,vi } from 'vitest';
import { translateAssignmentRules } from '@/lib/assignment-ai.server';
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