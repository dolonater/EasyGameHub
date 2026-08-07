type ToastType = "success" | "error" | "info";
type ToastListener = (type: ToastType, message: string) => void;

let listener: ToastListener | null = null;

export function onToast(cb: ToastListener) {
  listener = cb;
}

export function showToast(type: ToastType, message: string) {
  listener?.(type, message);
}
