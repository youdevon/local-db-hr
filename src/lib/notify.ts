import { toast } from "sonner";

/** Default toast duration (ms); keep in sync with `<Toaster duration={...} />`. */
export const TOAST_DURATION_MS = 5000;

export function notifySuccess(message: string) {
  toast.success(message, { duration: TOAST_DURATION_MS });
}

export function notifyError(message: string) {
  toast.error(message, { duration: TOAST_DURATION_MS });
}

export function notifyInfo(message: string) {
  toast.info(message, { duration: TOAST_DURATION_MS });
}

function titleCaseEntity(entity: string) {
  const t = entity.trim();
  if (!t) return "Item";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** e.g. entity `user` → "User created successfully." */
export function notifyItemCreated(entity: string) {
  notifySuccess(`${titleCaseEntity(entity)} created successfully.`);
}

export function notifyItemCreateFailed(entity: string) {
  notifyError(`Failed to create ${entity.toLowerCase()}. Please try again.`);
}

export function notifyItemDeleted(entity: string) {
  notifySuccess(`${titleCaseEntity(entity)} deleted successfully.`);
}

export function notifyItemDeleteFailed(entity: string) {
  notifyError(`Failed to delete ${entity.toLowerCase()}. Please try again.`);
}

export function notifyItemDeactivated(entity: string) {
  notifySuccess(`${titleCaseEntity(entity)} deactivated successfully.`);
}

export function notifyItemDeactivateFailed(entity: string) {
  notifyError(`Failed to deactivate ${entity.toLowerCase()}. Please try again.`);
}

export function notifyItemUpdated(entity: string) {
  notifySuccess(`${titleCaseEntity(entity)} updated successfully.`);
}

export function notifyItemUpdateFailed(entity: string) {
  notifyError(`Failed to update ${entity.toLowerCase()}. Please try again.`);
}
