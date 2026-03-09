import { z } from "zod";

export const keySchema = z
  .string()
  .regex(/^[A-G](#)? (major|minor)$/i, "Key must be in the format 'C major' or 'C# minor'");

export const licensePriceSchema = z.object({
  licenseId: z.string().min(1, "License ID is required"),
  licenseGid: z.string().min(1, "License reference is required"),
  price: z.number().min(0.01, "Price must be greater than 0"),
});

export const beatUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  bpm: z.number().int().min(60, "BPM must be at least 60").max(200, "BPM must be 200 or less"),
  key: keySchema,
  genreGids: z.array(z.string().min(1)).min(1, "At least one genre is required"),
  producerGids: z.array(z.string().min(1)).min(1, "At least one producer is required"),
  licensePrices: z.array(licensePriceSchema).min(1, "At least one license price is required"),
});

const fileSchema = z.instanceof(File, { message: "Invalid file upload" });

export const fileUploadSchema = z.object({
  previewFile: fileSchema,
  mp3File: fileSchema.optional(),
  stemsFile: fileSchema.optional(),
  coverArtFile: fileSchema.optional(),
});

export type BeatUploadInput = z.infer<typeof beatUploadSchema>;
export type LicensePriceInput = z.infer<typeof licensePriceSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
