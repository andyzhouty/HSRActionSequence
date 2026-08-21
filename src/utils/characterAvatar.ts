/** 返回角色头像的公共静态资源路径。 */
export function getCharacterAvatarUrl(
	cid: string | undefined,
): string | undefined {
	if (!cid || !/^\d+$/.test(cid)) return undefined;
	return `${import.meta.env.BASE_URL}favicon/${cid}.webp`;
}
