import { z } from "zod";

const nullableString = z.string().trim().max(2000).nullable();

export const licenceSchema = z.object({
  fullName: nullableString,
  licenceNumber: nullableString,
  dateOfBirth: nullableString,
  dateOfIssue: nullableString,
  dateOfExpiry: nullableString,
  address: nullableString,
  vehicleClasses: z.array(z.string().trim().max(100)).max(30),
  issuingAuthority: nullableString,
  otherInformation: z.array(z.string().trim().max(500)).max(30)
}).strict();

export const reviewedLicenceSchema = licenceSchema.extend({
  fullName: z.string().trim().max(200).nullable(),
  licenceNumber: z.string().trim().max(200).nullable(),
  dateOfBirth: z.string().trim().max(50).nullable(),
  dateOfIssue: z.string().trim().max(50).nullable(),
  dateOfExpiry: z.string().trim().max(50).nullable(),
  address: z.string().trim().max(1000).nullable(),
  issuingAuthority: z.string().trim().max(300).nullable()
});
