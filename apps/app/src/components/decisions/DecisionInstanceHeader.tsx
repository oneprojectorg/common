"use client";

import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { ButtonLink } from "@op/ui/Button";
import { Header1 } from "@op/ui/Header";
import { IconButton } from "@op/ui/IconButton";
import { MegaphoneIcon } from "@op/ui/MegaphoneIcon";
import { useQueryState } from "nuqs";
import { type ReactNode } from "react";
import { LuArrowLeft, LuSettings } from "react-icons/lu";

import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/routing";

import { LocaleChooser } from "../LocaleChooser";
import { UserAvatarMenu } from "../SiteHeader";
import { panelStateParser } from "./panelState";

export const DecisionInstanceHeader = ({
  backTo,
  title,
  decisionSlug,
  isAdmin,
  canReadUpdates = false,
  centerSlot,
}: {
  backTo: {
    label?: string;
    href: string;
  };
  title: string;
  decisionSlug?: string;
  isAdmin?: boolean;
  canReadUpdates?: boolean;
  /**
   * Optional content for the header's center column (e.g. the Overview /
   * Current Phase toggle). When provided, the title moves beside the Back
   * link so the center stays reserved for the slot; otherwise the title is
   * centered as before.
   */
  centerSlot?: ReactNode;
}) => {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center border-b bg-white p-2 px-6 sm:grid-cols-3 md:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={backTo.href}
          className="flex shrink-0 items-center gap-2 text-base text-neutral-black hover:text-primary-tealBlack md:text-primary-teal"
        >
          <LuArrowLeft className="size-6 md:size-4 rtl:-scale-x-100" />
          <span className="hidden md:flex">
            {t("Back")} {backTo.label ? `${t("to")} ${backTo.label}` : ""}
          </span>
        </Link>
        {centerSlot ? (
          <>
            <span
              aria-hidden
              className="hidden h-6 w-px shrink-0 bg-neutral-gray2 md:block"
            />
            <Header1 className="truncate font-serif text-title-sm text-neutral-charcoal sm:text-title-sm">
              <bdi>{title}</bdi>
            </Header1>
          </>
        ) : null}
      </div>

      <div className="flex justify-center text-center">
        {centerSlot ?? (
          <Header1 className="font-serif text-title-sm text-neutral-charcoal sm:text-title-sm">
            <bdi>{title}</bdi>
          </Header1>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 md:gap-4">
        <DecisionUpdatesToggle
          ariaLabel={t("Toggle updates panel")}
          canReadUpdates={canReadUpdates}
        />
        {isAdmin && decisionSlug && (
          <ButtonLink
            href={`/decisions/${decisionSlug}/edit`}
            color="secondary"
            size="small"
            className="p-2"
            aria-label={t("Settings")}
          >
            <LuSettings className="size-4" />
          </ButtonLink>
        )}
        <LocaleChooser />
        <UserAvatarMenu />
      </div>
    </header>
  );
};

const DecisionUpdatesToggle = ({
  ariaLabel,
  canReadUpdates,
}: {
  ariaLabel: string;
  canReadUpdates: boolean;
}) => {
  const [panel, setPanel] = useQueryState("panel", panelStateParser);
  const decisionUpdatesEnabled = useFeatureFlag("decision_updates");

  // Show the entry point to anyone who can actually read updates;
  // the feature flag lets us preview the panel for everyone else.
  if (!decisionUpdatesEnabled && !canReadUpdates) {
    return null;
  }

  const isOpen = panel !== null;

  return (
    <IconButton
      variant="outline"
      size="medium"
      onPress={() => setPanel(isOpen ? null : "updates")}
      aria-label={ariaLabel}
      aria-pressed={isOpen}
      className={
        isOpen ? "bg-primary-tealWhite text-primary-teal" : "text-neutral-black"
      }
    >
      <MegaphoneIcon className="size-4" />
    </IconButton>
  );
};
