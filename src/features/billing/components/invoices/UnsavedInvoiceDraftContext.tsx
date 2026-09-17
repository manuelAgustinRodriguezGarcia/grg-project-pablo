"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";

type LeaveRequest = {
  href: string;
  exact?: boolean;
};

export type LeaveBlockHandler = (
  href: string,
  options?: { exact?: boolean },
) => boolean;

type UnsavedInvoiceDraftContextValue = {
  isInvoiceIssued: boolean;
  setInvoiceIssued: (issued: boolean) => void;
  setDraftDirty: (dirty: boolean) => void;
  requestLeave: (href: string, options?: { exact?: boolean }) => boolean;
  interceptLeave: (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    options?: { exact?: boolean },
  ) => boolean;
  setLeaveBlockHandler: (handler: LeaveBlockHandler | null) => void;
};

const UnsavedInvoiceDraftContext =
  createContext<UnsavedInvoiceDraftContextValue | null>(null);

export function useUnsavedInvoiceDraft(): UnsavedInvoiceDraftContextValue | null {
  return useContext(UnsavedInvoiceDraftContext);
}

export function UnsavedInvoiceDraftProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const sectionTransition = useAdminSectionTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [isInvoiceIssued, setInvoiceIssued] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null);
  const leaveBlockHandlerRef = useRef<LeaveBlockHandler | null>(null);

  const setLeaveBlockHandler = useCallback(
    (handler: LeaveBlockHandler | null) => {
      leaveBlockHandlerRef.current = handler;
    },
    [],
  );

  const setDraftDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    if (!dirty) {
      setLeaveRequest(null);
    }
  }, []);

  const requestLeave = useCallback(
    (href: string, options?: { exact?: boolean }): boolean => {
      if (leaveBlockHandlerRef.current?.(href, options)) {
        return true;
      }

      if (!isDirty) {
        return false;
      }

      setLeaveRequest({ href, exact: options?.exact });
      return true;
    },
    [isDirty],
  );

  const interceptLeave = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement>,
      href: string,
      options?: { exact?: boolean },
    ): boolean => {
      if (!requestLeave(href, options)) {
        return false;
      }

      event.preventDefault();
      return true;
    },
    [requestLeave],
  );

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const contextValue = useMemo(
    () => ({
      isInvoiceIssued,
      setInvoiceIssued,
      setDraftDirty,
      requestLeave,
      interceptLeave,
      setLeaveBlockHandler,
    }),
    [
      interceptLeave,
      isInvoiceIssued,
      requestLeave,
      setDraftDirty,
      setLeaveBlockHandler,
    ],
  );

  return (
    <UnsavedInvoiceDraftContext.Provider value={contextValue}>
      {children}

      {leaveRequest ? (
        <ConfirmDialog
          title="¿Descartar la factura?"
          message="Si sale de esta pantalla se borrarán los datos ingresados."
          confirmLabel="Descartar y salir"
          cancelLabel="Seguir editando"
          variant="danger"
          onCancel={() => setLeaveRequest(null)}
          onConfirm={() => {
            const nextHref = leaveRequest.href;
            const exact = leaveRequest.exact;
            setLeaveRequest(null);
            setIsDirty(false);
            sectionTransition?.beginNavigation(nextHref, { exact });
            router.push(nextHref);
          }}
        />
      ) : null}
    </UnsavedInvoiceDraftContext.Provider>
  );
}
