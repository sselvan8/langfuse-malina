import { TRPCError } from "@trpc/server";

/**
 * Check if user has the Azure AD OrgCreator app role.
 * Members of the malina-admins Azure AD group are assigned this role,
 * which is included as a `roles` claim in the ID token.
 */
export function checkCustomOrgCreatorWhitelist(azureRoles?: string[]): void {
  if (!azureRoles || azureRoles.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Your account is not authorized to create organizations. Please contact your administrator.",
    });
  }
}

/**
 * Returns true if the user has been assigned the OrgCreator Azure AD app role.
 * Used in the UI to conditionally show/hide the create organization button and org dashboard.
 */
export function isEmailInCustomOrgCreatorWhitelist(
  azureRoles?: string[]
): boolean {
  return (azureRoles?.length ?? 0) > 0;
}
