import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { bookingSchema, slugSchema, type OnlinePage } from './online-booking';
export const getOnlinePage = createServerFn({method:'GET'}).inputValidator((d: unknown)=>z.object({slug:slugSchema}).parse(d)).handler(async({data})=>{
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']!;
 const client=createClient<Database>(process.env['SUPABASE_URL']!,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers); if(key.startsWith('sb_')) h.delete('Authorization'); h.set('apikey',key); return fetch(input,{...init,headers:h});}}});
 const {data:page,error}=await client.rpc('get_online_booking_page',{_slug:data.slug});
 if(error) throw new Error('Impossibile caricare le disponibilità. Riprova.');
 return page as OnlinePage|null;
});
export const submitOnlineBooking = createServerFn({method:'POST'}).inputValidator((d: unknown)=>bookingSchema.parse(d)).handler(async({data})=>{
 const key=process.env['SUPABASE_PUBLISHABLE_KEY']!;
 const client=createClient<Database>(process.env['SUPABASE_URL']!,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers); if(key.startsWith('sb_')) h.delete('Authorization'); h.set('apikey',key); return fetch(input,{...init,headers:h});}}});
 const {slug,...payload}=data;
 const {data:result,error}=await client.rpc('submit_online_booking',{_slug:slug,_data:payload});
 if(error) return {ok:false as const,error:error.code==='P0001'?error.message:'Prenotazione non salvata. Controlla i dati e riprova.'};
 return {ok:true as const,result};
});
