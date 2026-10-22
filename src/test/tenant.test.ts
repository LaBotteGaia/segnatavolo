import { describe, expect, it, vi, beforeEach } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { activeRestaurantId, EMPTY_RESTAURANT_ID, scopeRestaurant } from "@/lib/tenant";
import { clearAssist, setAssist } from "@/lib/assist";

describe("isolamento operativo ristoranti", () => {
  beforeEach(() => { clearAssist(); rpc.mockReset(); });
  it("filtra sempre il ristorante ordinario anche senza assistenza", async () => {
    rpc.mockResolvedValue({ data: "ristorante-proprio", error: null });
    const eq = vi.fn();
    scopeRestaurant({ eq }, await activeRestaurantId());
    expect(eq).toHaveBeenCalledWith("restaurant_id", "ristorante-proprio");
    expect(rpc).toHaveBeenCalledWith("my_restaurant_id");
  });
  it("in assistenza filtra esclusivamente il locale scelto", async () => {
    setAssist({ id: "ristorante-assistito", name: "Locale test" });
    const eq = vi.fn();
    scopeRestaurant({ eq }, await activeRestaurantId());
    expect(eq).toHaveBeenCalledWith("restaurant_id", "ristorante-assistito");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("senza locale non esegue una lettura globale", () => {
    const eq = vi.fn();
    scopeRestaurant({ eq }, null);
    expect(eq).toHaveBeenCalledWith("restaurant_id", EMPTY_RESTAURANT_ID);
  });
  it("l'uscita dall'assistenza ripristina il proprio locale", async () => {
    setAssist({ id: "altro", name: "Altro" });
    clearAssist();
    rpc.mockResolvedValue({ data: "proprio", error: null });
    expect(await activeRestaurantId()).toBe("proprio");
  });
});