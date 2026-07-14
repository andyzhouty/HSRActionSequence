import guideData from "./guide.json";

export type CharacterGuide = {
	intro: string;
	sections: Array<{ title: string; items: string[] }>;
};

/**
 * 指南文本保存在 guide.json，方便不改动页面逻辑即可维护。
 * 本文件只提供 TypeScript 类型与统一导出。
 */
export const characterGuides = guideData as Record<string, CharacterGuide>;
