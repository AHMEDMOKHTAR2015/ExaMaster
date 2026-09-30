import { RegistrationKey } from '../models';

export interface RegistrationKeyValidationResult {
  valid: boolean;
  reason?: string;
  key?: RegistrationKey;
}
