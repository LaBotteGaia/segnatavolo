import { CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
export function FieldHelp({ children }: { children: string }) {
  return <p className="mt-1 flex items-start gap-1 text-xs font-normal text-muted-foreground"><TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="shrink-0"><CircleHelp className="size-3.5" /></span></TooltipTrigger><TooltipContent className="max-w-xs">{children}</TooltipContent></Tooltip></TooltipProvider><span>{children}</span></p>;
}