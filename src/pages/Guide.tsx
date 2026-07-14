import { useMemo, useState } from "react";
import {
	type CharacterCatalogEntry,
	getCharacterCatalog,
	normalizeName,
} from "../data/characters";
import { characterGuides } from "../data/guide";

const pathLabels: Record<string, string> = {
	Abundance: "丰饶",
	Destruction: "毁灭",
	Elation: "欢愉",
	Erudition: "智识",
	Harmony: "同谐",
	Hunt: "巡猎",
	Nihility: "虚无",
	Preservation: "存护",
	Remembrance: "记忆",
};

const skillCodeRows = [
	["空白 / A", "普攻", "空白技能码按 A 处理；所有角色均可使用。"],
	["E", "战技", "普通战技；部分角色会展开为专属召唤、强化或额外行动。"],
	["Q", "大招", "自身的正常行动大招；也可通过插队菜单施放。"],
	["AQ / EQ", "行动后大招", "先完成 A 或 E，再于同 AV 插入自身 Q。"],
	["QA / QE", "行动前大招", "先于同一次正常行动插入自身 Q，再完成 A 或 E。"],
	["1E–5E", "连续射箭", "仅 Archer；E 等于 1E，最多连续 5 箭。"],
	["F / FF", "助战", "姬子·启行的助战技。"],
	["W", "反击", "仅白厄境界内可用；会触发敌方立即行动。"],
	["EA / EW", "境界连动", "仅2魂白厄境界内可用。"],
	[
		"AA / AE / EA / EE",
		"击破再动",
		"仅流萤 E2 完全燃烧期间触发击破后；正常行动与额外行动均可为 A 或 E。",
	],
	["ES", "欢愉技", "系统自动生成，不可编辑。"],
	["Z", "追击", "系统或右键设置生成，不可编辑。"],
	["T", "秘技攻击", "部分角色开启秘技后自动生成，不可编辑。"],
] as const;

function CharacterResult({
	character,
	selected,
	onSelect,
}: {
	character: CharacterCatalogEntry;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`w-full rounded-lg border px-3 py-2 text-left transition ${selected ? "border-blue-400 bg-blue-950/70 text-white" : "border-gray-700 bg-gray-800 text-gray-200 hover:border-gray-500"}`}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="font-bold">{character.names[0]}</span>
				<span className="text-xs text-gray-400">
					{pathLabels[character.path ?? ""] ?? character.path ?? ""}
				</span>
			</div>
			<div className="mt-1 truncate text-xs text-gray-400">
				{character.names.slice(1).join("、") || "无别名"}
			</div>
		</button>
	);
}

export default function Guide({ onBack }: { onBack: () => void }) {
	const [query, setQuery] = useState("");
	const [selectedCid, setSelectedCid] = useState("1401");
	const catalog = useMemo(() => getCharacterCatalog(), []);
	const results = useMemo(() => {
		const normalizedQuery = normalizeName(query);
		const candidates = normalizedQuery
			? catalog.filter((character) =>
					character.names.some((name) =>
						normalizeName(name).includes(normalizedQuery),
					),
				)
			: catalog.filter(
					(character) => characterGuides[character.cid] !== undefined,
				);
		return candidates.sort((a, b) =>
			a.names[0].localeCompare(b.names[0], "zh-CN"),
		);
	}, [catalog, query]);
	const selected =
		results.find((character) => character.cid === selectedCid) ?? results[0];
	const guide = selected ? characterGuides[selected.cid] : undefined;

	return (
		<main className="mx-auto min-h-screen max-w-6xl px-3 py-4 text-gray-100">
			<header className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gray-800 p-5 shadow">
				<div>
					<h1 className="text-2xl font-bold">使用指南</h1>
					<p className="mt-1 text-sm text-gray-300">
						搜索角色名称或别名，查看该角色在排轴器中的具体操作。
					</p>
				</div>
				<button
					type="button"
					onClick={onBack}
					className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-bold hover:border-blue-400"
				>
					返回排轴器
				</button>
			</header>

			<section className="mb-4 rounded-2xl bg-gray-800 p-5 shadow">
				<h2 className="text-lg font-bold">通用操作</h2>
				<div className="mt-3 grid gap-3 text-sm text-gray-200 md:grid-cols-3">
					<p>
						<b>技能码：</b>A 普攻、E 战技、Q 大招；如 AQ、QE 表示把自身 Q
						插入同一次正常行动的前后。
					</p>
					<p>
						<b>右键与拖拽：</b>右键行动可设置插队、追击或特殊额外回合；同 AV
						的可交换行动会标出拖拽标记。
					</p>
					<p>
						<b>资源与攻击：</b>
						资源列可记录或覆写角色机制资源；【攻击】开关会影响追击与部分联动。
					</p>
				</div>
				<div className="mt-5 overflow-x-auto rounded-xl border border-gray-700">
					<table className="w-full min-w-[44rem] text-left text-sm">
						<caption className="bg-gray-900 px-3 py-2 text-left font-bold text-gray-100">
							技能码速查表
						</caption>
						<thead className="bg-gray-700 text-gray-200">
							<tr>
								<th className="px-3 py-2 font-bold">技能码</th>
								<th className="px-3 py-2 font-bold">含义</th>
								<th className="px-3 py-2 font-bold">使用说明</th>
							</tr>
						</thead>
						<tbody>
							{skillCodeRows.map(([code, meaning, note], index) => (
								<tr
									key={code}
									className={index % 2 === 0 ? "bg-gray-800" : "bg-gray-900/50"}
								>
									<td className="px-3 py-2 font-mono font-bold text-blue-200">
										{code}
									</td>
									<td className="px-3 py-2 text-gray-100">{meaning}</td>
									<td className="px-3 py-2 text-gray-300">{note}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
				<aside className="rounded-2xl bg-gray-800 p-4 shadow">
					<label
						className="block text-sm font-bold"
						htmlFor="guide-character-search"
					>
						搜索角色
					</label>
					<input
						id="guide-character-search"
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="例如：红A、The Herta、白厄"
						className="mt-2 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
					/>
					<div
						className="guide-character-scroll mt-3 max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto pr-1"
						aria-live="polite"
					>
						{results.map((character) => (
							<CharacterResult
								key={character.cid}
								character={character}
								selected={character.cid === selected?.cid}
								onSelect={() => setSelectedCid(character.cid)}
							/>
						))}
						{results.length === 0 && (
							<p className="rounded-lg border border-dashed border-gray-600 p-3 text-sm text-gray-400">
								没有匹配角色。可尝试中文名、英文名或别名。
							</p>
						)}
					</div>
				</aside>

				<section className="min-h-72 rounded-2xl bg-gray-800 p-5 shadow">
					{selected ? (
						<>
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h2 className="text-xl font-bold">{selected.names[0]}</h2>
								<span className="text-sm text-blue-200">
									{pathLabels[selected.path ?? ""] ?? selected.path}
								</span>
								{selected.baseSpeed !== undefined && (
									<span className="rounded-full border border-gray-600 bg-gray-900 px-2 py-0.5 text-xs text-gray-200">
										基础速度 {selected.baseSpeed}
									</span>
								)}
							</div>
							<p className="mt-3 text-gray-200">
								{guide?.intro ??
									"该角色暂未收录专属排轴规则，可按 A（普攻）、E（战技）、Q（大招）输入，并参考通用操作。"}
							</p>
							{guide?.sections.map((section) => (
								<section key={section.title} className="mt-5">
									<h3 className="font-bold text-blue-200">{section.title}</h3>
									<ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-gray-200">
										{section.items.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								</section>
							))}
						</>
					) : (
						<p className="text-gray-400">请选择一个角色查看说明。</p>
					)}
				</section>
			</div>
		</main>
	);
}
