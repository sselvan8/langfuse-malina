import { env } from "@/src/env.mjs";
import { TRPCError } from "@trpc/server";

// Parse the custom whitelist from environment
const CUSTOM_ORG_CREATOR_WHITELIST = process.env.CUSTOM_ORG_CREATOR_WHITELIST
  ? process.env.CUSTOM_ORG_CREATOR_WHITELIST.toLowerCase()
      .split(",")
      .map((email) => email.trim())
  : null;

/**
 * Check if user email is in custom organization creator whitelist
 * This is a custom addition on top of the existing canCreateOrganizations permission
 */
export function checkCustomOrgCreatorWhitelist(userEmail: string | null): void {
  // If no custom whitelist is set, allow (rely on existing canCreateOrganizations)
  if (!CUSTOM_ORG_CREATOR_WHITELIST) {
    return;
  }

  // If whitelist is set, enforce it
  if (!userEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email is required to create organizations",
    });
  }

  const emailLower = userEmail.toLowerCase().trim();
  if (!CUSTOM_ORG_CREATOR_WHITELIST.includes(emailLower)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your email is not authorized to create organizations. Please contact your administrator.",
    });
  }
}

/**
 * Check if a user email is allowed to create organizations
 * This is used in the UI to conditionally show/hide the create organization button
 */
export function isEmailInCustomOrgCreatorWhitelist(
  userEmail: string | null
): boolean {
  // If no custom whitelist is set, allow (rely on existing canCreateOrganizations)
  if (!CUSTOM_ORG_CREATOR_WHITELIST) {
    return true;
  }

  if (!userEmail) {
    return false;
  }

  const emailLower = userEmail.toLowerCase().trim();
  return CUSTOM_ORG_CREATOR_WHITELIST.includes(emailLower);
}
