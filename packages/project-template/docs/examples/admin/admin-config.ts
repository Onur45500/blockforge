/**
 * REFERENCE ONLY — copy into src/shared/admin-config.ts
 * Replace the placeholder UserId with your Roblox user id(s).
 */
export const ADMIN_USER_IDS: number[] = [
	// 123456789,
];

export function isAdmin(userId: number): boolean {
	return ADMIN_USER_IDS.includes(userId);
}
