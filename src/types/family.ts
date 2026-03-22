import { z } from "zod";

export type Gender = "L" | "P";
export type RelationshipType = "partner" | "parent_child" | "spouse" | "sibling";

export interface Person {
  id: string;
  full_name: string;
  gender: Gender;
  phone_number: string | null;
  birth_date: string | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  source_person_id: string;
  target_person_id: string;
  created_at: string;
  order?: number;
}

export const personSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Nama lengkap minimal 2 karakter" })
    .max(100, { message: "Nama maksimal 100 karakter" }),
  gender: z.enum(["L", "P"], { required_error: "Jenis kelamin wajib dipilih" }),
  phone_number: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^(\+?62|0)[0-9]{8,13}$/.test(val.replace(/[\s-]/g, "")),
      { message: "Format nomor HP tidak valid" }
    ),
  birth_date: z.string().optional(),
});

export type PersonFormData = z.infer<typeof personSchema>;
