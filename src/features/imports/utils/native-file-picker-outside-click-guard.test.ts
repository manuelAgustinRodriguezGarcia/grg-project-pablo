/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNativeFilePickerOutsideClickGuard } from "@/features/imports/utils/native-file-picker-outside-click-guard";

describe("useNativeFilePickerOutsideClickGuard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignora el cierre externo mientras el selector nativo está activo", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useNativeFilePickerOutsideClickGuard());

    act(() => {
      result.current.armForNativeFilePicker();
    });

    expect(result.current.shouldIgnoreOutsideClose()).toBe(true);

    act(() => {
      result.current.notifyNativeFilePickerSettled();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.shouldIgnoreOutsideClose()).toBe(false);
  });

  it("deja de ignorar el cierre cuando la ventana recupera el foco", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useNativeFilePickerOutsideClickGuard());

    act(() => {
      result.current.armForNativeFilePicker();
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(500);
    });

    expect(result.current.shouldIgnoreOutsideClose()).toBe(false);
  });
});
