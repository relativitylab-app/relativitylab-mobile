import React, { ErrorInfo, ReactNode } from "react";

interface SceneErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (error: Error) => void;
  readonly resetKey: number;
}
interface SceneErrorBoundaryState {
  readonly failed: boolean;
}

export class SceneErrorBoundary extends React.Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  componentDidUpdate(previousProps: SceneErrorBoundaryProps): void {
    if (
      this.state.failed &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
