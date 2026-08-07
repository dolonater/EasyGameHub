import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../Notification";
import Button from "../ui/Button";
import TabButtons from "../ui/TabButtons";
import Checkbox from "../ui/Checkbox";
import FormCard from "../ui/FormCard";
import OtpInput from "../ui/OtpInput";
import Icon from "../ui/Icon";
import type { SessionDto } from "../../lib/steamCommunity";

interface SteamLoginDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful login (session is persisted backend-side). */
  onLoggedIn?: () => void;
}

interface LoginStep1Result {
  clientId: number;
  requestIdHex: string;
  intervalSeconds: number;
  allowedConfirmations: ConfirmationDto[];
  steamId: number | null;
}

interface ConfirmationDto {
  confirmationType: number;
  typeName: string;
  associatedMessage: string | null;
}

interface PollResultDto {
  status: "pending" | "needs_guard" | "completed";
  steamId: number | null;
  accountName: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  newGuardData: string | null;
  loginResult: SessionDto | null;
}

// ── Inline prompt styling (mirrors ui/Toast.tsx palette) ──────────────
const messageBox: Record<"info" | "success" | "error", string> = {
  success: "border-[#84d65a]/70 bg-[#edfbd8]/72 dark:bg-[#1a2e12]/72",
  error:   "border-[#f87171]/70 bg-[#fef2f2]/72 dark:bg-[#2e1212]/72",
  info:    "border-[#1d4ed8]/70 bg-[#eff6ff]/72 dark:bg-[#0f1e3a]/72",
};

const messageText: Record<"info" | "success" | "error", string> = {
  success: "text-[#2b641e] dark:text-[#84d65a]",
  error:   "text-[#991b1b] dark:text-[#f87171]",
  info:    "text-[#1d4ed8] dark:text-[#60a5fa]",
};

/**
 * Steam login flow as a modal dialog (replaces the old /steam/login page).
 *
 * During an in-progress login (guard-code entry or session polling) the
 * dialog cannot be dismissed via the backdrop — an explicit "取消登录"
 * button stops the flow. On success the parent is notified via `onLoggedIn`.
 */
export default function SteamLoginDialog({
  open,
  onClose,
  onLoggedIn,
}: SteamLoginDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"password" | "qr">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "guard" | "done">("input");
  const [confirmations, setConfirmations] = useState<ConfirmationDto[]>([]);
  const [guardCode, setGuardCode] = useState("");
  const [pollInterval, setPollInterval] = useState(5000);
  const [qrUrl, setQrUrl] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Inline prompt shown inside the dialog (the global toast is hidden behind the blurred backdrop). */
  const [message, setMessage] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);

  // Busy = in-progress login: backdrop must not dismiss the dialog.
  const busy = loading || polling || step === "guard";

  useEffect(() => {
    if (!open) {
      // Reset any in-flight flow when the dialog is closed externally.
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
      setPolling(false);
      setStep("input");
      setMessage(null);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [open]);

  const stopPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
    setPolling(false);
  };

  const startPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setPolling(true);
    pollTimer.current = setInterval(async () => {
      try {
        const result = await invoke<PollResultDto>("login_poll");
        if (result.status === "completed") {
          stopPolling();
          setStep("done");
          showToast("success", t("steamLogin.success"));
          onLoggedIn?.();
          onClose();
        } else if (result.status === "needs_guard") {
          stopPolling();
          setStep("guard");
        }
      } catch (e: any) {
        stopPolling();
        setMessage({ type: "error", text: String(e) });
      }
    }, pollInterval);
  };

  const handlePasswordLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await invoke<LoginStep1Result>("login_step1", { username, password });
      setConfirmations(result.allowedConfirmations);
      setPollInterval(result.intervalSeconds * 1000);

      // Only code-based guards (email / mobile-app code) need manual input.
      // Device-confirmation and machine-token confirmations resolve by
      // polling instead — no code is ever delivered for those.
      const needsCode = result.allowedConfirmations.some(
        (c) => c.confirmationType === 2 || c.confirmationType === 3 // EmailCode | DeviceCode
      );

      if (needsCode) {
        setStep("guard");
        setMessage({ type: "info", text: t("steamLogin.guardNeeded") });
      } else {
        startPolling();
      }
    } catch (e: any) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleQrLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await invoke<{ challengeUrl: string; intervalSeconds: number }>("login_begin_qr");
      setQrUrl(result.challengeUrl);
      setPollInterval(result.intervalSeconds * 1000);
      startPolling();
    } catch (e: any) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGuard = async () => {
    if (!guardCode) return;
    setLoading(true);
    setMessage(null);
    try {
      const codeConfirmation = confirmations.find(
        (c) => c.confirmationType === 2 || c.confirmationType === 3 // EmailCode | DeviceCode
      );
      const guardType = codeConfirmation?.confirmationType || 2;
      await invoke("login_submit_guard", { code: guardCode, guardType });
      setMessage({ type: "success", text: t("steamLogin.guardSubmitted") });
      setGuardCode("");
      setStep("input");
      startPolling();
    } catch (e: any) {
      setMessage({ type: "error", text: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    stopPolling();
    setStep("input");
    setMessage(null);
    onClose();
  };

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 soft-backdrop"
      onMouseDown={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="app-surface app-glass-card relative w-[420px] max-w-full max-h-[88vh] overflow-y-auto rounded-[var(--radius)] border border-border/60 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("steamLogin.title")}</h2>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
            title={t("common.close", { defaultValue: "关闭" })}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Mode selector */}
        <TabButtons
          name="login-mode"
          value={mode}
          onChange={(v) => {
            setMode(v as "password" | "qr");
            setMessage(null);
          }}
          options={[
            { value: "password", label: t("steamLogin.password") },
            { value: "qr", label: t("steamLogin.qrCode") },
          ]}
        />

        {/* Inline prompt — global toasts render under the blurred backdrop */}
        {message && (
          <div className={`mt-4 flex items-start gap-2 rounded px-3 py-2 border-l-4 text-sm ${messageBox[message.type]}`}>
            <Icon
              name={message.type === "error" ? "error" : message.type === "success" ? "success" : "info"}
              size={16}
              className={`flex-shrink-0 mt-0.5 ${messageText[message.type]}`}
            />
            <span className={`flex-1 ${messageText[message.type]}`}>{message.text}</span>
          </div>
        )}

        <div className="mt-5">
          {mode === "password" && step !== "done" && (
            <div className="mx-auto w-80">
              {step === "guard" ? (
                <OtpInput
                  length={5}
                  value={guardCode}
                  onChange={setGuardCode}
                  onSubmit={handleSubmitGuard}
                  disabled={loading}
                  label={t("steamLogin.enterGuard")}
                  confirmLabel={t("steamLogin.submit")}
                />
              ) : polling ? (
                <FormCard title={t("steamLogin.title")} className="text-center">
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Icon name="reset" size={16} className="animate-spin" />
                    <span>{t("steamLogin.polling")}</span>
                  </div>
                </FormCard>
              ) : (
                <FormCard title={t("steamLogin.enterCredentials")} subtitle={undefined}>
                  <div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t("steamLogin.username")}
                      className="outline-none border-2 rounded-md px-2 py-1 text-slate-500 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground w-full bg-transparent focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("steamLogin.passwordPlaceholder")}
                      className="outline-none border-2 rounded-md px-2 py-1 text-slate-500 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground w-full bg-transparent focus:border-primary/50 transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter") handlePasswordLogin(); }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={rememberMe} onChange={setRememberMe} color="blue" />
                    <span className="text-slate-500 dark:text-muted-foreground text-sm">{t("steamLogin.rememberMe")}</span>
                  </div>
                  <Button onClick={handlePasswordLogin} disabled={loading} ripple={false} className="w-full justify-center">
                    {loading ? "..." : t("steamLogin.login")}
                  </Button>
                </FormCard>
              )}
            </div>
          )}

          {mode === "qr" && (
            <FormCard title={t("steamLogin.qrCode")} className="mx-auto text-center">
              {qrUrl ? (
                <>
                  <p className="text-slate-500 dark:text-muted-foreground text-sm">{t("steamLogin.scanQr")}</p>
                  <div className="bg-white p-2 rounded-md inline-block">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`} alt="QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-muted-foreground break-all">{qrUrl}</p>
                </>
              ) : (
                <>
                  <p className="text-slate-500 dark:text-muted-foreground text-sm">{t("steamLogin.qrHint")}</p>
                  <Button onClick={handleQrLogin} disabled={loading} ripple={false} className="w-full justify-center">
                    {loading ? "..." : t("steamLogin.generateQr")}
                  </Button>
                </>
              )}
            </FormCard>
          )}
        </div>

        {/* Cancel button — status text removed (duplicated by the inline prompt) */}
        {busy && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCancel} ripple={false}>
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
