import { getCharacterCid } from "../data/characters";
import { getCharacterAvatarUrl } from "../utils/characterAvatar";

export function CharacterAvatar({
	name,
	cid,
	alt,
	className,
}: {
	name?: string;
	cid?: string;
	alt?: string;
	className: string;
}) {
	const resolvedCid = cid ?? (name ? getCharacterCid(name) : undefined);
	const src = getCharacterAvatarUrl(resolvedCid);
	if (!src) return null;

	return (
		<img
			src={src}
			alt={alt ?? name ?? "角色头像"}
			className={`rounded-full border border-gray-500/70 object-cover ${className}`}
			loading="lazy"
		/>
	);
}
