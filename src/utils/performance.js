import { InteractionManager } from 'react-native';

export const runAfterInteractions = (task) => {
  InteractionManager.runAfterInteractions(() => {
    task();
  });
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const memoWithDeepCompare = (Component) => {
  return React.memo(Component, (prevProps, nextProps) => {
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
  });
};

export const withPreventDoubleClick = (WrappedComponent) => {
  class PreventDoubleClick extends React.PureComponent {
    debouncedOnPress = debounce((...args) => {
      if (this.props.onPress) {
        this.props.onPress(...args);
      }
    }, 300);

    render() {
      return (
        <WrappedComponent
          {...this.props}
          onPress={this.debouncedOnPress}
        />
      );
    }
  }

  return PreventDoubleClick;
};