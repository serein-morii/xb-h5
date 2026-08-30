/**
 * 订单管理入口：实现放在当前系统的 admin/*
 * 保留默认 import 路径，具体页面由后台外壳按需加载。
 */
export { default } from "./admin/shell";
export { DashboardPage } from "./admin/dashboard";
export { LoginScreen } from "./admin/login";
export { STORE_STATUS_OPTIONS } from "./admin/core";
