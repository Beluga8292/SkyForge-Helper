import { create } from "zustand";

export type AccountDialogMode = "link" | "switch";

interface AccountDialogStore {
  open: boolean;
  mode: AccountDialogMode;
  /** Where to go after a successful link. Null keeps the current page. */
  redirect: string | null;
  openDialog: (options?: { mode?: AccountDialogMode; redirect?: string | null }) => void;
  close: () => void;
}

/**
 * One shared entry point for linking/switching the Minecraft account.
 * The binding itself still lives in the settings store (`lastProfile`), so the
 * sidebar, prompts and profile page all use the same persisted state.
 */
export const useAccountDialogStore = create<AccountDialogStore>((set) => ({
  open: false,
  mode: "link",
  redirect: null,
  openDialog: (options) =>
    set({
      open: true,
      mode: options?.mode ?? "link",
      redirect: options?.redirect ?? null,
    }),
  close: () => set({ open: false }),
}));

export function openLinkAccount(options?: { mode?: AccountDialogMode; redirect?: string | null }) {
  useAccountDialogStore.getState().openDialog(options);
}
