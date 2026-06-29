import React from "react";

type Props = { fallback: React.ReactNode; children: React.ReactNode };
type State = { hasError: boolean };

/** Keeps a WebGL/Three.js failure from blanking the whole editor. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D preview failed:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
