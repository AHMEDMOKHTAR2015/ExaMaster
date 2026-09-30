// Re-exports from shared service-mixins.
// WithAuthState and AuthStateMixin are aliases kept for backward compatibility.
export {
  Constructor,
  LoadingMixin,
  ErrorHandlingMixin,
  ServiceStateMixin as AuthStateMixin
} from '../shared/service-mixins';
export {
  MixinBase,
  WithLoading,
  WithErrorHandling,
  WithServiceState as WithAuthState
} from '../../interfaces';
