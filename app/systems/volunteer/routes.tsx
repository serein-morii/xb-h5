import { lazy } from "react";
import { APP_ROUTES } from "../../lib/pathConventions";
import type { RouteConfig } from "../types";

const VolunteerHome = lazy(() => import("./VolunteerHome"));
const VolunteerJoin = lazy(() => import("./VolunteerJoin"));
const VolunteerAdmin = lazy(() => import("./VolunteerAdmin"));

export const volunteerRoutes: Record<string, RouteConfig> = {
  [APP_ROUTES.volunteer]: {
    title: "鱼片志愿｜让每一次热心都有回响",
    description: "鱼片志愿会员登记、志愿活动与服务记录。",
    content: <VolunteerHome />,
  },
  [APP_ROUTES.volunteerJoin]: {
    title: "加入鱼片志愿",
    description: "填写会员信息并提交鱼片志愿登记申请。",
    content: <VolunteerJoin />,
  },
  [APP_ROUTES.volunteerManage]: {
    title: "鱼片志愿管理后台",
    description: "鱼片志愿登记审核与会员档案管理。",
    content: <VolunteerAdmin />,
  },
};
