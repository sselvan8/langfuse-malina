/**
 * Returns true if the user has been assigned the OrgCreator Azure AD app role.
 * Members of the malina-admins Azure AD group are assigned this role, which is
 * included as a `roles` claim in the ID token on sign-in and stored in the JWT.
 * Used in auth.ts to set canCreateOrganizations and canViewOrgDashboard on the session.
 */
export function isEmailInCustomOrgCreatorWhitelist(
  azureRoles?: string[]
): boolean {
  return (azureRoles?.length ?? 0) > 0;
}
