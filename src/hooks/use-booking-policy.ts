import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveRestaurantId } from '@/lib/tenant';
import { bookingPolicySchema, DEFAULT_BOOKING_POLICY } from '@/lib/booking-policy';

export function useBookingPolicy() {
  const id = useActiveRestaurantId();
  const query = useQuery({ queryKey: ['booking-policy', id], enabled: !!id, queryFn: async () => {
    if (!id) return DEFAULT_BOOKING_POLICY;
    const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
    if (error) throw error;
    return bookingPolicySchema.parse(data);
  } });
  return query.data ?? DEFAULT_BOOKING_POLICY;
}