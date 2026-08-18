/*
 _       __      _ __
| |     / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    w: number;
    h: number;
}

export interface Screen {
    isCurrent: boolean;
    isPrimary: boolean;
    width : number
    height : number
}

// 平台、构建类型等环境信息……
export interface EnvironmentInfo {
    buildType: string;
    platform: string;
    arch: string;
}

// [EventsEmit](https://wails.io/docs/reference/runtime/events#eventsemit)
// 发送指定事件，可随事件传递可选数据。
// 这会触发所有事件监听器。
export function EventsEmit(eventName: string, ...data: any): void;

// [EventsOn](https://wails.io/docs/reference/runtime/events#eventson) 为指定事件名设置监听器。
export function EventsOn(eventName: string, callback: (...data: any) => void): () => void;

// [EventsOnMultiple](https://wails.io/docs/reference/runtime/events#eventsonmultiple)
// 为指定事件名设置监听器，但最多只触发指定次数。
export function EventsOnMultiple(eventName: string, callback: (...data: any) => void, maxCallbacks: number): () => void;

// [EventsOnce](https://wails.io/docs/reference/runtime/events#eventsonce)
// 为指定事件名设置监听器，但只触发一次。
export function EventsOnce(eventName: string, callback: (...data: any) => void): () => void;

// [EventsOff](https://wails.io/docs/reference/runtime/events#eventsoff)
// 取消指定事件名的监听器。
export function EventsOff(eventName: string, ...additionalEventNames: string[]): void;

// [EventsOffAll](https://wails.io/docs/reference/runtime/events#eventsoffall)
// 取消所有监听器。
export function EventsOffAll(): void;

// [LogPrint](https://wails.io/docs/reference/runtime/log#logprint)
// 将指定消息作为原始消息记录日志。
export function LogPrint(message: string): void;

// [LogTrace](https://wails.io/docs/reference/runtime/log#logtrace)
// 以 `trace` 日志级别记录指定消息。
export function LogTrace(message: string): void;

// [LogDebug](https://wails.io/docs/reference/runtime/log#logdebug)
// 以 `debug` 日志级别记录指定消息。
export function LogDebug(message: string): void;

// [LogError](https://wails.io/docs/reference/runtime/log#logerror)
// 以 `error` 日志级别记录指定消息。
export function LogError(message: string): void;

// [LogFatal](https://wails.io/docs/reference/runtime/log#logfatal)
// 以 `fatal` 日志级别记录指定消息。
// 调用此方法后应用将退出。
export function LogFatal(message: string): void;

// [LogInfo](https://wails.io/docs/reference/runtime/log#loginfo)
// 以 `info` 日志级别记录指定消息。
export function LogInfo(message: string): void;

// [LogWarning](https://wails.io/docs/reference/runtime/log#logwarning)
// 以 `warning` 日志级别记录指定消息。
export function LogWarning(message: string): void;

// [WindowReload](https://wails.io/docs/reference/runtime/window#windowreload)
// 强制主应用和已连接的浏览器重新加载。
export function WindowReload(): void;

// [WindowReloadApp](https://wails.io/docs/reference/runtime/window#windowreloadapp)
// 重新加载应用前端。
export function WindowReloadApp(): void;

// [WindowSetAlwaysOnTop](https://wails.io/docs/reference/runtime/window#windowsetalwaysontop)
// 设置窗口是否始终置顶。
export function WindowSetAlwaysOnTop(b: boolean): void;

// [WindowSetSystemDefaultTheme](https://wails.io/docs/next/reference/runtime/window#windowsetsystemdefaulttheme)
// *仅限 Windows*
// 将窗口主题设置为系统默认主题（深色/浅色）。
export function WindowSetSystemDefaultTheme(): void;

// [WindowSetLightTheme](https://wails.io/docs/next/reference/runtime/window#windowsetlighttheme)
// *仅限 Windows*
// 将窗口设置为浅色主题。
export function WindowSetLightTheme(): void;

// [WindowSetDarkTheme](https://wails.io/docs/next/reference/runtime/window#windowsetdarktheme)
// *仅限 Windows*
// 将窗口设置为深色主题。
export function WindowSetDarkTheme(): void;

// [WindowCenter](https://wails.io/docs/reference/runtime/window#windowcenter)
// 将窗口置于当前所在显示器的中央。
export function WindowCenter(): void;

// [WindowSetTitle](https://wails.io/docs/reference/runtime/window#windowsettitle)
// 设置窗口标题栏文本。
export function WindowSetTitle(title: string): void;

// [WindowFullscreen](https://wails.io/docs/reference/runtime/window#windowfullscreen)
// 将窗口设置为全屏。
export function WindowFullscreen(): void;

// [WindowUnfullscreen](https://wails.io/docs/reference/runtime/window#windowunfullscreen)
// 恢复进入全屏前的窗口尺寸和位置。
export function WindowUnfullscreen(): void;

// [WindowIsFullscreen](https://wails.io/docs/reference/runtime/window#windowisfullscreen)
// 返回窗口状态，即窗口是否处于全屏模式。
export function WindowIsFullscreen(): Promise<boolean>;

// [WindowSetSize](https://wails.io/docs/reference/runtime/window#windowsetsize)
// 设置窗口宽度和高度。
export function WindowSetSize(width: number, height: number): void;

// [WindowGetSize](https://wails.io/docs/reference/runtime/window#windowgetsize)
// 获取窗口宽度和高度。
export function WindowGetSize(): Promise<Size>;

// [WindowSetMaxSize](https://wails.io/docs/reference/runtime/window#windowsetmaxsize)
// 设置窗口最大尺寸。如果窗口当前大于给定尺寸，则会调整窗口大小。
// 设置尺寸为 0,0 将禁用此限制。
export function WindowSetMaxSize(width: number, height: number): void;

// [WindowSetMinSize](https://wails.io/docs/reference/runtime/window#windowsetminsize)
// 设置窗口最小尺寸。如果窗口当前小于给定尺寸，则会调整窗口大小。
// 设置尺寸为 0,0 将禁用此限制。
export function WindowSetMinSize(width: number, height: number): void;

// [WindowSetPosition](https://wails.io/docs/reference/runtime/window#windowsetposition)
// 设置窗口相对于当前所在显示器的位置。
export function WindowSetPosition(x: number, y: number): void;

// [WindowGetPosition](https://wails.io/docs/reference/runtime/window#windowgetposition)
// 获取窗口相对于当前所在显示器的位置。
export function WindowGetPosition(): Promise<Position>;

// [WindowHide](https://wails.io/docs/reference/runtime/window#windowhide)
// 隐藏窗口。
export function WindowHide(): void;

// [WindowShow](https://wails.io/docs/reference/runtime/window#windowshow)
// 如果窗口当前处于隐藏状态，则显示窗口。
export function WindowShow(): void;

// [WindowMaximise](https://wails.io/docs/reference/runtime/window#windowmaximise)
// 最大化窗口，使其填满屏幕。
export function WindowMaximise(): void;

// [WindowToggleMaximise](https://wails.io/docs/reference/runtime/window#windowtogglemaximise)
// 在最大化和非最大化状态之间切换。
export function WindowToggleMaximise(): void;

// [WindowUnmaximise](https://wails.io/docs/reference/runtime/window#windowunmaximise)
// 恢复最大化前的窗口尺寸和位置。
export function WindowUnmaximise(): void;

// [WindowIsMaximised](https://wails.io/docs/reference/runtime/window#windowismaximised)
// 返回窗口状态，即窗口是否处于最大化状态。
export function WindowIsMaximised(): Promise<boolean>;

// [WindowMinimise](https://wails.io/docs/reference/runtime/window#windowminimise)
// 最小化窗口。
export function WindowMinimise(): void;

// [WindowUnminimise](https://wails.io/docs/reference/runtime/window#windowunminimise)
// 恢复最小化前的窗口尺寸和位置。
export function WindowUnminimise(): void;

// [WindowIsMinimised](https://wails.io/docs/reference/runtime/window#windowisminimised)
// 返回窗口状态，即窗口是否处于最小化状态。
export function WindowIsMinimised(): Promise<boolean>;

// [WindowIsNormal](https://wails.io/docs/reference/runtime/window#windowisnormal)
// 返回窗口状态，即窗口是否处于普通状态。
export function WindowIsNormal(): Promise<boolean>;

// [WindowSetBackgroundColour](https://wails.io/docs/reference/runtime/window#windowsetbackgroundcolour)
// 将窗口背景色设置为指定的 RGBA 颜色定义。所有透明像素都会显示此颜色。
export function WindowSetBackgroundColour(R: number, G: number, B: number, A: number): void;

// [ScreenGetAll](https://wails.io/docs/reference/runtime/window#screengetall)
// 获取所有屏幕。每次需要从底层窗口系统刷新数据时都应重新调用此方法。
export function ScreenGetAll(): Promise<Screen[]>;

// [BrowserOpenURL](https://wails.io/docs/reference/runtime/browser#browseropenurl)
// 在系统浏览器中打开指定 URL。
export function BrowserOpenURL(url: string): void;

// [Environment](https://wails.io/docs/reference/runtime/intro#environment)
// 返回环境信息。
export function Environment(): Promise<EnvironmentInfo>;

// [Quit](https://wails.io/docs/reference/runtime/intro#quit)
// 退出应用。
export function Quit(): void;

// [Hide](https://wails.io/docs/reference/runtime/intro#hide)
// 隐藏应用。
export function Hide(): void;

// [Show](https://wails.io/docs/reference/runtime/intro#show)
// 显示应用。
export function Show(): void;

// [ClipboardGetText](https://wails.io/docs/reference/runtime/clipboard#clipboardgettext)
// 返回剪贴板中当前存储的文本。
export function ClipboardGetText(): Promise<string>;

// [ClipboardSetText](https://wails.io/docs/reference/runtime/clipboard#clipboardsettext)
// 设置剪贴板文本。
export function ClipboardSetText(text: string): Promise<boolean>;

// [OnFileDrop](https://wails.io/docs/reference/runtime/draganddrop#onfiledrop)
// OnFileDrop 监听拖放事件，并将放置坐标和路径字符串数组传给回调函数。
export function OnFileDrop(callback: (x: number, y: number ,paths: string[]) => void, useDropTarget: boolean) :void

// [OnFileDropOff](https://wails.io/docs/reference/runtime/draganddrop#dragandddropoff)
// OnFileDropOff 移除拖放监听器和处理器。
export function OnFileDropOff() :void

// 检查文件路径解析器是否可用。
export function CanResolveFilePaths(): boolean;

// 解析文件数组中的文件路径。
export function ResolveFilePaths(files: File[]): void

// 通知类型。
export interface NotificationOptions {
    id: string;
    title: string;
    subtitle?: string; // 仅限 macOS 和 Linux
    body?: string;
    categoryId?: string;
    data?: { [key: string]: any };
}

export interface NotificationAction {
    id?: string;
    title?: string;
    destructive?: boolean; // macOS 专属
}

export interface NotificationCategory {
    id?: string;
    actions?: NotificationAction[];
    hasReplyField?: boolean;
    replyPlaceholder?: string;
    replyButtonTitle?: string;
}

// [InitializeNotifications](https://wails.io/docs/reference/runtime/notification#initializenotifications)
// 初始化应用的通知服务。
// 发送任何通知前都必须调用此方法。
export function InitializeNotifications(): Promise<void>;

// [CleanupNotifications](https://wails.io/docs/reference/runtime/notification#cleanupnotifications)
// 清理通知资源并释放所有持有的连接。
export function CleanupNotifications(): Promise<void>;

// [IsNotificationAvailable](https://wails.io/docs/reference/runtime/notification#isnotificationavailable)
// 检查当前平台是否支持通知。
export function IsNotificationAvailable(): Promise<boolean>;

// [RequestNotificationAuthorization](https://wails.io/docs/reference/runtime/notification#requestnotificationauthorization)
// 请求用户授予通知权限（仅限 macOS）。
export function RequestNotificationAuthorization(): Promise<boolean>;

// [CheckNotificationAuthorization](https://wails.io/docs/reference/runtime/notification#checknotificationauthorization)
// 检查当前通知权限状态（仅限 macOS）。
export function CheckNotificationAuthorization(): Promise<boolean>;

// [SendNotification](https://wails.io/docs/reference/runtime/notification#sendnotification)
// 使用给定选项发送基本通知。
export function SendNotification(options: NotificationOptions): Promise<void>;

// [SendNotificationWithActions](https://wails.io/docs/reference/runtime/notification#sendnotificationwithactions)
// 发送带操作按钮的通知，需要已注册的通知类别。
export function SendNotificationWithActions(options: NotificationOptions): Promise<void>;

// [RegisterNotificationCategory](https://wails.io/docs/reference/runtime/notification#registernotificationcategory)
// 注册可与 SendNotificationWithActions 一起使用的通知类别。
export function RegisterNotificationCategory(category: NotificationCategory): Promise<void>;

// [RemoveNotificationCategory](https://wails.io/docs/reference/runtime/notification#removenotificationcategory)
// 移除之前注册的通知类别。
export function RemoveNotificationCategory(categoryId: string): Promise<void>;

// [RemoveAllPendingNotifications](https://wails.io/docs/reference/runtime/notification#removeallpendingnotifications)
// 从通知中心移除所有待处理通知。
export function RemoveAllPendingNotifications(): Promise<void>;

// [RemovePendingNotification](https://wails.io/docs/reference/runtime/notification#removependingnotification)
// 根据标识符移除指定的待处理通知。
export function RemovePendingNotification(identifier: string): Promise<void>;

// [RemoveAllDeliveredNotifications](https://wails.io/docs/reference/runtime/notification#removealldeliverednotifications)
// 从通知中心移除所有已送达通知。
export function RemoveAllDeliveredNotifications(): Promise<void>;

// [RemoveDeliveredNotification](https://wails.io/docs/reference/runtime/notification#removedeliverednotification)
// 根据标识符移除指定的已送达通知。
export function RemoveDeliveredNotification(identifier: string): Promise<void>;

// [RemoveNotification](https://wails.io/docs/reference/runtime/notification#removenotification)
// 根据标识符移除通知（跨平台便捷函数）。
export function RemoveNotification(identifier: string): Promise<void>;
