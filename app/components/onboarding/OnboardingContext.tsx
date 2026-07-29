import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type OnboardingStep = {
  /** 唯一 id；同时充当 data-onboard 属性值 */
  id: string;
  /** 标题 */
  title: string;
  /** 说明文案 */
  body: string;
  /** 目标元素选择器；为空表示是居中欢迎卡（无 spotlight） */
  target?: string;
  /** spotlight 在目标元素的哪一侧放 tooltip：top / bottom / left / right / center */
  placement?: "top" | "bottom" | "left" | "right" | "center";
  /** 进到这一步之前要执行的动作（打开菜单、滚动到位置等） */
  beforeEnter?: () => void | Promise<void>;
  /** 离开这一步之后要执行的动作 */
  afterLeave?: () => void;
  /**
   * true = 这步要等用户点目标元素。
   * 浮层会隐藏「下一步」按钮，改为「请点击下方按钮」提示；
   * 目标元素被点击后自动推进到下一步。
   * 业务代码需要在目标元素的 onClick 里调用 onAdvance()。
   */
  awaitClick?: boolean;
  /** awaitClick 步骤的提示文案（替代「下一步」） */
  clickHint?: string;
};

type OnboardingState = {
  /** 当前正在跑的步骤列表；null 表示无引导 */
  steps: OnboardingStep[] | null;
  /** 当前下标 */
  index: number;
  /** 总步骤数（用于显示 1/5） */
  total: number;
  /** 当前 step */
  current: OnboardingStep | null;
  next: () => Promise<void>;
  prev: () => void;
  skip: () => void;
  /** awaitClick 步骤专用：被目标元素的 onClick 调用，推进到下一步 */
  advance: () => Promise<void>;
  /** 触发系统引导（首次进入时）；调用方传完整 steps 列表 */
  startSystemTour: (steps: OnboardingStep[]) => void;
  /** 触发某个页面的单步介绍；调用方传完整 steps 列表（已看过会 no-op） */
  startPageIntro: (steps: OnboardingStep[]) => void;
  /** 用户主动重看系统引导 */
  replaySystemTour: (steps: OnboardingStep[]) => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

const STORAGE_KEY = "xb-h5-onboarding";
type PersistShape = {
  /** 系统引导是否已看完 */
  systemDone: boolean;
  /** 已看完的页面介绍 id 集合 */
  pageIntros: string[];
};

function readPersist(): PersistShape {
  if (typeof window === "undefined") return { systemDone: false, pageIntros: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { systemDone: false, pageIntros: [] };
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    return {
      systemDone: parsed.systemDone === true,
      pageIntros: Array.isArray(parsed.pageIntros) ? parsed.pageIntros.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return { systemDone: false, pageIntros: [] };
  }
}

function writePersist(next: PersistShape) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 忽略 */
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [persist, setPersist] = useState<PersistShape>(() => readPersist());
  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const stepsRef = useRef<OnboardingStep[] | null>(null);
  stepsRef.current = steps;
  const indexRef = useRef(index);
  indexRef.current = index;

  const closeTour = useCallback((markSystemDone: boolean) => {
    const current = stepsRef.current;
    if (current) {
      const ids = current.map((s) => s.id);
      setPersist((p) => {
        const isSystemTour = ids[0] === "__system-welcome";
        const pageIntros = Array.from(new Set([...p.pageIntros, ...ids.filter((x) => !x.startsWith("__"))]));
        const next: PersistShape = {
          systemDone: markSystemDone || isSystemTour ? true : p.systemDone,
          pageIntros,
        };
        writePersist(next);
        return next;
      });
    }
    setSteps(null);
    setIndex(0);
  }, []);

  const goTo = useCallback(
    async (nextIndex: number) => {
      const list = stepsRef.current;
      if (!list) return;
      const clamped = Math.max(0, Math.min(list.length - 1, nextIndex));
      // 离开当前步骤
      const prevStep = list[indexRef.current];
      prevStep?.afterLeave?.();
      // 进入下一步：先等 beforeEnter 完成（用于打开菜单等异步动作）
      const target = list[clamped];
      if (target?.beforeEnter) {
        await Promise.resolve(target.beforeEnter());
        // 给 DOM 一点时间更新位置
        await new Promise((r) => setTimeout(r, 60));
      }
      setIndex(clamped);
    },
    [],
  );

  const prev = useCallback(() => {
    if (indexRef.current <= 0) return;
    void goTo(indexRef.current - 1);
  }, [goTo]);

  const skip = useCallback(() => {
    closeTour(false);
  }, [closeTour]);

  // ESC 键关闭
  useEffect(() => {
    if (!steps) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [steps, skip]);

  // 步骤列表变化时，初始要跑 beforeEnter
  useEffect(() => {
    if (!steps) return;
    const first = steps[0];
    if (first?.beforeEnter) {
      Promise.resolve(first.beforeEnter()).then(() => {
        // 等 DOM 更新
        setTimeout(() => setIndex(0), 60);
      });
    } else {
      setIndex(0);
    }
  }, [steps]);

  const startSystemTour = useCallback(async (allSteps: OnboardingStep[]) => {
    if (stepsRef.current) return; // 已有引导在跑
    setSteps(allSteps);
  }, []);

  const startPageIntro = useCallback((allSteps: OnboardingStep[]) => {
    if (stepsRef.current) return;
    if (allSteps.length === 0) return;
    const id = allSteps[0].id;
    if (persistRef.current.pageIntros.includes(id)) return;
    setSteps(allSteps);
  }, []);

  const replaySystemTour = useCallback((allSteps: OnboardingStep[]) => {
    if (stepsRef.current) {
      closeTour(false);
    }
    setSteps(allSteps);
  }, [closeTour]);

  const next = useCallback(async () => {
    const list = stepsRef.current;
    if (!list) return;
    if (indexRef.current >= list.length - 1) {
      closeTour(true);
      return;
    }
    await goTo(indexRef.current + 1);
  }, [closeTour, goTo]);

  const value = useMemo<OnboardingState>(
    () => ({
      steps,
      index,
      total: steps?.length ?? 0,
      current: steps ? steps[index] ?? null : null,
      next,
      prev,
      skip,
      advance: next, // awaitClick 步骤专用：推进到下一步
      startSystemTour,
      startPageIntro,
      replaySystemTour,
    }),
    [steps, index, next, prev, skip, startSystemTour, startPageIntro, replaySystemTour],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}

/** 仅取 trigger 函数；不订阅 current，避免组件不必要重渲 */
export function useOnboardingTriggers() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingTriggers must be used inside OnboardingProvider");
  return {
    startSystemTour: ctx.startSystemTour,
    startPageIntro: ctx.startPageIntro,
    replaySystemTour: ctx.replaySystemTour,
  };
}

