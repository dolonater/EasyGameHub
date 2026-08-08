import { invoke } from "@tauri-apps/api/core";
import type { PendingConfirmation } from "./steamCommunity";

/** List the pending Steam mobile confirmations for the active account. */
export function getPendingConfirmations(): Promise<PendingConfirmation[]> {
  return invoke<PendingConfirmation[]>("get_pending_confirmations");
}

/** Confirm (`allow`) or reject (`deny`) a single mobile confirmation. */
export function respondConfirmation(
  confirmationId: string,
  key: string,
  action: "allow" | "deny",
): Promise<void> {
  return invoke("respond_confirmation", {
    confirmationId,
    key,
    action,
  });
}

/** Rebuild a `.maFile` JSON from a stored Steam authenticator entry. */
export function exportMaFile(entryId: string): Promise<string> {
  return invoke<string>("export_mafile", { entryId });
}
