import { Component, type ErrorInfo, type ReactNode } from "react";

/** 组件树兜底：单个页面/弹窗崩溃时降级为可恢复的提示，不再整站白屏。 */
export default class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="error-boundary" role="alert">
      <span>出错了</span>
      <h1>页面遇到了问题</h1>
      <p>{this.state.error.message || "渲染时发生未知错误"}</p>
      <button type="button" onClick={() => { this.setState({ error: null }); }}>重试</button>
      <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
    </main>;
  }
}
