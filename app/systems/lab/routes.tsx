import { lazy, useEffect } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const LabHome = lazy(() => import("./LabHome"));
const BeadStudioPage = lazy(() => import("./BeadStudioPage"));
const VideoExtractPage = lazy(() => import("./VideoExtractPage"));

function BeadStudioRedirect() {
  useEffect(() => {
    window.location.replace(APP_ROUTES.beadStudio);
  }, []);
  return <main className="spa-short-link-loading"><div className="app-loading-mark"><span /></div></main>;
}

function LabRedirect() {
  useEffect(() => {
    window.location.replace(APP_ROUTES.lab);
  }, []);
  return <main className="spa-short-link-loading"><div className="app-loading-mark"><span /></div></main>;
}

export const labRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.beadStudio]: {
    title: "Bead Studio · 拼豆工作台",
    description: "把图片转成可编辑的拼豆图纸。",
    content: <BeadStudioPage />,
  },
  [APP_ROUTES.labBeadStudio]: {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
  },
  [APP_ROUTES.labBeadStudioHtml]: {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
  },
  "/handy/bead-studio.html": {
    title: "正在打开拼豆工作台",
    description: "跳转到拼豆工作台。",
    content: <BeadStudioRedirect />,
  },
  [APP_ROUTES.lab]: {
    title: "Handy Lab｜灵感实验室",
    description: "独立于订单系统的创意工具实验室。",
    shell: "lab",
    content: <LabHome />,
  },
  [APP_ROUTES.labVideoExtract]: {
    title: "短视频提取｜Handy Lab",
    description: "解析抖音、小红书、哔哩哔哩分享链接，预览并下载媒体。",
    shell: "lab",
    content: <VideoExtractPage />,
  },
  "/utilities": {
    title: "正在打开 Handy Lab",
    description: "跳转到 Handy Lab。",
    content: <LabRedirect />,
  },
};
