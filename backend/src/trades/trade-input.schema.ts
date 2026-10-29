import { z } from 'zod';

/** Shape accepted by the JSON import and bulk-create endpoints. */
export const tradeInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase()),
  side: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.enum(['BUY', 'SELL'])),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
  fee: z.coerce.number().nonnegative().default(0),
  currency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .default('USD'),
  executedAt: z.coerce.date(),
  note: z.string().max(500).nullish(),
});

export const tradeImportSchema = z.union([
  z.array(tradeInputSchema),
  z.object({ trades: z.array(tradeInputSchema) }).transform((o) => o.trades),
]);

export type TradeInput = z.infer<typeof tradeInputSchema>;
