"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminSectionTransition } from "@/features/admin/components/AdminSectionTransition";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import {
  BILLING_NEW_INVOICE_PATH,
  BILLING_NEW_INVOICE_SHORTCUT,
  billingPathMatchesHref,
  billingTabCurrentMenuItem,
  billingTabMatchesPath,
  filterBillingNavTabsForRole,
  type BillingNavIconTone,
  type BillingNavTab,
} from "@/features/billing/data/billingNav";
import { hasPermission } from "@/shared/auth/permissions";
import type { UserRole } from "@/generated/prisma/client";
import { ChevronDown, ICON_STROKE, ReceiptText } from "@/shared/icons";
import styles from "@/features/billing/styles/BillingPillNav.module.scss";

const NEW_INVOICE_TAB: BillingNavTab = {
  href: BILLING_NEW_INVOICE_PATH,
  label: "Nueva factura",
  icon: ReceiptText,
  exact: true,
  permission: "invoices.read",
};

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  iconTone?: BillingNavIconTone;
};

function navMenuIconClass(tone: BillingNavIconTone): string {
  switch (tone) {
    case "blue":
      return styles.tabMenuIconBlue;
    case "red":
      return styles.tabMenuIconRed;
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
}

function billingNavMenuDomId(href: string): string {
  return `billing-nav-menu-${href.split("/").filter(Boolean).join("-")}`;
}

function flattenMobileNavItems(tabs: BillingNavTab[]): MobileNavItem[] {
  const items: MobileNavItem[] = [];

  for (const tab of tabs) {
    if (!tab.menuItems?.length) {
      items.push({
        href: tab.href,
        label: tab.label,
        icon: tab.icon,
        exact: tab.exact,
      });
      continue;
    }

    for (const item of tab.menuItems) {
      items.push({
        href: item.href,
        label: item.label,
        icon: item.icon,
        iconTone: item.iconTone,
      });
    }
  }

  return items;
}

function BillingNavGlyph({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return <Icon className={className} strokeWidth={ICON_STROKE} aria-hidden />;
}

type NavClickHandler = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  isActive: boolean,
  isPending: boolean,
) => void;

function BillingNavTabWithMenu({
  tab,
  tabClassName,
  isHrefActive,
  isHrefPending,
  pathname,
  pendingHref,
  onNavClick,
}: {
  tab: BillingNavTab;
  tabClassName: string;
  isHrefActive: boolean;
  isHrefPending: boolean;
  pathname: string;
  pendingHref: string | null;
  onNavClick: NavClickHandler;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuItems = tab.menuItems ?? [];
  const menuId = billingNavMenuDomId(tab.href);

  useEffect(() => {
    setIsOpen(false);

    function blurMenuFocus() {
      const active = document.activeElement;
      if (active instanceof HTMLElement && wrapRef.current?.contains(active)) {
        active.blur();
      }
    }

    blurMenuFocus();
    const frame = window.requestAnimationFrame(blurMenuFocus);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, pendingHref]);

  function handleWrapBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`${styles.tabWrap} ${isOpen ? styles.tabWrapOpen : ""}`}
      role="listitem"
      onPointerEnter={() => setIsOpen(true)}
      onPointerLeave={() => setIsOpen(false)}
      onBlur={handleWrapBlur}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
    >
      <Link
        href={tab.href}
        className={tabClassName}
        aria-current={isHrefActive ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={(event) => onNavClick(event, tab.href, isHrefActive, isHrefPending)}
        onFocus={() => setIsOpen(true)}
      >
        <BillingNavGlyph icon={tab.icon} className={styles.tabIcon} />
        <span>{tab.label}</span>
      </Link>
      <div
        id={menuId}
        className={styles.tabMenu}
        role="menu"
        aria-label={tab.label}
      >
        {menuItems.map((item) => {
          const isPending = Boolean(
            pendingHref && billingPathMatchesHref(pendingHref, item.href),
          );
          const isActive =
            !pendingHref && billingPathMatchesHref(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={`${styles.tabMenuItem} ${
                isActive ? styles.tabMenuItemActive : ""
              } ${isPending ? styles.tabPending : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => {
                setIsOpen(false);
                onNavClick(event, item.href, isActive, isPending);
              }}
            >
              <BillingNavGlyph
                icon={item.icon}
                className={`${styles.tabIcon} ${navMenuIconClass(item.iconTone)}`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function BillingPillNav({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const canCreateInvoice = hasPermission(userRole, "invoices.create");
  const canOpenNewInvoice = hasPermission(userRole, "invoices.read");
  const navTabs = useMemo(
    () => filterBillingNavTabsForRole(userRole),
    [userRole],
  );
  const pendingHref = sectionTransition?.pendingHref ?? null;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavItems = useMemo(
    () => flattenMobileNavItems(navTabs),
    [navTabs],
  );

  const currentTab = useMemo(() => {
    const matchPath = pendingHref ?? pathname;
    const matched = navTabs.find((tab) =>
      billingTabMatchesPath(matchPath, tab),
    );

    if (matched) {
      return matched;
    }

    if (matchPath === BILLING_NEW_INVOICE_PATH && canOpenNewInvoice) {
      return NEW_INVOICE_TAB;
    }

    return navTabs[0] ?? NEW_INVOICE_TAB;
  }, [canOpenNewInvoice, navTabs, pathname, pendingHref]);

  const currentMenuItem = billingTabCurrentMenuItem(
    pendingHref ?? pathname,
    currentTab,
  );
  const CurrentIcon = currentMenuItem?.icon ?? currentTab.icon;
  const currentLabel = currentMenuItem?.label ?? currentTab.label;
  const isOnNewInvoice = pathname === BILLING_NEW_INVOICE_PATH;
  const isInvoicing = isOnNewInvoice && !unsavedDraft?.isInvoiceIssued;

  const goToNewInvoice = useCallback(() => {
    if (isOnNewInvoice) {
      return;
    }

    if (
      unsavedDraft?.requestLeave(BILLING_NEW_INVOICE_PATH, {
        exact: true,
      })
    ) {
      return;
    }

    sectionTransition?.beginNavigation(BILLING_NEW_INVOICE_PATH, {
      exact: true,
    });
    router.push(BILLING_NEW_INVOICE_PATH);
  }, [isOnNewInvoice, router, sectionTransition, unsavedDraft]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (!mobileNavRef.current?.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!canCreateInvoice) {
      return;
    }

    function handleNewInvoiceShortcut(event: KeyboardEvent) {
      if (event.key !== BILLING_NEW_INVOICE_SHORTCUT) {
        return;
      }

      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      goToNewInvoice();
    }

    document.addEventListener("keydown", handleNewInvoiceShortcut);
    return () => {
      document.removeEventListener("keydown", handleNewInvoiceShortcut);
    };
  }, [canCreateInvoice, goToNewInvoice]);

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    isActive: boolean,
    isPending: boolean,
  ) {
    if (isActive || isPending) {
      setIsMobileMenuOpen(false);
      return;
    }

    if (unsavedDraft?.interceptLeave(event, href, { exact: true })) {
      return;
    }

    sectionTransition?.beginNavigation(href, { exact: true });
    setIsMobileMenuOpen(false);
  }

  return (
    <nav className={styles.bar} aria-label="Secciones de facturación">
      <div className={styles.inner}>
        <div className={styles.tabs} role="list">
          {navTabs.map((tab) => {
            const isSectionPending = Boolean(
              pendingHref && billingTabMatchesPath(pendingHref, tab),
            );
            const isHrefPending = Boolean(
              pendingHref &&
                billingPathMatchesHref(pendingHref, tab.href, tab.exact),
            );
            const isSectionActive =
              !pendingHref && billingTabMatchesPath(pathname, tab);
            const isHrefActive =
              !pendingHref &&
              billingPathMatchesHref(pathname, tab.href, tab.exact);
            const tabClassName = `${styles.tab} ${isSectionActive ? styles.tabActive : ""} ${isSectionPending ? styles.tabPending : ""}`;

            if (!tab.menuItems?.length) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  role="listitem"
                  className={tabClassName}
                  aria-current={isHrefActive ? "page" : undefined}
                  onClick={(event) =>
                    handleNavClick(event, tab.href, isHrefActive, isHrefPending)
                  }
                >
                  <BillingNavGlyph icon={tab.icon} className={styles.tabIcon} />
                  <span>{tab.label}</span>
                </Link>
              );
            }

            return (
              <BillingNavTabWithMenu
                key={tab.href}
                tab={tab}
                tabClassName={tabClassName}
                isHrefActive={isHrefActive}
                isHrefPending={isHrefPending}
                pathname={pathname}
                pendingHref={pendingHref}
                onNavClick={handleNavClick}
              />
            );
          })}
        </div>

        <div className={styles.mobileNav} ref={mobileNavRef}>
          <button
            type="button"
            className={`${styles.mobileTrigger} ${
              isMobileMenuOpen ? styles.mobileTriggerOpen : ""
            }`}
            aria-expanded={isMobileMenuOpen}
            aria-controls="billing-mobile-section-menu"
            aria-haspopup="listbox"
            aria-label="Secciones de facturación"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            <CurrentIcon
              className={styles.tabIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <span className={styles.mobileTriggerLabel}>{currentLabel}</span>
            <ChevronDown
              className={`${styles.mobileTriggerChevron} ${
                isMobileMenuOpen ? styles.mobileTriggerChevronOpen : ""
              }`}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
          </button>
          <ul
            id="billing-mobile-section-menu"
            className={`${styles.mobileMenu} ${
              isMobileMenuOpen ? styles.mobileMenuOpen : ""
            }`}
            role="listbox"
          >
            {mobileNavItems.map((item) => {
              const isPending = Boolean(
                pendingHref &&
                  billingPathMatchesHref(pendingHref, item.href, item.exact),
              );
              const isActive =
                !isPending &&
                billingPathMatchesHref(pathname, item.href, item.exact);

              return (
                <li key={item.href} role="none">
                  <Link
                    href={item.href}
                    role="option"
                    aria-selected={isActive}
                    className={`${styles.mobileMenuItem} ${
                      isActive ? styles.mobileMenuItemActive : ""
                    } ${isPending ? styles.tabPending : ""}`}
                    onClick={(event) =>
                      handleNavClick(event, item.href, isActive, isPending)
                    }
                  >
                    <BillingNavGlyph
                      icon={item.icon}
                      className={`${styles.tabIcon} ${
                        item.iconTone ? navMenuIconClass(item.iconTone) : ""
                      }`}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {canOpenNewInvoice ? (
        <Link
          href={BILLING_NEW_INVOICE_PATH}
          className={`${styles.newInvoiceButton} ${
            isInvoicing ? styles.newInvoiceButtonCurrent : ""
          }`}
          aria-current={isOnNewInvoice ? "page" : undefined}
          aria-keyshortcuts={
            canCreateInvoice ? BILLING_NEW_INVOICE_SHORTCUT : undefined
          }
          onClick={(event) => {
            if (isOnNewInvoice) {
              return;
            }

            if (
              unsavedDraft?.requestLeave(BILLING_NEW_INVOICE_PATH, {
                exact: true,
              })
            ) {
              event.preventDefault();
              return;
            }

            sectionTransition?.beginNavigation(BILLING_NEW_INVOICE_PATH, {
              exact: true,
            });
          }}
        >
          <ReceiptText
            className={styles.newInvoiceIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <span className={styles.newInvoiceLabelFull}>
            <span className={styles.newInvoiceLabelStack}>
              <span
                className={`${styles.newInvoiceLabelText} ${
                  isInvoicing ? styles.newInvoiceLabelIdle : ""
                }`}
                aria-hidden={isInvoicing}
              >
                Nueva factura
              </span>
              <span
                className={`${styles.newInvoiceLabelText} ${
                  isInvoicing ? "" : styles.newInvoiceLabelIdle
                }`}
                aria-hidden={!isInvoicing}
              >
                Facturando...
              </span>
            </span>
            {isOnNewInvoice || !canCreateInvoice ? null : (
              <kbd className={styles.newInvoiceShortcut} aria-hidden>
                {BILLING_NEW_INVOICE_SHORTCUT}
              </kbd>
            )}
          </span>
          <span className={styles.newInvoiceLabelShort}>
            {isInvoicing ? "Facturando..." : "Facturar"}
            {isOnNewInvoice || !canCreateInvoice ? null : (
              <kbd className={styles.newInvoiceShortcut} aria-hidden>
                {BILLING_NEW_INVOICE_SHORTCUT}
              </kbd>
            )}
          </span>
        </Link>
        ) : null}
      </div>
    </nav>
  );
}
