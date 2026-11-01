import { useState } from 'react';
import { format,parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { DayProps } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import type { OnlinePage } from '@/lib/online-booking';
import { dayAvailable } from '@/lib/online-booking';
import { closureMessage } from '@/lib/schedule-exceptions';
export function PublicScheduleCalendar({page,date,onSelect}:{page:OnlinePage;date:string;onSelect:(date:string)=>void}){
  const [notice,setNotice]=useState('');
  return <><Calendar className="mx-auto w-full max-w-sm [--cell-size:2.4rem]" mode="single" locale={it} selected={date?parseISO(date):undefined} startMonth={parseISO(page.today)} endMonth={parseISO(page.days.at(-1)?.date??page.today)} disabled={d=>{const entry=page.days.find(x=>x.date===format(d,'yyyy-MM-dd'));return !entry||!dayAvailable(entry,1);}} onSelect={d=>{setNotice('');onSelect(d?format(d,'yyyy-MM-dd'):'');}} components={{Day:({day,modifiers,...props}:DayProps)=>{const message=closureMessage(page.schedule_exceptions,format(day.date,'yyyy-MM-dd'));return <td {...props} title={message||undefined} onMouseEnter={()=>setNotice(message)} onPointerDown={()=>setNotice(message)}/>;}}}/>{notice&&<p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}</>;
}