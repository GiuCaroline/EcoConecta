import { z } from "zod";
import { ApiError } from "./errors.js";
export const MATERIAL_IDS = [
  "paper",
  "plastic",
  "glass",
  "metal",
  "electronic",
  "oil",
];
export const roles = ["resident", "driver", "point"];
const text = (min, max) => z.string().trim().min(min).max(max);
export const idSchema = z.string().uuid();
export const materialArray = z
  .array(z.enum(MATERIAL_IDS))
  .min(1)
  .max(6)
  .refine((ids) => new Set(ids).size === ids.length, "Não repita materiais.");
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Senha deve ter até 72 bytes.",
  );
const phone = text(0, 30).refine(
  (v) =>
    !v || (/^\+?[\d\s()\-]+$/.test(v) && v.replace(/\D/g, "").length >= 10),
  "Telefone precisa de DDD.",
);
export const registerSchema = z
  .object({
    name: text(2, 120),
    email,
    password,
    role: z.enum(roles),
    phone: phone.default(""),
    address: text(0, 500).default(""),
  })
  .strict();
export const loginSchema = z
  .object({
    email,
    password: z
      .string()
      .min(1)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Senha deve ter até 72 bytes.",
      ),
  })
  .strict();
export const profileSchema = z
  .object({
    name: text(2, 120).optional(),
    phone: phone.optional(),
    address: text(0, 500).optional(),
    vehicle: text(0, 100).optional(),
    plate: text(0, 20).optional(),
    online: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Informe uma alteração.");
export const pointSchema = z
  .object({
    name: text(2, 150),
    address: text(10, 500),
    phone: phone.refine((v) => !!v, "Informe telefone."),
    hours: text(2, 200),
    description: text(2, 2000),
    materials: materialArray,
    active: z.boolean().default(true),
  })
  .strict();
export const pointPatchSchema = pointSchema
  .omit({ active: true })
  .partial()
  .extend({ active: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Informe uma alteração.");
const quantity = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^\d+(?:[.,]\d{1,2})?$/)
      .transform((v) => Number(v.replace(",", "."))),
  ])
  .pipe(
    z
      .number()
      .positive()
      .max(100000)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
        "Use até duas casas decimais.",
      ),
  );
export const requestSchema = z
  .object({
    pointId: idSchema,
    materials: materialArray,
    quantity,
    date: text(10, 10),
    period: z.enum(["Manhã · 08h–12h", "Tarde · 13h–18h"]),
    address: text(10, 500),
    notes: text(0, 2000).default(""),
  })
  .strict();
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new ApiError(
      400,
      "VALIDATION_ERROR",
      "Revise os campos enviados.",
    );
    error.fields = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw error;
  }
  return result.data;
}
export function todayIn(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (key) => parts.find((p) => p.type === key).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function pickupDate(value, timeZone) {
  let iso = value;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
    throw new ApiError(400, "INVALID_DATE", "Use DD/MM/AAAA ou AAAA-MM-DD.");
  const d = new Date(`${iso}T12:00:00Z`);
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== iso ||
    iso < todayIn(timeZone)
  )
    throw new ApiError(
      400,
      "INVALID_DATE",
      "Informe uma data válida de hoje em diante.",
    );
  return iso;
}
