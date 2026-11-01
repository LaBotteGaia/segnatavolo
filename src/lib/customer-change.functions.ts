import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { OnlineSlot } from './online-booking';
export const getManagedSlots = createServerFn({method:'POST'}).inputValidator((v:unknown)=>z.object({token:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),shift:z.enum(['pranzo','sera'])}).parse(v)).handler(async({data})=>{
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data: booking,error}=await supabaseAdmin.rpc('manage_customer_booking_v2',{_token:data.token,_action:'view',_date:undefined,_shift:undefined});
  if(error)throw new Error('Link non disponibile');
  const value=booking as {slug?:string;restaurant_id?:string};
  if(!value.slug||!value.restaurant_id)return [] as OnlineSlot[];
  const {data:row}=await supabaseAdmin.from('reservations').select('id').eq('restaurant_id',value.restaurant_id).eq('management_token',data.token).single();
  if(!row)return [] as OnlineSlot[];
  const {data:slots,error:slotError}=await supabaseAdmin.rpc('get_online_booking_slots',{_slug:value.slug,_date:data.date,_shift:data.shift});
  if(slotError)throw new Error('Orari non disponibili');
  // Aggregate availability only. Exclude this capability's original booking, never another customer's.
  return await Promise.all((slots as OnlineSlot[]).map(async s=>{const {data:remaining,error}=await supabaseAdmin.rpc('online_slot_remaining',{_rid:value.restaurant_id??'',_date:data.date,_shift:data.shift,_time:s.time,_exclude:row.id});if(error)throw new Error('Disponibilità non raggiungibile');return {...s,remaining};}));
});
const decisionSchema=z.object({restaurantId:z.string().uuid(),id:z.string().uuid(),accept:z.boolean(),expected:z.object({date:z.string().optional(),shift:z.string().optional(),time:z.string(),people:z.number().int()}),tables:z.array(z.string().uuid()).max(100),extras:z.object({extra_sponde:z.number().int().min(0).max(20),extra_barelle:z.number().int().min(0).max(20),barella_seats:z.number().int().min(0).max(20)}),reason:z.string().max(1000)});
export const decideCustomerChange=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>decisionSchema.parse(v)).handler(async({data,context})=>{
  const {data:result,error}=await context.supabase.rpc('decide_customer_change',{_rid:data.restaurantId,_id:data.id,_accept:data.accept,_expected:data.expected,_tables:data.tables,_extras:data.extras,_reason:data.reason});
  if(error)return {ok:false as const,error:error.code==='P0001'?error.message:'Modifica non salvata. Aggiorna e riprova.'};
  let email={sent:false,message:'Decisione salvata, ma email cliente non inviata.'};
  try{
    if(data.accept){const {sendBookingNotification}=await import('./restaurant-email.server');email=await sendBookingNotification(data.restaurantId,data.id);}
    else{const {sendRejectedChange}=await import('./service-communications.server');email=await sendRejectedChange(data.restaurantId,data.id);}
  }catch{/* Decision is already persisted; never undo it for email failure. */}
  return {ok:true as const,result,email};
});