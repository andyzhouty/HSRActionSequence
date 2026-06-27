import type React from "react";
import html2canvas from "html2canvas";
import { useMemo, useRef, useState } from "react";

type CharacterConfig = {
  id: string;
  kind: TargetKind;
  name: string;
  speed: string;
  hasVonwacq: boolean;
  hasWindSet: boolean;
  hasDance: boolean;
  ultCycle: string;
  ultOffset: string;
};

type GeneratedAction = {
  key: string;
  characterId: string;
  actionNo: number;
  actionValue: number;
  isUltimateAction: boolean;
};

type SavedData = {
  limitPreset: string;
  customLimit: string;
  characters: CharacterConfig[];
  resources: string[];
  overrides: Record<string, string>;
  ultOverrides: Record<string, boolean>;
  resourceValues: Record<string, Record<string, string>>;
};

type TargetKind = "角色" | "忆灵" | "非忆灵" | "敌人";

const targetKinds: TargetKind[] = ["角色", "忆灵", "非忆灵", "敌人"];

function isCharacterTarget(character: CharacterConfig) {
  return character.kind === "角色";
}

function isEnemyTarget(kind: TargetKind | undefined) {
  return kind === "敌人";
}

function canBeAdvancedByDance(character: CharacterConfig) {
  return character.kind === "角色" || character.kind === "忆灵";
}

function getTargetDefaultName(kind: TargetKind, index: number) {
  if (kind === "非忆灵") return `召唤物 ${index + 1}`;
  return `${kind} ${index + 1}`;
}

function createTarget(id: string, index: number, kind: TargetKind = "角色") {
  return {
    id,
    kind,
    name: getTargetDefaultName(kind, index),
    speed: "",
    hasVonwacq: false,
    hasWindSet: false,
    hasDance: false,
    ultCycle: "",
    ultOffset: "",
  };
}

function withoutCharacterOnlyEffects(character: CharacterConfig): CharacterConfig {
  if (isCharacterTarget(character)) return character;
  return {
    ...character,
    hasVonwacq: false,
    hasWindSet: false,
    hasDance: false,
    ultCycle: "",
    ultOffset: "",
  };
}

const defaultCharacters: CharacterConfig[] = Array.from({ length: 4 }, (_, index) =>
  createTarget(`c${index + 1}`, index),
);

const limitPresets = ["150", "300", "500", "自定义"];
const maxResources = 5;

function toPositiveNumber(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeNumber(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toPositiveInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatActionValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function isUltimateAction(character: CharacterConfig, actionNo: number) {
  if (!isCharacterTarget(character)) return false;
  const cycle = toPositiveInteger(character.ultCycle);
  const offset = toPositiveInteger(character.ultOffset, cycle);
  if (cycle === 0 || offset === 0 || actionNo < offset) return false;
  return (actionNo - offset) % cycle === 0;
}

function simulateActions(
  characters: CharacterConfig[],
  limit: number,
  overrides: Record<string, string>,
  ultOverrides: Record<string, boolean>,
) {
  const activeCharacters = characters.filter(
    (character) => toPositiveNumber(character.speed) > 0,
  );

  const states = activeCharacters.map((character) => {
    const speed = toPositiveNumber(character.speed);
    return {
      character,
      actionNo: 1,
      nextActionValue:
        (isCharacterTarget(character) && character.hasVonwacq ? 6000 : 10000) /
        speed,
    };
  });

  const actions: GeneratedAction[] = [];
  let guard = 0;

  while (states.length > 0 && guard < 400) {
    guard += 1;
    const candidates = states.map((state) => {
      const key = `${state.character.id}-${state.actionNo}`;
      return {
        state,
        key,
        actionValue: toNonNegativeNumber(overrides[key], state.nextActionValue),
      };
    });

    candidates.sort((a, b) => {
      if (a.actionValue !== b.actionValue) return a.actionValue - b.actionValue;
      return a.state.character.id.localeCompare(b.state.character.id);
    });

    const next = candidates[0];
    if (!next || next.actionValue > limit) break;

    const { state } = next;
    const { character } = state;
    const speed = toPositiveNumber(character.speed);
    const actionNo = state.actionNo;
    const defaultUltimateAction = isUltimateAction(character, actionNo);
    const ultimateAction =
      isCharacterTarget(character) && ultOverrides[next.key] !== undefined
        ? ultOverrides[next.key]
        : defaultUltimateAction;

    actions.push({
      key: next.key,
      characterId: character.id,
      actionNo,
      actionValue: next.actionValue,
      isUltimateAction: ultimateAction,
    });

    const nextInterval =
      isCharacterTarget(character) && character.hasWindSet && ultimateAction
        ? 7500 / speed
        : 10000 / speed;
    state.actionNo += 1;
    state.nextActionValue = next.actionValue + nextInterval;

    if (isCharacterTarget(character) && character.hasDance && ultimateAction) {
      const advance = 2400 / speed;
      for (const teammate of states) {
        if (!canBeAdvancedByDance(teammate.character)) continue;
        teammate.nextActionValue = Math.max(
          next.actionValue,
          teammate.nextActionValue - advance,
        );
      }
    }
  }

  return actions;
}

function NumberInput({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "请输入",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
            onChange(nextValue);
          }
        }}
        className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
        checked
          ? "border-blue-500/50 bg-blue-900/40 text-blue-100"
          : "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

export default function ActionSequence() {
  const [characters, setCharacters] =
    useState<CharacterConfig[]>(defaultCharacters);
  const [limitPreset, setLimitPreset] = useState("150");
  const [customLimit, setCustomLimit] = useState("");
  const [resources, setResources] = useState<string[]>(["战技点"]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [ultOverrides, setUltOverrides] = useState<Record<string, boolean>>({});
  const [resourceValues, setResourceValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [isExportingImage, setIsExportingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageExportRef = useRef<HTMLDivElement>(null);

  const actionLimit = useMemo(() => {
    if (limitPreset === "自定义") {
      return toPositiveNumber(customLimit, 150);
    }
    return toPositiveNumber(limitPreset, 150);
  }, [customLimit, limitPreset]);

  const actions = useMemo(
    () => simulateActions(characters, actionLimit, overrides, ultOverrides),
    [characters, actionLimit, overrides, ultOverrides],
  );
  const characterNames = useMemo(
    () =>
      Object.fromEntries(
        characters.map((character, index) => [
          character.id,
          character.name.trim() ||
            getTargetDefaultName(character.kind, index),
        ]),
      ),
    [characters],
  );
  const characterKinds = useMemo(
    () =>
      Object.fromEntries(
        characters.map((character) => [character.id, character.kind]),
      ),
    [characters],
  );

  const updateCharacter = (
    id: string,
    updater: (character: CharacterConfig) => CharacterConfig,
  ) => {
    setCharacters((prev) =>
      prev.map((character) =>
        character.id === id ? updater(character) : character,
      ),
    );
  };

  const addTarget = () => {
    setCharacters((prev) => [
      ...prev,
      createTarget(`target-${Date.now()}`, prev.length),
    ]);
  };

  const removeTarget = (id: string) => {
    if (characters.length <= 1) return;
    setCharacters((prev) =>
      prev.length <= 1 ? prev : prev.filter((character) => character.id !== id),
    );
    setOverrides((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([actionKey]) => !actionKey.startsWith(`${id}-`)),
      ),
    );
    setUltOverrides((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(
          ([actionKey]) => !actionKey.startsWith(`${id}-`),
        ),
      ),
    );
    setResourceValues((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(
          ([actionKey]) => !actionKey.startsWith(`${id}-`),
        ),
      ),
    );
  };

  const updateResourceValue = (
    actionKey: string,
    resourceName: string,
    value: string,
  ) => {
    setResourceValues((prev) => ({
      ...prev,
      [actionKey]: {
        ...(prev[actionKey] ?? {}),
        [resourceName]: value,
      },
    }));
  };

  const toggleUltimateOverride = (action: GeneratedAction) => {
    if (characterKinds[action.characterId] !== "角色") return;
    setUltOverrides((prev) => ({
      ...prev,
      [action.key]: !action.isUltimateAction,
    }));
  };

  const addResource = () => {
    if (resources.length >= maxResources) return;
    setResources((prev) => [...prev, `资源 ${prev.length + 1}`]);
  };

  const updateResource = (index: number, value: string) => {
    setResources((prev) =>
      prev.map((resource, resourceIndex) =>
        resourceIndex === index ? value : resource,
      ),
    );
  };

  const removeResource = (index: number) => {
    const removedName = resources[index];
    setResources((prev) =>
      prev.filter((_, resourceIndex) => resourceIndex !== index),
    );
    setResourceValues((prev) => {
      const next = { ...prev };
      for (const actionKey of Object.keys(next)) {
        const values = { ...next[actionKey] };
        delete values[removedName];
        next[actionKey] = values;
      }
      return next;
    });
  };

  const buildExportData = (): SavedData => ({
    limitPreset,
    customLimit,
    characters: characters.map(withoutCharacterOnlyEffects),
    resources,
    overrides,
    ultOverrides,
    resourceValues,
  });

  const exportJson = () => {
    const json = JSON.stringify(buildExportData(), null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `action-sequence-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportText(json);
    setMessage("已导出 JSON 文件。");
  };

  const exportImage = async () => {
    if (!imageExportRef.current) return;

    try {
      setIsExportingImage(true);
      setMessage("正在生成行动序列图片...");

      const target = imageExportRef.current;
      const exportPadding = 32;
      const canvas = await html2canvas(target, {
        backgroundColor: "#1f2937",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        width: target.scrollWidth,
        height: target.scrollHeight + exportPadding,
        windowWidth: Math.max(
          document.documentElement.clientWidth,
          target.scrollWidth,
        ),
        windowHeight: Math.max(
          document.documentElement.clientHeight,
          target.scrollHeight + exportPadding,
        ),
        onclone: (_clonedDocument, clonedElement) => {
          clonedElement.style.boxSizing = "border-box";
          clonedElement.style.paddingBottom = `${exportPadding}px`;
          clonedElement.querySelectorAll("input").forEach((input) => {
            const replacement = document.createElement("div");
            const inputElement = input as HTMLInputElement;
            const isActionValue = inputElement.classList.contains("font-mono");
            replacement.textContent = inputElement.value;
            replacement.style.alignItems = "center";
            replacement.style.backgroundColor = "#374151";
            replacement.style.border = "1px solid #4b5563";
            replacement.style.borderRadius = "0.5rem";
            replacement.style.boxSizing = "border-box";
            replacement.style.color = "#ffffff";
            replacement.style.display = "flex";
            replacement.style.fontFamily = isActionValue
              ? '"Inconsolata Nerd Font", monospace'
              : "inherit";
            replacement.style.height = "40px";
            replacement.style.lineHeight = "1";
            replacement.style.padding = "0 12px";
            replacement.style.whiteSpace = "nowrap";
            replacement.style.width = isActionValue ? "112px" : "100%";
            inputElement.replaceWith(replacement);
          });
        },
      });

      const link = document.createElement("a");
      link.download = `action-sequence-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setMessage("已导出行动序列图片。");
    } catch {
      setMessage("图片导出失败，请稍后再试。");
    } finally {
      setIsExportingImage(false);
    }
  };

  const importJson = (rawText = importText) => {
    try {
      const parsed = JSON.parse(rawText) as Partial<SavedData>;
      if (!Array.isArray(parsed.characters)) {
        throw new Error("characters 缺失");
      }

      setCharacters(
        parsed.characters.map((character) =>
          withoutCharacterOnlyEffects(character),
        ),
      );
      setLimitPreset(
        parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
          ? parsed.limitPreset
          : "150",
      );
      setCustomLimit(String(parsed.customLimit ?? ""));
      setResources(
        Array.isArray(parsed.resources)
          ? parsed.resources.slice(0, maxResources).map(String)
          : [],
      );
      setOverrides(parsed.overrides ?? {});
      setUltOverrides(parsed.ultOverrides ?? {});
      setResourceValues(parsed.resourceValues ?? {});
      setMessage("导入成功。");
    } catch {
      setMessage("导入失败，请检查 JSON 格式。");
    }
  };

  const importFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImportText(text);
      importJson(text);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 rounded-2xl bg-gray-800 p-6 shadow">
        <h2 className="mb-2 text-2xl font-bold text-white">行动排轴器</h2>
        <p className="text-gray-300">
          星穹铁道行动值序列工具，支持翁瓦克、风套、舞舞舞、手动行动值和资源备注。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-4">
          {characters.map((character, index) => (
              <div
                key={character.id}
                className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow"
              >
                <div className="mb-4 grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                  <select
                    value={character.kind}
                    onChange={(event) =>
                      updateCharacter(character.id, (prev) =>
                        {
                          const nextKind = event.target.value as TargetKind;
                          const previousDefaultName = getTargetDefaultName(
                            prev.kind,
                            index,
                          );
                          const shouldUseNextDefaultName =
                            prev.name.trim() === "" ||
                            prev.name.trim() === previousDefaultName;

                          return withoutCharacterOnlyEffects({
                            ...prev,
                            kind: nextKind,
                            name: shouldUseNextDefaultName
                              ? getTargetDefaultName(nextKind, index)
                              : prev.name,
                          });
                        }
                      )
                    }
                    className="h-10 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {targetKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                  <TextInput
                    value={character.name}
                    placeholder={getTargetDefaultName(character.kind, index)}
                    onChange={(value) =>
                      updateCharacter(character.id, (prev) => ({
                        ...prev,
                        name: value,
                      }))
                    }
                  />
                </div>

                <div
                  className={`grid gap-3 ${
                    isCharacterTarget(character) ? "grid-cols-3" : "grid-cols-1"
                  }`}
                >
                  <NumberInput
                    label="速度 v"
                    value={character.speed}
                    onChange={(value) =>
                      updateCharacter(character.id, (prev) => ({
                        ...prev,
                        speed: value,
                      }))
                    }
                  />
                  {isCharacterTarget(character) && (
                    <>
                      <NumberInput
                        label="X 动一大"
                        value={character.ultCycle}
                        onChange={(value) =>
                          updateCharacter(character.id, (prev) => ({
                            ...prev,
                            ultCycle: value,
                          }))
                        }
                      />
                      <NumberInput
                        label="第 K 动开大"
                        value={character.ultOffset}
                        onChange={(value) =>
                          updateCharacter(character.id, (prev) => ({
                            ...prev,
                            ultOffset: value,
                          }))
                        }
                      />
                    </>
                  )}
                </div>

                {isCharacterTarget(character) && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Toggle
                      label="翁瓦克"
                      checked={character.hasVonwacq}
                      onChange={() =>
                        updateCharacter(character.id, (prev) => ({
                          ...prev,
                          hasVonwacq: !prev.hasVonwacq,
                        }))
                      }
                    />
                    <Toggle
                      label="风套"
                      checked={character.hasWindSet}
                      onChange={() =>
                        updateCharacter(character.id, (prev) => ({
                          ...prev,
                          hasWindSet: !prev.hasWindSet,
                        }))
                      }
                    />
                    <Toggle
                      label="舞舞舞"
                      checked={character.hasDance}
                      onChange={() =>
                        updateCharacter(character.id, (prev) => ({
                          ...prev,
                          hasDance: !prev.hasDance,
                        }))
                      }
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeTarget(character.id)}
                  disabled={characters.length <= 1}
                  className="mt-3 h-10 w-full rounded-lg border border-red-500/40 text-sm font-medium text-red-200 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent"
                >
                  删除目标
                </button>
              </div>
          ))}
          <button
            type="button"
            onClick={addTarget}
            className="h-11 w-full rounded-xl border border-blue-500/40 bg-blue-950/30 font-medium text-blue-100 hover:bg-blue-900/40"
          >
            添加场上目标
          </button>
        </section>

        <section className="min-w-0 rounded-2xl bg-gray-800 p-5 shadow">
          <div className="mb-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <label className="mb-2 block h-5 text-sm leading-5 text-gray-300">
                行动值上限
              </label>
              <div className="flex gap-2">
                <select
                  value={limitPreset}
                  onChange={(event) => setLimitPreset(event.target.value)}
                  className="h-10 w-32 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {limitPresets.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customLimit}
                  disabled={limitPreset !== "自定义"}
                  placeholder="自定义"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
                      setCustomLimit(nextValue);
                    }
                  }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex h-5 items-center gap-3">
                <span className="text-sm leading-5 text-gray-300">资源列</span>
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_112px]">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2">
                  {resources.map((resource, index) => (
                    <div
                      key={`resource-editor-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_64px] gap-2"
                    >
                      <TextInput
                        value={resource}
                        placeholder="资源名称"
                        onChange={(value) => updateResource(index, value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeResource(index)}
                        className="h-10 rounded-lg border border-gray-600 px-3 text-gray-300 hover:bg-gray-700"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addResource}
                  disabled={resources.length >= maxResources}
                  className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                  添加资源
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">行动序列</h3>
              <p className="text-sm text-gray-400">
                当前上限 {formatActionValue(actionLimit)}，共 {actions.length} 条行动。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void exportImage()}
              disabled={isExportingImage}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {isExportingImage ? "生成中..." : "导出图片"}
            </button>
          </div>

          <div
            ref={imageExportRef}
            className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800 pb-4"
          >
            <div className="bg-gray-800">
              <div className="border-b border-gray-700 bg-gray-900/60 px-4 py-3">
                <h3 className="text-lg font-semibold text-white">行动序列</h3>
                <p className="text-sm text-gray-400">
                  行动值上限 {formatActionValue(actionLimit)} / 行动数{" "}
                  {actions.length}
                </p>
              </div>
              <table className="w-full table-auto divide-y divide-gray-700 text-left text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[1%]" />
                  <col className="w-28" />
                  <col className="w-16" />
                  {resources.map((_, index) => (
                    <col key={`resource-col-${index}`} />
                  ))}
                </colgroup>
                <thead className="bg-gray-900/60 text-gray-300">
                  <tr>
                    <th className="w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 font-semibold">
                      序号
                    </th>
                    <th className="w-[1%] whitespace-nowrap px-3 py-3 font-semibold">
                      角色
                    </th>
                    <th className="whitespace-nowrap px-2 py-3 font-semibold">
                      行动值
                    </th>
                    <th className="whitespace-nowrap px-2 py-3 font-semibold">
                      大招
                    </th>
                    {resources.map((resource, index) => (
                      <th
                        key={`resource-header-${index}`}
                        className="truncate whitespace-nowrap px-2 py-3 font-semibold"
                        title={resource || `资源 ${index + 1}`}
                      >
                        {resource || `资源 ${index + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {actions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4 + resources.length}
                        className="px-4 py-10 text-center text-gray-400"
                      >
                        请至少填写一个有效速度。
                      </td>
                    </tr>
                  ) : (
                    actions.map((action, index) => {
                      const isEnemyAction = isEnemyTarget(
                        characterKinds[action.characterId],
                      );

                      return (
                        <tr
                          key={action.key}
                          className={
                            isEnemyAction
                              ? "bg-red-950/40 hover:bg-red-950/50"
                              : "hover:bg-gray-700/30"
                          }
                        >
                          <td
                            className={`w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 ${
                              isEnemyAction ? "text-red-100" : "text-gray-400"
                            }`}
                          >
                            {index + 1}
                          </td>
                          <td className="w-[1%] max-w-32 whitespace-nowrap px-3 py-3">
                            <div
                              className="truncate font-medium text-white"
                              title={characterNames[action.characterId]}
                            >
                              {characterNames[action.characterId]}
                            </div>
                            <div
                              className={`truncate text-xs ${
                                isEnemyAction ? "text-red-200/80" : "text-gray-400"
                              }`}
                            >
                              第 {action.actionNo} 动
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                overrides[action.key] ??
                                formatActionValue(action.actionValue)
                              }
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                if (
                                  nextValue === "" ||
                                  /^\d*\.?\d*$/.test(nextValue)
                                ) {
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [action.key]: nextValue,
                                  }));
                                }
                              }}
                              className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-2 font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={action.isUltimateAction}
                              disabled={characterKinds[action.characterId] !== "角色"}
                              onClick={() => toggleUltimateOverride(action)}
                              className={`h-10 w-full rounded-lg border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                                action.isUltimateAction
                                  ? "border-amber-400/60 bg-amber-500/20 text-amber-100"
                                  : "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {action.isUltimateAction ? "开" : "关"}
                            </button>
                          </td>
                          {resources.map((resource, resourceIndex) => (
                            <td
                              key={`${action.key}-resource-${resourceIndex}`}
                              className="px-2 py-3"
                            >
                              <input
                                type="text"
                                value={
                                  resourceValues[action.key]?.[resource] ?? ""
                                }
                                onChange={(event) =>
                                  updateResourceValue(
                                    action.key,
                                    resource,
                                    event.target.value,
                                  )
                                }
                                className="h-10 w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="JSON 导入 / 导出内容"
              className="min-h-32 rounded-xl border border-gray-600 bg-gray-700 p-3 font-mono text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={exportJson}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
              >
                导出 JSON
              </button>
              <button
                type="button"
                onClick={() => importJson()}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
              >
                导入 JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-600 px-4 py-2 font-medium text-gray-200 hover:bg-gray-700"
              >
                从文件导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={importFromFile}
                className="hidden"
              />
              {message && <p className="text-sm text-gray-300">{message}</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
